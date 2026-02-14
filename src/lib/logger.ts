/**
 * Simple Logger Utility
 * Provides consistent logging format with timestamps and context
 */

type LogLevel = "info" | "warn" | "error" | "debug";

const COLORS = {
  info: "\x1b[36m", // Cyan
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  debug: "\x1b[90m", // Gray
  reset: "\x1b[0m",
};

function formatTimestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  const color = COLORS[level];
  const prefix = `${color}[${formatTimestamp()}] [${level.toUpperCase()}] [${context}]${COLORS.reset}`;

  if (data !== undefined) {
    // biome-ignore lint/suspicious/noConsole: Logger's purpose is to log to console
    console.log(prefix, message, typeof data === "object" ? JSON.stringify(data, null, 2) : data);
  } else {
    // biome-ignore lint/suspicious/noConsole: Logger's purpose is to log to console
    console.log(prefix, message);
  }
}

export const logger = {
  info: (context: string, message: string, data?: unknown) => log("info", context, message, data),
  warn: (context: string, message: string, data?: unknown) => log("warn", context, message, data),
  error: (context: string, message: string, data?: unknown) => log("error", context, message, data),
  debug: (context: string, message: string, data?: unknown) => log("debug", context, message, data),
};
