import { Readable } from 'stream';
import { maxSatisfying } from 'semver';
import { LogFunction, axiosGet } from '../utils';
import { RegistryClient, RegistryClientOptions } from './RegistryClient';
import { IncorrectWildcardVersionFormatError, LatestVersionUnavailableError } from '../errors';

export class FHIRRegistryClient implements RegistryClient {
  public endpoint: string;
  private log: LogFunction;

  constructor(endpoint: string, options?: RegistryClientOptions) {
    // Remove trailing '/' from endpoint if applicable
    this.endpoint = endpoint.replace(/\/$/, '');
    this.log = options.log ?? (() => {});
  }

  async download(name: string, version: string): Promise<Readable> {
    // Resolve version if necessary
    if (version === 'latest') {
      version = await this.lookUpLatestVersion(name);
    } else if (/^\d+\.\d+\.x$/.test(version)) {
      version = await this.lookUpLatestPatchVersion(name, version);
    } else if (/^\d+\.x$/.test(version)) {
      throw new IncorrectWildcardVersionFormatError(name, version);
    }

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

  private async lookUpLatestVersion(name: string): Promise<string> {
    try {
      const res = await axiosGet(`${this.endpoint}/${name}`, {
        responseType: 'json'
      });
      if (res?.data?.['dist-tags']?.latest?.length) {
        return res.data['dist-tags'].latest;
      } else {
        throw new LatestVersionUnavailableError(name);
      }
    } catch {
      throw new LatestVersionUnavailableError(name);
    }
  }

  private async lookUpLatestPatchVersion(name: string, version: string): Promise<string> {
    if (!/^\d+\.\d+\.x$/.test(version)) {
      throw new IncorrectWildcardVersionFormatError(name, version);
    }
    try {
      const res = await axiosGet(`${this.endpoint}/${name}`, {
        responseType: 'json'
      });
      if (res?.data?.versions) {
        const versions = Object.keys(res.data.versions);
        const latest = maxSatisfying(versions, version);
        if (latest == null) {
          throw new LatestVersionUnavailableError(name, null, true);
        }
        return latest;
      } else {
        throw new LatestVersionUnavailableError(name, null, true);
      }
    } catch {
      throw new LatestVersionUnavailableError(name, null, true);
    }
  }
}
