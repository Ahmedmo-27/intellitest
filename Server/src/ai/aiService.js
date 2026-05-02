/**
 * AI Service — wraps llmService with:
 *   1. Configurable timeout (AbortController)
 *   2. Retry logic with correction prompt on invalid output
 *   3. Structured error classification (source: "AI" | "backend")
 *
 * Environment variables:
 *   AI_TIMEOUT_MS      — ms before a single attempt is cancelled (default 30 000)
 *   AI_MAX_RETRIES     — total additional retries on bad output (default 2)
 */

import axios from "axios";
import { logTerminalSection, logger } from "../utils/logger.js";

// ── config ────────────────────────────────────────────────────────────────────
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 30_000;
const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES) || 2;

// ── error helpers ─────────────────────────────────────────────────────────────

/**
 * Standardised error object attached to thrown errors and API responses.
 * @param {"AI"|"backend"} source
 * @param {string} type
 * @param {string} message
 * @param {unknown} [detail]
 */
export function buildErrorPayload(source, type, message, detail) {
  return { source, type, message, ...(detail !== undefined ? { detail } : {}) };
}

class AiError extends Error {
  /**
   * @param {"AI"|"backend"} source
   * @param {string} type
   * @param {string} message
   */
  constructor(source, type, message) {
    super(message);
    this.source = source;
    this.type = type;
  }
}

// ── LLM provider adapters ─────────────────────────────────────────────────────

function getConfig() {
  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
  return {
    provider,
    ollamaBase: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3.2",
    apiBase: process.env.API_BASE_URL || "",
    apiKey: process.env.API_KEY || "",
    apiModel: process.env.API_MODEL || "gpt-4o-mini",
  };
}

/**
 * Single attempt to the Ollama local API with abort signal support.
 * @param {ReturnType<getConfig>} cfg
 * @param {string} prompt
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
async function callOllama(cfg, prompt, signal) {
  const url = `${cfg.ollamaBase.replace(/\/$/, "")}/api/chat`;
  const body = {
    model: cfg.ollamaModel,
    messages: [{ role: "user", content: prompt }],
    stream: false,
  };
  try {
    const { data } = await axios.post(url, body, { signal, timeout: TIMEOUT_MS + 5_000 });
    const text = data?.message?.content ?? data?.response ?? "";
    return typeof text === "string" ? text : JSON.stringify(text);
  } catch (e) {
    if (e.name === "AbortError" || e.code === "ERR_CANCELED") {
      throw new AiError("AI", "Timeout", "Ollama request timed out.");
    }
    const detail = e.message;
    logger.error("ollama_request_failed", { message: detail, url });
    throw new AiError("AI", "ProviderError", `Ollama request failed: ${detail}`);
  }
}

/**
 * Single attempt to an OpenAI-compatible API with abort signal support.
 * @param {ReturnType<getConfig>} cfg
 * @param {string} prompt
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
async function callOpenAICompatible(cfg, prompt, signal) {
  if (!cfg.apiBase || !cfg.apiKey) {
    throw new AiError(
      "backend",
      "MissingConfig",
      "API_BASE_URL and API_KEY are required when LLM_PROVIDER=api"
    );
  }
  const url = `${cfg.apiBase.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: cfg.apiModel,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  };
  try {
    const { data } = await axios.post(url, body, {
      signal,
      timeout: TIMEOUT_MS + 5_000,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const choice = data?.choices?.[0]?.message?.content;
    return typeof choice === "string" ? choice : JSON.stringify(choice ?? "");
  } catch (e) {
    if (e.name === "AbortError" || e.code === "ERR_CANCELED") {
      throw new AiError("AI", "Timeout", "AI API request timed out.");
    }
    const status = e.response?.status;
    const body = e.response?.data;
    let apiHint = "";
    if (body && typeof body === "object") {
      const errObj = body.error;
      if (typeof errObj === "string") apiHint = errObj;
      else if (errObj && typeof errObj.message === "string") apiHint = errObj.message;
      else if (typeof body.message === "string") apiHint = body.message;
    }
    const detail = apiHint || e.message;
    logger.error("api_llm_request_failed", { message: detail, status });
    throw new AiError(
      "AI",
      "ProviderError",
      apiHint
        ? `LLM API request failed (${status ?? "?"}): ${apiHint}`
        : `LLM API request failed: ${e.message}`
    );
  }
}

// ── timeout wrapper ───────────────────────────────────────────────────────────

/**
 * Run `fn(signal)` with a timeout of `ms` milliseconds.
 * Rejects with AiError("AI","Timeout",...) if time elapses first.
 * @param {(signal: AbortSignal) => Promise<string>} fn
 * @param {number} ms
 * @returns {Promise<string>}
 */
