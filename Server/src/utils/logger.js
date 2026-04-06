/**
 * Minimal structured logging for requests and errors.
 * Extend with pino/winston later without changing call sites.
 */
const level = process.env.LOG_LEVEL || "info";

const maxSectionChars = Number(process.env.LOG_MAX_SECTION_CHARS) || 80000;

function ts() {
  return new Date().toISOString();
}

function truncateForTerminal(text, max = maxSectionChars) {
  if (text == null) return "";
  const s = typeof text === "string" ? text : JSON.stringify(text, null, 2);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated ${s.length - max} more characters; set LOG_MAX_SECTION_CHARS to raise limit]`;
}

/**
 * Readable blocks in the server terminal (extension payload, prompts, LLM text).
 */
export function logTerminalSection(title, content) {
  const body = truncateForTerminal(content);
  console.log(`\n────────── ${title} ──────────`);
  console.log(body);
  console.log(`────────── end ${title} ──────────\n`);
}

export const logger = {
  info(message, meta = {}) {
    if (level === "silent") return;
    console.log(JSON.stringify({ level: "info", time: ts(), message, ...meta }));
  },
  warn(message, meta = {}) {
    console.warn(JSON.stringify({ level: "warn", time: ts(), message, ...meta }));
  },
  error(message, meta = {}) {
    console.error(JSON.stringify({ level: "error", time: ts(), message, ...meta }));
  },
};
