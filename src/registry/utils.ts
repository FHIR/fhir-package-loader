import { AxiosRequestConfig } from 'axios';
import { maxSatisfying } from 'semver';
import { IncorrectWildcardVersionFormatError, LatestVersionUnavailableError } from '../errors';
import { axiosGet } from '../utils';

export async function resolveVersion(
  endpoint: string,
  name: string,
  version: string,
  options?: AxiosRequestConfig,
  token?: string
): Promise<string> {
  let resolvedVersion = version;
  if (version === 'latest') {
    resolvedVersion = await lookUpLatestVersion(endpoint, name, options, token);
  } else if (/^\d+\.\d+\.x$/.test(version)) {
    resolvedVersion = await lookUpLatestPatchVersion(endpoint, name, version, options, token);
  } else if (/^\d+\.x$/.test(version)) {
    throw new IncorrectWildcardVersionFormatError(name, version);
  }
  return resolvedVersion;
}

async function lookUpLatestVersion(
  endpoint: string,
  name: string,
  options?: AxiosRequestConfig,
  token?: string
): Promise<string> {
  try {
    const res = await axiosGet(`${endpoint}/${name}`, { ...options, responseType: 'json' }, token);
    if (res?.data?.['dist-tags']?.latest?.length) {
      return res.data['dist-tags'].latest;
    } else {
      throw new LatestVersionUnavailableError(name);
    }
  } catch {
    throw new LatestVersionUnavailableError(name);
  }
}

async function lookUpLatestPatchVersion(
  endpoint: string,
  name: string,
  version: string,
  options?: AxiosRequestConfig,
  token?: string
): Promise<string> {
  if (!/^\d+\.\d+\.x$/.test(version)) {
    throw new IncorrectWildcardVersionFormatError(name, version);
  }
  try {
    const res = await axiosGet(`${endpoint}/${name}`, { ...options, responseType: 'json' }, token);
    if (res?.data?.versions) {
      const versions = Object.keys(res.data.versions);
      const latest = maxSatisfying(versions, version);
      if (latest == null) {
        throw new LatestVersionUnavailableError(name, true);
      }
      return latest;
    } else {
      throw new LatestVersionUnavailableError(name, true);
    }
  } catch {
    throw new LatestVersionUnavailableError(name, true);
  }
}
