export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export class Logger {
  private functionName: string;
  private context: Record<string, any>;

  constructor(functionName: string, context: Record<string, any> = {}) {
    this.functionName = functionName;
    this.context = context;
  }

  setContext(context: Record<string, any>) {
    this.context = { ...this.context, ...context };
  }

  private formatMessage(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length 
      ? ` | context: ${JSON.stringify(this.context)}` 
      : "";
    const dataStr = data ? ` | data: ${JSON.stringify(data)}` : "";
    
    return `[${timestamp}] [${level}] [${this.functionName}] ${message}${contextStr}${dataStr}`;
  }

  debug(message: string, data?: any) {
    console.log(this.formatMessage(LogLevel.DEBUG, message, data));
  }

  info(message: string, data?: any) {
    console.log(this.formatMessage(LogLevel.INFO, message, data));
  }

  warn(message: string, data?: any) {
    console.warn(this.formatMessage(LogLevel.WARN, message, data));
  }

  error(message: string, error?: any, data?: any) {
    const errorInfo = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
      
    console.error(this.formatMessage(LogLevel.ERROR, message, { error: errorInfo, ...data }));
  }
}

export const createLogger = (functionName: string, context?: Record<string, any>) => {
  return new Logger(functionName, context);
};
