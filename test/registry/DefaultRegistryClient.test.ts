import type { BasePackageLoaderOptions } from '../../src/loader/BasePackageLoader';
import { DefaultRegistryClient } from '../../src/registry/DefaultRegistryClient';
import { FHIRRegistryClient } from '../../src/registry/FHIRRegistryClient';
import { NPMRegistryClient } from '../../src/registry/NPMRegistryClient';
import { loggerSpy } from '../testhelpers';

describe('DefaultRegistryClient', () => {
  describe('#constructor', () => {
    beforeEach(() => {
      loggerSpy.reset();
      delete process.env.FPL_REGISTRY;
    });

    it('should make a client with custom registry when it has been specified', () => {
      process.env.FPL_REGISTRY = 'https://custom-registry.example.org';
      const defaultClient = new DefaultRegistryClient({ log: loggerSpy.log });
      expect(defaultClient.clients).toHaveLength(1);
      expect(defaultClient.clients[0]).toHaveProperty(
        'endpoint',
        'https://custom-registry.example.org'
      );
      expect(defaultClient.clients[0]).toBeInstanceOf(NPMRegistryClient);
    });

    it('should make a client with fhir registries if no custom registry specified', () => {
      const defaultClient = new DefaultRegistryClient({ log: loggerSpy.log });
      expect(defaultClient.clients).toHaveLength(2);
      expect(defaultClient.clients[0]).toHaveProperty('endpoint', 'https://packages.fhir.org');
      expect(defaultClient.clients[0]).toBeInstanceOf(FHIRRegistryClient);
      expect(defaultClient.clients[1]).toHaveProperty(
        'endpoint',
        'https://packages2.fhir.org/packages'
      );
      expect(defaultClient.clients[1]).toBeInstanceOf(FHIRRegistryClient);
    });

    it('should not throw when instantiated in subclass constructor before super()', () => {
      // Define a base class
      class BaseClass {
        registryClient: DefaultRegistryClient;
        constructor(registryClient: DefaultRegistryClient) {
          this.registryClient = registryClient;
        }
      }

      // Define a subclass that extends BaseClass
      class SubClass extends BaseClass {
        private fplLogInterceptor = (level: string, message: string) => {
          console.log(`FPL Log Interceptor - Level: ${level}, Message: ${message}`);
        };

        constructor() {
          // Create DefaultRegistryClient before calling super()
          const options: BasePackageLoaderOptions = {
            log: (level: string, message: string) => {
              this.fplLogInterceptor(level, message);
            }
          };
          const registryClient = new DefaultRegistryClient(options);
          super(registryClient);
        }
      }

      // This should not throw an exception
      process.env.FPL_REGISTRY = 'http://custom-registry.example.org';

      expect(() => {
        new SubClass();
      }).not.toThrow();
    });
  });
});
