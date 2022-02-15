import { createLogger, format, transports } from 'winston';
import chalk from 'chalk';

const { combine, printf } = format;

const printer = printf(info => {
  let level;
  switch (info.level) {
    case 'info':
      level = chalk.whiteBright.bgGreen(`${info.level} `);
      break;
    case 'warn':
      level = chalk.whiteBright.bgRgb(179, 98, 0)(`${info.level} `);
      break;
    case 'error':
      level = chalk.whiteBright.bgRed(`${info.level}`);
      break;
    case 'debug':
      level = chalk.whiteBright.bgBlue(`${info.level}`);
      break;
    default:
      break;
  }
  return `${level} ${info.message}`;
});

export const logger = createLogger({
  format: combine(printer),
  transports: [new transports.Console()]
});

export class ErrorsAndWarnings {
  public errors: string[] = [];
  public warnings: string[] = [];

  reset(): void {
    this.errors = [];
    this.warnings = [];
  }
}

export const wrapLogger = (log: LogFunction = () => {}, errorsAndWarnings: ErrorsAndWarnings) => {
  return (level: string, message: string) => {
    if (level === 'error') {
      errorsAndWarnings.errors.push(message);
    } else if (level === 'warn') {
      errorsAndWarnings.warnings.push(message);
    }
    log(level, message);
  };
};

export type LogFunction = (level: string, message: string) => void;
