import { Readable } from 'stream';
import { axiosGet, LogFunction } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';
import { resolveVersion } from './utils';

export class NPMRegistryClient implements RegistryClient {
  public endpoint: string;
  private log: LogFunction;

  constructor(endpoint: string, options?: RegistryClientOptions) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});
  }

  async resolveVersion(name: string, version: string): Promise<string> {
    return resolveVersion(this.endpoint, name, version);
  }

  async download(name: string, version: string): Promise<Readable> {
    // Resolve version if necessary
    version = await this.resolveVersion(name, version);

    // Get the manifest information about the package from the registry
    let url;
    try {
      const manifestRes = await axiosGet(`${this.endpoint}/${name}`);
      // Find the NPM tarball location in the manifest
      url = manifestRes.data?.versions?.[version]?.dist?.tarball;
    } catch {
      // Do nothing. Undefined url handled below.
    }
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
    if (tarballRes?.status === 401) {
      this.log('error', 'Unauthorized! Please check your FPL_REGISTRY_TOKEN.');
    }
    throw new Error(`Failed to download ${name}#${version} from ${url}`);
  }
}
