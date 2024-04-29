import { Readable } from 'stream';
import { LogFunction, axiosGet } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';

export class FHIRRegistryClient implements RegistryClient {
  public endpoint: string;
  private log: LogFunction;

  constructor(endpoint: string, options?: RegistryClientOptions) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});
  }

  async download(name: string, version: string): Promise<Readable> {
    // Construct URL from endpoint, name, and version
    // See: https://confluence.hl7.org/pages/viewpage.action?pageId=97454344#FHIRPackageRegistryUserDocumentation-Download
    const url = `${this.endpoint}/${name}/${version}`;
    this.log('info', `Attempting to download ${name}#${version} from ${url}`);
    const res = await axiosGet(url, { responseType: 'stream' });
    if (res?.status === 200 && res?.data) {
      return res.data;
    }
    throw new Error(`Failed to download ${name}#${version} from ${url}`);
  }
}
