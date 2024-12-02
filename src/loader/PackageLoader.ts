import { FindResourceInfoOptions, PackageInfo, ResourceInfo, VirtualPackage } from '../package';

export enum LoadStatus {
  LOADED = 'LOADED',
  NOT_LOADED = 'NOT_LOADED',
  FAILED = 'FAILED'
}

export interface PackageLoader {
  loadPackage(name: string, version: string): Promise<LoadStatus>;
  loadVirtualPackage(pkg: VirtualPackage): Promise<LoadStatus>;
  getPackageLoadStatus(name: string, version: string): LoadStatus;
  findPackageInfos(name: string): PackageInfo[];
  findPackageInfo(name: string, version: string): PackageInfo | undefined;
  findPackageJSONs(name: string): any[];
  findPackageJSON(name: string, version: string): any | undefined;
  findResourceInfos(key: string, options?: FindResourceInfoOptions): ResourceInfo[];
  findResourceInfo(key: string, options?: FindResourceInfoOptions): ResourceInfo | undefined;
  findResourceJSONs(key: string, options?: FindResourceInfoOptions): any[];
  findResourceJSON(key: string, options?: FindResourceInfoOptions): any | undefined;
  optimize(): void;
  clear(): void;
}
