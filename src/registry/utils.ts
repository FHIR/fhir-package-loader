import { IncorrectWildcardVersionFormatError, LatestVersionUnavailableError } from '../errors';
import { axiosGet } from '../utils';
import { maxSatisfying } from 'semver';

export async function lookUpLatestVersion(endpoint: string, name: string): Promise<string> {
  try {
    const res = await axiosGet(`${endpoint}/${name}`, {
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

export async function lookUpLatestPatchVersion(
  endpoint: string,
  name: string,
  version: string
): Promise<string> {
  if (!/^\d+\.\d+\.x$/.test(version)) {
    throw new IncorrectWildcardVersionFormatError(name, version);
  }
  try {
    const res = await axiosGet(`${endpoint}/${name}`, {
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
