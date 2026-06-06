/**
 * Minimal structured logger. Always redacts sensitive keys from structured
 * context before emitting. Respects LOG_LEVEL.
 */
import { getServerEnv, type LogLevel } from '@/lib/config/env';
import { redact } from './redact';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function shouldLog(level: LogLevel): boolean {
  const configured = getServerEnv().logLevel;
  return LEVEL_WEIGHT[level] <= LEVEL_WEIGHT[configured];
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: redact(context) } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
};
