import { PackageJSON } from '../package/PackageJSON';
import { LogFunction } from '../utils/logger';
import { VirtualPackage, VirtualPackageOptions } from './VirtualPackage';

export class InMemoryVirtualPackage implements VirtualPackage {
  private log: LogFunction;
  private allowNonResources: boolean;

  constructor(
    private packageJSON: PackageJSON,
    private resources: Map<string, any>,
    options: VirtualPackageOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.allowNonResources = options.allowNonResources ?? false;
  }

  async registerResources(
    register: (key: string, resource: any, allowNonResources?: boolean) => void
  ): Promise<void> {
    // TODO: Error handling?
    this.resources.forEach((resource, key) => register(key, resource, this.allowNonResources));
  }

  getPackageJSON(): PackageJSON {
    return this.packageJSON;
  }

  getResourceByKey(key: string) {
    const resource = this.resources.get(key);
    if (!resource) {
      throw new Error(`Could not find in-memory resource with key ${key}`);
    }
    return resource;
  }
}
