import https from 'https';
import { Readable } from 'stream';
import { axiosGet, LogFunction } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';
import { resolveVersion } from './utils';

type FHIRRegistryClientOptions = RegistryClientOptions & { isBrowserEnvironment?: boolean };

export class FHIRRegistryClient implements RegistryClient {
  public endpoint: string;
  private log: LogFunction;
  private isBrowserEnvironment: boolean;

  constructor(endpoint: string, options?: FHIRRegistryClientOptions) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});
    this.isBrowserEnvironment = options.isBrowserEnvironment ?? false;
  }

  async resolveVersion(name: string, version: string): Promise<string> {
    return resolveVersion(this.endpoint, name, version);
  }

  async download(name: string, version: string): Promise<Readable> {
    // Resolve version if necessary
    version = await this.resolveVersion(name, version);

    // Construct URL from endpoint, name, and version
    // See: https://confluence.hl7.org/pages/viewpage.action?pageId=97454344#FHIRPackageRegistryUserDocumentation-Download
    const url = `${this.endpoint}/${name}/${version}`;
    this.log('info', `Attempting to download ${name}#${version} from ${url}`);

    // Right now, this approach is needed for browser environments
    if (this.isBrowserEnvironment) {
      return new Promise((resolve, reject) => {
        https
          .get(url, res => {
            if (res.statusCode < 400) {
              resolve(res);
            } else {
              reject(`Failed to download ${name}#${version} from ${url}`);
            }
          })
          .on('error', () => {
            reject(`Failed to download ${name}#${version} from ${url}`);
          });
      });
    }

    // Axios approach should be used the vast majority of the time
    const res = await axiosGet(url, { responseType: 'stream' });
    if (res?.status === 200 && res?.data) {
      return res.data;
    }
    throw new Error(`Failed to download ${name}#${version} from ${url}`);
  }
}
