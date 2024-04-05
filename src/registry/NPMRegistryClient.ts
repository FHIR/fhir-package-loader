import { Readable } from 'stream';
import { LogFunction, axiosGet } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';

export class NPMRegistryClient implements RegistryClient {
  public endpoint: string;
  private log: LogFunction;

  constructor(endpoint: string, options?: RegistryClientOptions) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});
  }

  async download(name: string, version: string): Promise<Readable> {
    // Get the manifest information about the package from the registry
    const manifestRes = await axiosGet(`${this.endpoint}/${name}`);
    // Find the NPM tarball location in the manifest
    let url = manifestRes.data?.versions?.[version]?.dist?.tarball;
    // If tarball URL is not found, fallback to standard NPM approach per
    // https://docs.fire.ly/projects/Simplifier/features/api.html#package-server-api
    if (!url) {
      url = `${this.endpoint}/${name}/-/${name}-${version}.tgz`;
    }
    this.log('info', `Attempting to download ${name}#${version} from ${url}`);
    const tarballRes = await axiosGet(url, { responseType: 'stream' });
    if (tarballRes?.status === 200 && tarballRes?.data) {
      return tarballRes.data;
    }
    throw new Error(`Failed to download ${name}#${version} from ${url}`);
  }
}