async function withTimeout(fn, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err instanceof AiError) throw err;
    // wrap unexpected errors
    throw new AiError("AI", "UnexpectedError", err.message);
  } finally {
    clearTimeout(timer);
  }
}

// ── retry with correction ─────────────────────────────────────────────────────

/**
 * Attempt `fn` up to `maxRetries + 1` times.
 * On each failed attempt (validator returns falsy / throws), inject a
 * correction prompt into the next call.
 *
 * @param {(prompt: string) => Promise<string>} fn         raw completion function
 * @param {string} initialPrompt
 * @param {(raw: string) => boolean} validator              returns true if output is good
 * @param {{ maxRetries?: number, correctionPrompt?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function completeWithRetry(fn, initialPrompt, validator, opts = {}) {
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;
  const correctionPrefix =
    opts.correctionPrompt ??
    "The previous response was malformed. Fix the JSON structure and follow the required schema strictly.\n\n";

  let prompt = initialPrompt;
  let lastRaw = "";
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await fn(prompt);
      lastRaw = raw;

      if (validator(raw)) {
        if (attempt > 0) {
          logger.info("ai_retry_succeeded", { attempt });
        }
        return raw;
      }

      // Output came back but failed validation
      logger.warn("ai_output_failed_validation", { attempt, preview: raw.slice(0, 200) });

      if (attempt < maxRetries) {
        prompt = `${correctionPrefix}Previous bad response:\n${raw.slice(0, 800)}\n\nOriginal instruction:\n${initialPrompt}`;
      }
    } catch (err) {
      lastError = err;
      logger.warn("ai_attempt_failed", { attempt, error: err.message });

      // Timeout errors — no point retrying (the model won't suddenly be faster)
      if (err instanceof AiError && err.type === "Timeout") throw err;

      // Config errors — won't fix themselves
      if (err instanceof AiError && err.type === "MissingConfig") throw err;

      if (attempt === maxRetries) break;
    }
  }

  // All attempts exhausted
  if (lastError) throw lastError;

  // Output never validated — throw a descriptive error
  throw new AiError(
    "AI",
    "InvalidResponse",
    `Model returned malformed output after ${maxRetries + 1} attempt(s).`
  );
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Primary entry-point used by controllers.
 *
 * @param {string} prompt
 * @param {{ validator?: (raw: string) => boolean, correctionPrompt?: string }} [opts]
 * @returns {Promise<string>} raw model text (always a string)
 */
export async function complete(prompt, opts = {}) {
  logTerminalSection("AI input (full prompt sent to the model)", prompt);
  const cfg = getConfig();

  const callProvider = (signal) =>
    cfg.provider === "api"
      ? callOpenAICompatible(cfg, prompt, signal)
      : callOllama(cfg, prompt, signal);

  const validator = opts.validator ?? (() => true); // default: accept any non-empty string

  try {
    const raw = await completeWithRetry(
      (p) => withTimeout((signal) => {
        // rebuild provider call with potentially updated prompt
        const callFn = cfg.provider === "api"
          ? (s) => callOpenAICompatible(cfg, p, s)
          : (s) => callOllama(cfg, p, s);
        return callFn(signal);
      }, TIMEOUT_MS),
      prompt,
      (r) => typeof r === "string" && r.trim().length > 0 && validator(r),
      opts
    );

    logTerminalSection("AI output (raw model text)", raw);
    return raw;
  } catch (err) {
    // Re-throw as AiError so the controller can respond consistently
    if (err instanceof AiError) throw err;
    throw new AiError("backend", "UnexpectedError", err.message);
  }
}

/**
 * Fallback response shape for timeout / unrecoverable errors.
 * @param {AiError|Error} err
 * @returns {{ source: string, type: string, message: string }}
 */
export function buildFallbackResponse(err) {
  if (err instanceof AiError) {
    if (err.type === "Timeout") {
      return buildErrorPayload("AI", "Timeout", "AI request timed out. Please try again.");
    }
    return buildErrorPayload(err.source, err.type, err.message);
  }
  return buildErrorPayload("backend", "UnexpectedError", "An unexpected error occurred.");
}
