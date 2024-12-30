import { Readable } from 'stream';
import { LogFunction } from '../utils';

export type RegistryClientOptions = {
  log?: LogFunction;
  useHttps?: boolean;
};

export interface RegistryClient {
  resolveVersion(name: string, version: string): Promise<string>;
  download(name: string, version: string): Promise<Readable>;
}
