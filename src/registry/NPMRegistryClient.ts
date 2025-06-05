import { Readable } from 'stream';
import { AxiosHeaders } from 'axios';
import { axiosGet, LogFunction } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';
import { resolveVersion } from './utils';

export class NPMRegistryClient implements RegistryClient {
  public endpoint: string;
  private log: LogFunction;
  private headers: AxiosHeaders = new AxiosHeaders();

  constructor(endpoint: string, options?: RegistryClientOptions) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});

    // If an FPL_TOKEN is provided, set it in the headers for authentication
    if (process.env.FPL_TOKEN) {
      this.headers.set('Authorization', `Bearer ${process.env.FPL_TOKEN}`);
    }
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
      const manifestRes = await axiosGet(`${this.endpoint}/${name}`, { headers: this.headers });
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
    const tarballRes = await axiosGet(url, { responseType: 'stream', headers: this.headers });
    if (tarballRes?.status === 200 && tarballRes?.data) {
      return tarballRes.data;
    }
    throw new Error(`Failed to download ${name}#${version} from ${url}`);
  }
}
