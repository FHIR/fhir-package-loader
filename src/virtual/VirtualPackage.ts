import { PackageJSON } from '../package/PackageJSON';
import { LogFunction } from '../utils/logger';

export interface VirtualPackage {
  registerResources(
    register: (key: string, resource: any, allowNonResources?: boolean) => void
  ): Promise<void>;
  getPackageJSON(): PackageJSON;
  getResourceByKey(key: string): any;
}

export type VirtualPackageOptions = {
  log?: LogFunction;
  allowNonResources?: boolean;
};
