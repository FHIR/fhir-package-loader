import { Readable } from 'stream';

import { RegistryClient, RegistryClientOptions } from './RegistryClient';

import { LogFunction } from '../utils';

export class RedundantRegistryClient implements RegistryClient {
  protected log: LogFunction;
  constructor(
    public clients: RegistryClient[],
    options: RegistryClientOptions = {}
  ) {
    this.log = options.log ?? (() => {});
  }

  async resolveVersion(name: string, version: string): Promise<string> {
    const packageLabel = `${name}#${version}`;

    for (const client of this.clients) {
      try {
        return await client.resolveVersion(name, version);
      } catch {
        // Do nothing. Fallback to the next one.
      }
    }
    throw Error(`Failed to resolve version for ${packageLabel}`);
  }

  async download(name: string, version: string): Promise<Readable> {
    const packageLabel = `${name}#${version}`;

    for (const client of this.clients) {
      try {
        return await client.download(name, version);
      } catch {
        // Do nothing. Fallback to the next one.
      }
    }
    throw Error(`Failed to download ${packageLabel}`);
  }
}
