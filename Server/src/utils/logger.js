/**
 * Minimal structured logging for requests and errors.
 * Extend with pino/winston later without changing call sites.
 */
const level = process.env.LOG_LEVEL || "info";

function ts() {
  return new Date().toISOString();
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
