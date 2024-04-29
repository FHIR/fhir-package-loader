import { Readable } from 'stream';
import { LogFunction } from '../utils';

export type RegistryClientOptions = {
  log?: LogFunction;
};

export interface RegistryClient {
  download(name: string, version: string): Promise<Readable>;
}
