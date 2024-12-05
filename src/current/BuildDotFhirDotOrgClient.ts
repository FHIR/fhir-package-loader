import { Readable } from 'stream';
import { CurrentPackageLoadError } from '../errors';
import { LogFunction, axiosGet } from '../utils';
import { CurrentBuildClient, CurrentBuildClientOptions } from './CurrentBuildClient';

export class BuildDotFhirDotOrgClient implements CurrentBuildClient {
  private log: LogFunction;
  constructor(options: CurrentBuildClientOptions = {}) {
    this.log = options.log ?? (() => {});
  }

  async downloadCurrentBuild(name: string, branch?: string): Promise<Readable> {
    const version = branch ? `current$${branch}` : 'current';
    const baseURL = await this.getCurrentBuildBaseURL(name, branch);
    if (!baseURL) {
      throw new CurrentPackageLoadError(`${name}#${version}`);
    }
    const url = `${baseURL}/package.tgz`;
    this.log('info', `Attempting to download ${name}#${version} from ${url}`);
    const tarballRes = await axiosGet(url, { responseType: 'stream' });
    if (tarballRes?.status === 200 && tarballRes?.data) {
      return tarballRes.data;
    }
    throw new Error(`Failed to download ${name}#${version} from ${url}`);
  }

  async getCurrentBuildDate(name: string, branch?: string) {
    const baseURL = await this.getCurrentBuildBaseURL(name, branch);
    const manifest = await axiosGet(`${baseURL}/package.manifest.json`);
    return manifest?.data?.date;
  }

  private async getCurrentBuildBaseURL(name: string, branch?: string) {
    // Even if a local current package is loaded, we must still check that the local package date matches
    // the date on the most recent version on build.fhir.org. If the date does not match, we re-download to the cache
    type QAEntry = { 'package-id': string; date: string; repo: string };
    const baseUrl = 'https://build.fhir.org/ig';
    const res = await axiosGet(`${baseUrl}/qas.json`);
    const qaData: QAEntry[] = res?.data;
    // Find matching packages and sort by date to get the most recent
    let newestPackage: QAEntry;
    if (qaData?.length > 0) {
      let matchingPackages = qaData.filter(p => p['package-id'] === name);
      if (branch == null) {
        matchingPackages = matchingPackages.filter(p => p.repo.match(/\/(master|main)\/qa\.json$/));
      } else {
        matchingPackages = matchingPackages.filter(p => p.repo.endsWith(`/${branch}/qa.json`));
      }
      newestPackage = matchingPackages.sort((p1, p2) => {
        return Date.parse(p2['date']) - Date.parse(p1['date']);
      })[0];
    }
    if (newestPackage?.repo) {
      const packagePath = newestPackage.repo.slice(0, -8); // remove "/qa.json" from end
      return `${baseUrl}/${packagePath}`;
    }
  }
}
