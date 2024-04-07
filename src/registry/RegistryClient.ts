import { LogFunction } from '../utils';

export type RegistryClientOptions = {
  log?: LogFunction;
};

export interface RegistryClient {
  download(name: string, version: string, cachePath: string): Promise<string>;
}
