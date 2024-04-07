import { downloadPackageTarballToCache } from '../download';
import { LogFunction } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';

export class FHIRRegistryClient implements RegistryClient {
  public endpoint: string;
  private log: LogFunction;

  constructor(endpoint: string, options?: RegistryClientOptions) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});
  }

  async download(name: string, version: string, cachePath: string): Promise<string> {
    // Construct URL from endpoint, name, and version
    // See: https://confluence.hl7.org/pages/viewpage.action?pageId=97454344#FHIRPackageRegistryUserDocumentation-Download
    const url = `${this.endpoint}/${name}/${version}`;
    return downloadPackageTarballToCache(name, version, url, cachePath, this.log);
  }
}
