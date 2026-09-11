export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  requestId?: string;
  userId?: string;
  campaignId?: string;
  recipientId?: string;
  jobId?: string;
  providerId?: string;
  [key: string]: any;
}

const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'jwtSecret',
  'refreshToken',
  'token',
  'smtpPassword',
  'secret',
  'apiKey',
];

function redactSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redactSensitiveData);

  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      sanitized[key] = redactSensitiveData(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const cleanContext = context ? redactSensitiveData(context) : undefined;
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...(cleanContext ? { context: cleanContext } : {}),
    });
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, context?: LogContext, error?: Error | unknown) {
    const errObj = error instanceof Error ? { name: error.name, message: error.message } : error;
    console.error(
      this.formatMessage('ERROR', message, {
        ...context,
        ...(errObj ? { error: errObj } : {}),
      })
    );
  }
}

export const logger = new Logger();
