import { Readable } from 'stream';
import { LogFunction } from '../utils';

export type PackageCacheOptions = {
  log?: LogFunction;
};

export interface PackageCache {
  cachePackageTarball(name: string, version: string, data: Readable): Promise<string>;
  isPackageInCache(name: string, version: string): boolean;
  getPackagePath(name: string, version: string): string | undefined;
  getPackageJSONPath(name: string, version: string): string | undefined;
  getPotentialResourcePaths(name: string, version: string): string[];
  getResourceAtPath(resourcePath: string): any;
}
