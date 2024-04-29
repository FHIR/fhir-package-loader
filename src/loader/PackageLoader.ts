import { PackageInfo, ResourceInfo } from '../package';

export enum PackageLoadStatus {
  LOADED = 'LOADED',
  NOT_LOADED = 'NOT_LOADED',
  FAILED = 'FAILED'
}

export interface PackageLoader {
  loadPackage(name: string, version: string): Promise<PackageLoadStatus>;
  //loadLocalResource(resourceJSON: any, resourcePath: string): Promise<PackageLoadStatus>;
  getPackageLoadStatus(name: string, version: string): PackageLoadStatus;
  findPackageInfo(name: string, version: string): PackageInfo;
  findResourceInfos(key: string): ResourceInfo[];
  findResourceInfo(key: string): ResourceInfo;
  clear(): void;
}
