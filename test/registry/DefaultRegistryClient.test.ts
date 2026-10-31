import path from 'path';
import fs from 'fs-extra';
import nock from 'nock';
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

  describe('#download', () => {
    beforeEach(() => {
      jest.replaceProperty(process, 'env', {
        ...process.env,
        FPL_REGISTRY: '',
        HTTPS_PROXY: '',
        NO_PROXY: '*'
      });
      nock.disableNetConnect();
    });

    afterEach(() => {
      nock.cleanAll();
      nock.enableNetConnect();
      jest.restoreAllMocks();
    });

    it('should download an archive instead of metadata from the fallback when the primary returns 404', async () => {
      const archive = fs.readFileSync(
        path.join(__dirname, '..', 'cache', 'fixtures', 'tarballs', 'small-package.tgz')
      );
      const primary = nock('https://packages.fhir.org').get('/fhir.small/0.1.0').reply(404);
      const fallback = nock('https://packages2.fhir.org')
        .get('/packages/fhir.small/0.1.0')
        .reply(function () {
          if (this.req.headers.accept === 'application/octet-stream') {
            return [200, archive, { 'Content-Type': 'application/octet-stream' }];
          }
          return [
            200,
            {
              name: 'fhir.small',
              version: '0.1.0',
              dist: { tarball: 'https://packages2.fhir.org/packages/fhir.small/0.1.0' }
            },
            { 'Content-Type': 'application/json' }
          ];
        });
      const client = new DefaultRegistryClient({ log: loggerSpy.log });
      const result = await client.download('fhir.small', '0.1.0');
      const chunks: Buffer[] = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }

      expect(Buffer.concat(chunks).equals(archive)).toBe(true);
      primary.done();
      fallback.done();
    });
  });
});
