import { LogFunction } from '../utils';

export type CurrentBuildClientOptions = {
  log?: LogFunction;
};

export interface CurrentBuildClient {
  downloadCurrentBuild(name: string, branch: string | null, cachePath: string): Promise<string>;
  getCurrentBuildDate(name: string, branch?: string): Promise<string>;
}
