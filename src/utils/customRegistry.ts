import process from 'process';
import { LogFunction } from './logger';

let hasLoggedCustomRegistry = false;

export function getCustomRegistry(log: LogFunction = () => {}) {
  if (process.env.FPL_REGISTRY) {
    if (!hasLoggedCustomRegistry) {
      hasLoggedCustomRegistry = true;
      log(
        'info',
        `Using custom registry specified by FPL_REGISTRY environment variable: ${process.env.FPL_REGISTRY}`
      );
    }
    return process.env.FPL_REGISTRY;
  }
}
