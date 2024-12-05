import { Readable } from 'stream';

import { LogFunction } from '../utils';

export type CurrentBuildClientOptions = {
  log?: LogFunction;
};

export interface CurrentBuildClient {
  downloadCurrentBuild(name: string, branch?: string): Promise<Readable>;
  getCurrentBuildDate(name: string, branch?: string): Promise<string>;
}
