import { Readable } from 'stream';
import { LogFunction } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';

export class RedundantRegistryClient implements RegistryClient {
  protected log: LogFunction;
  constructor(
    private clients: RegistryClient[],
    options: RegistryClientOptions = {}
  ) {
    this.log = options.log ?? (() => {});
  }

  async download(name: string, version: string): Promise<Readable> {
    const packageLabel = `${name}#${version}`;

    for (const client of this.clients) {
      try {
        return await client.download(name, version);
      } catch (e) {
        // Do nothing. Fallback to the next one.
      }
    }
    throw Error(`Failed to download ${packageLabel}`);
  }
}
