import { PackageInfo, PackageStats, ResourceInfo } from '../package';

export interface PackageDB {
  clear(): void;
  savePackageInfo(info: PackageInfo): void;
  saveResourceInfo(info: ResourceInfo): void;
  findPackageInfo(name: string, version: string): PackageInfo | undefined;
  findResourceInfos(key: string): ResourceInfo[];
  findResourceInfo(key: string): ResourceInfo | undefined;
  getPackageStats(name: string, version: string): PackageStats | undefined;
}
