import { Readable } from 'stream';
import { AxiosRequestConfig } from 'axios';
import { axiosGet, LogFunction } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';
import { resolveVersion } from './utils';

type NPMRegistryClientOptions = RegistryClientOptions & { token?: string };

export class NPMRegistryClient implements RegistryClient {
  public endpoint: string;
  private log: LogFunction;
  private readonly token?: string;

  constructor(endpoint: string, options: NPMRegistryClientOptions = {}) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});
    this.token = options.token;
  }

  async resolveVersion(name: string, version: string): Promise<string> {
    const auth = this.requestAuth(`${this.endpoint}/${name}`);
    return resolveVersion(this.endpoint, name, version, auth?.options, auth?.token);
  }

  async download(name: string, version: string): Promise<Readable> {
    // Resolve version if necessary
    version = await this.resolveVersion(name, version);

    // Get the manifest information about the package from the registry
    let url;
    try {
      const manifestUrl = `${this.endpoint}/${name}`;
      const auth = this.requestAuth(manifestUrl);
      const manifestRes = await axiosGet(manifestUrl, auth?.options, auth?.token);
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
    const auth = this.requestAuth(url);
    const tarballRes = await axiosGet(
      url,
      { ...auth?.options, responseType: 'stream' },
      auth?.token
    );
    if (tarballRes?.status === 200 && tarballRes?.data) {
      return tarballRes.data;
    }
    if (tarballRes?.status === 401) {
      this.log('error', 'Unauthorized! Please check your FPL_REGISTRY_TOKEN.');
    }
    throw new Error(`Failed to download ${name}#${version} from ${url}`);
  }

  private requestAuth(url: string): { token: string; options?: AxiosRequestConfig } | undefined {
    const { token } = this;
    if (token === undefined) {
      return undefined;
    }
    if (token === '') {
      return { token };
    }

    const registry = new URL(this.endpoint);
    if (!isWithinRegistry(url, registry)) {
      return { token: '' };
    }

    return {
      token,
      options: {
        beforeRedirect: (redirect, response, previousRequest) => {
          if (!isWithinRegistry(response.headers.location, registry, previousRequest.url)) {
            for (const header of Object.keys(redirect.headers)) {
              if (header.toLowerCase() === 'authorization') {
                delete redirect.headers[header];
              }
            }
          }
        }
      }
    };
  }
}

function isWithinRegistry(url: string, registry: URL, base?: string): boolean {
  try {
    const target = new URL(url, base);
    const sameOrigin = target.origin === registry.origin;
    const samePath = target.pathname === registry.pathname;
    const isSubpath = target.pathname.startsWith(`${registry.pathname.replace(/\/$/, '')}/`);
    return sameOrigin && (samePath || isSubpath);
  } catch {
    return false;
  }
}
