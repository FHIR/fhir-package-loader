import { LogFunction } from './utils';
import { axiosGet } from './utils/axiosUtils';
import { getCustomRegistry } from './utils/customRegistry';
import { downloadPackageTarballToCache } from './download';

const FHIR_PACKAGES_ENDPOINT = 'https://packages.fhir.org';
const FHIR_PACKAGES2_ENDPOINT = 'https://packages2.fhir.org/packages';

export type RegistryClientOptions = {
  log?: LogFunction;
};

export interface RegistryClient {
  download(name: string, version: string, cachePath: string): Promise<string>;
}

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

export class NPMRegistryClient {
  public endpoint: string;
  private log: LogFunction;

  constructor(endpoint: string, options?: RegistryClientOptions) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});
  }

  async download(name: string, version: string, cachePath: string): Promise<string> {
    // Get the manifest information about the package from the registry
    const res = await axiosGet(`${this.endpoint}/${name}`);
    // Find the NPM tarball location in the manifest
    let url = res.data?.versions?.[version]?.dist?.tarball;
    // If tarball URL is not found, fallback to standard NPM approach per
    // https://docs.fire.ly/projects/Simplifier/features/api.html#package-server-api
    if (!url) {
      url = `${this.endpoint}/${name}/-/${name}-${version}.tgz`;
    }
    return downloadPackageTarballToCache(name, version, url, cachePath, this.log);
  }
}

export class RedundantRegistryClient implements RegistryClient {
  private log: LogFunction;
  constructor(private clients: RegistryClient[], options: RegistryClientOptions = {}) {
    this.log = options.log ?? (() => {});
  }

  async download(name: string, version: string, cachePath: string) {
    const packageLabel = `${name}#${version}`;

    for (const client of this.clients) {
      try {
        return await client.download(name, version, cachePath);
      } catch (e) {
        // Do nothing. Fallback to the next one.
      }
    }
    throw Error(`Failed to download ${packageLabel}`);
  }
}

export class DefaultRegistryClient extends RedundantRegistryClient {
  constructor(options?: RegistryClientOptions) {
    let clients: RegistryClient[];
    // If a custom registry has been specified, use that
    const customRegistry = getCustomRegistry();
    if (customRegistry) {
      clients = [new NPMRegistryClient(customRegistry, options)];
    }
    // Otherwise use packages.fhir.org w/ packages2.fhir.org fallback
    else {
      clients = [
        new FHIRRegistryClient(FHIR_PACKAGES_ENDPOINT, options),
        new FHIRRegistryClient(FHIR_PACKAGES2_ENDPOINT, options)
      ];
    }
    super(clients, options);
  }
}
