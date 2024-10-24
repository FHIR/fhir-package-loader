import { FindResourceInfoOptions, PackageInfo, PackageStats, ResourceInfo } from '../package';

export interface PackageDB {
  clear(): void;
  savePackageInfo(info: PackageInfo): void;
  saveResourceInfo(info: ResourceInfo): void;
  findPackageInfos(name: string): PackageInfo[];
  findPackageInfo(name: string, version: string): PackageInfo | undefined;
  findResourceInfos(key: string, options?: FindResourceInfoOptions): ResourceInfo[];
  findResourceInfo(key: string, options?: FindResourceInfoOptions): ResourceInfo | undefined;
  getPackageStats(name: string, version: string): PackageStats | undefined;
  exportDB(): Promise<{ mimeType: string; data: Buffer }>;
}
