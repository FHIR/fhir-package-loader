import { VirtualPackage, VirtualPackageOptions } from './VirtualPackage';

import { PackageJSON } from '../package/PackageJSON';
import { LogFunction } from '../utils/logger';

export class InMemoryVirtualPackage implements VirtualPackage {
  private log: LogFunction;
  private allowNonResources: boolean;
  private registeredResources: Set<string>;

  constructor(
    private packageJSON: PackageJSON,
    private resources: Map<string, any>,
    options: VirtualPackageOptions = {}
  ) {
    this.log = options.log ?? (() => {});
    this.allowNonResources = options.allowNonResources ?? false;
    this.registeredResources = new Set<string>();
  }

  async registerResources(
    register: (key: string, resource: any, allowNonResources?: boolean) => void
  ): Promise<void> {
    this.resources.forEach((resource, key) => {
      try {
        register(key, resource, this.allowNonResources);
        this.registeredResources.add(key);
      } catch (e) {
        this.log('error', `Failed to register resource with key: ${key}`);
        if (e.stack) {
          this.log('debug', e.stack);
        }
      }
    });
  }

  getPackageJSON(): PackageJSON {
    return this.packageJSON;
  }

  getResourceByKey(key: string) {
    if (this.registeredResources.has(key)) {
      const resource = this.resources.get(key);
      if (!resource) {
        throw new Error(`Could not find in-memory resource with key: ${key}`);
      }
      return resource;
    }
    throw new Error(`Unregistered resource key: ${key}`);
  }
}
