import path from 'path';
import { text } from 'stream/consumers';
import axios from 'axios';
import fs from 'fs-extra';
import nock from 'nock';
import type { BasePackageLoaderOptions } from '../../src/loader/BasePackageLoader';
import { DefaultRegistryClient } from '../../src/registry/DefaultRegistryClient';
import { FHIRRegistryClient } from '../../src/registry/FHIRRegistryClient';
import { NPMRegistryClient } from '../../src/registry/NPMRegistryClient';
import { loggerSpy } from '../testhelpers';

describe('DefaultRegistryClient', () => {
  describe('#constructor', () => {
    let envMock: ReturnType<typeof jest.replaceProperty>;

    beforeEach(() => {
      loggerSpy.reset();
      const env = { ...process.env };
      delete env.FPL_REGISTRY;
      delete env.FPL_REGISTRY_TOKEN;
      envMock = jest.replaceProperty(process, 'env', env);
    });

    afterEach(() => {
      envMock.restore();
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

    it.each([undefined, ''])('should use FHIR registries with FPL_REGISTRY=%s', registry => {
      if (registry !== undefined) {
        process.env.FPL_REGISTRY = registry;
      }
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

    it.each([
      ['["https://registry.example.org/packages/"]', ['https://registry.example.org/packages']],
      [
        ' ["https://registry.example.org/a,b", "http://fallback.example.org/"] ',
        ['https://registry.example.org/a,b', 'http://fallback.example.org']
      ]
    ])('should create ordered NPM clients for %s', (registry, endpoints) => {
      process.env.FPL_REGISTRY = registry;
      const client = new DefaultRegistryClient();
      expect(client.clients.map(entry => (entry as NPMRegistryClient).endpoint)).toEqual(endpoints);
      client.clients.forEach(entry => expect(entry).toBeInstanceOf(NPMRegistryClient));
    });

    it.each([
      ['[]', 'at least one registry URL'],
      ['["https://registry.example.org",', 'must be a JSON array'],
      ['["https://registry.example.org", 42]', 'entry 2'],
      ['[""]', 'entry 1'],
      ['["/packages"]', 'entry 1'],
      ['["http://"]', 'entry 1'],
      ['["ftp://registry.example.org/packages"]', 'entry 1'],
      ['["https://user:password@registry.example.org"]', 'entry 1'],
      ['["https://registry.example.org?query"]', 'entry 1'],
      ['["https://registry.example.org#fragment"]', 'entry 1']
    ])('should reject invalid registry array %s', (registry, error) => {
      process.env.FPL_REGISTRY = registry;
      expect(() => new DefaultRegistryClient()).toThrow(new RegExp(`FPL_REGISTRY.*${error}`));
    });

    it.each([
      ['["a",', 'must be a JSON array'],
      ['secret', 'must be a JSON array'],
      ['"secret"', 'must be a JSON array'],
      ['[]', 'same number of entries'],
      ['["secret", ""]', 'same number of entries'],
      ['[null]', 'entry 1 must be a string']
    ])('should reject invalid token configuration %s', (tokens, error) => {
      process.env.FPL_REGISTRY = '["https://registry.example.org"]';
      process.env.FPL_REGISTRY_TOKEN = tokens;
      expect(() => new DefaultRegistryClient()).toThrow(
        new RegExp(`^FPL_REGISTRY_TOKEN.*${error}`)
      );
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

  describe('custom registry array', () => {
    const registry = 'https://registry.example.org';
    const fallback = 'https://fallback.example.org';
    const tarball = '/package/-/package-1.0.0.tgz';

    beforeEach(() => {
      jest.replaceProperty(process, 'env', {
        ...process.env,
        FPL_REGISTRY: JSON.stringify([registry, fallback]),
        FPL_REGISTRY_TOKEN: '',
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

    it('should stop at the first successful registry when the token variable is empty', async () => {
      const primary = nock(registry, { badheaders: ['authorization'] })
        .get('/package')
        .reply(200, {})
        .get(tarball)
        .reply(200, 'primary');
      const secondary = nock(fallback).get('/package').reply(200, {});

      const client = new DefaultRegistryClient();
      expect(await text(await client.download('package', '1.0.0'))).toBe('primary');
      primary.done();
      expect(secondary.isDone()).toBe(false);
    });

    it.each([404, 401])('should fall back after HTTP %i', async status => {
      process.env.FPL_REGISTRY_TOKEN = '["first-token", "second-token"]';
      const primary = nock(registry, { reqheaders: { authorization: 'Bearer first-token' } })
        .get('/package')
        .reply(status)
        .get(tarball)
        .reply(status);
      const secondary = nock(fallback, { reqheaders: { authorization: 'Bearer second-token' } })
        .get('/package')
        .reply(() => {
          primary.done();
          return [200, {}];
        })
        .get(tarball)
        .reply(200, 'fallback');

      const client = new DefaultRegistryClient();
      expect(await text(await client.download('package', '1.0.0'))).toBe('fallback');
      secondary.done();
    });

    it('should fall back when a download fails with a network error', async () => {
      const get = jest
        .spyOn(axios, 'get')
        .mockRejectedValueOnce(new Error('Connection closed'))
        .mockRejectedValueOnce(new Error('Connection closed'));
      const secondary = nock(fallback)
        .get('/package')
        .reply(200, {})
        .get(tarball)
        .reply(200, 'fallback');

      const client = new DefaultRegistryClient();
      expect(await text(await client.download('package', '1.0.0'))).toBe('fallback');
      expect(get).toHaveBeenNthCalledWith(2, `${registry}${tarball}`, { responseType: 'stream' });
      secondary.done();
    });

    it('should fail after every registry has been tried', async () => {
      const attempts = [registry, fallback].map(endpoint =>
        nock(endpoint).get('/package').reply(404).get(tarball).reply(404)
      );

      await expect(new DefaultRegistryClient().download('package', '1.0.0')).rejects.toThrow(
        'Failed to download package#1.0.0'
      );
      attempts.forEach(attempt => attempt.done());
    });

    it('should fall back when a registry has no matching version', async () => {
      const primary = nock(registry)
        .get('/package')
        .reply(200, { versions: { '2.0.0': {} } });
      const secondary = nock(fallback)
        .get('/package')
        .reply(200, { versions: { '1.0.0': {} } });

      await expect(new DefaultRegistryClient().resolveVersion('package', '1.0.x')).resolves.toBe(
        '1.0.0'
      );
      primary.done();
      secondary.done();
    });

    it.each(['latest', '1.0.x'])(
      'should keep the resolved %s version when downloading from a fallback',
      async version => {
        process.env.FPL_REGISTRY_TOKEN = '["first-token", ""]';
        const primary = nock(registry, { reqheaders: { authorization: 'Bearer first-token' } })
          .get('/package')
          .reply(200, { 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': {} } })
          .get('/package')
          .reply(200, {})
          .get(tarball)
          .reply(404);
        const secondary = nock(fallback, { badheaders: ['authorization'] })
          .get('/package')
          .reply(200, { 'dist-tags': { latest: '0.9.0' } })
          .get(tarball)
          .reply(200, 'fallback');

        const client = new DefaultRegistryClient();
        const resolved = await client.resolveVersion('package', version);
        expect(resolved).toBe('1.0.0');
        expect(await text(await client.download('package', resolved))).toBe('fallback');
        primary.done();
        secondary.done();
      }
    );

    it('should download an external tarball without either registry token', async () => {
      process.env.FPL_REGISTRY_TOKEN = '["first-token", "second-token"]';
      const primary = nock(registry, { reqheaders: { authorization: 'Bearer first-token' } })
        .get('/package')
        .reply(200, { versions: { '1.0.0': { dist: { tarball: `${fallback}${tarball}` } } } });
      const archive = nock(fallback, { badheaders: ['authorization'] })
        .get(tarball)
        .reply(200, 'archive');

      const client = new DefaultRegistryClient();
      expect(await text(await client.download('package', '1.0.0'))).toBe('archive');
      primary.done();
      archive.done();
    });

    it('should fall back without sending a token to an invalid tarball URL', async () => {
      process.env.FPL_REGISTRY_TOKEN = '["first-token", ""]';
      const invalidUrl = 'https://[';
      const get = jest.spyOn(axios, 'get');
      const primary = nock(registry, { reqheaders: { authorization: 'Bearer first-token' } })
        .get('/package')
        .reply(200, { versions: { '1.0.0': { dist: { tarball: invalidUrl } } } });
      const secondary = nock(fallback)
        .get('/package')
        .reply(200, {})
        .get(tarball)
        .reply(200, 'fallback');

      const client = new DefaultRegistryClient();
      expect(await text(await client.download('package', '1.0.0'))).toBe('fallback');
      expect(get).toHaveBeenCalledWith(invalidUrl, { responseType: 'stream' });
      primary.done();
      secondary.done();
    });

    it.each([
      ['/packages-other/archive.tgz', undefined],
      ['/packages/private/archive.tgz', 'Bearer first-token']
    ])(
      'should apply the registry base path when redirecting to %s',
      async (target, authorization) => {
        process.env.FPL_REGISTRY = JSON.stringify([
          `${registry}/packages`,
          `${registry}/packages/private`
        ]);
        process.env.FPL_REGISTRY_TOKEN = '["first-token", "second-token"]';
        const primary = nock(registry, { reqheaders: { authorization: 'Bearer first-token' } })
          .get('/packages/package')
          .reply(200, {})
          .get(`/packages${tarball}`)
          .reply(302, '', { Location: '/packages/archive.tgz' })
          .get('/packages/archive.tgz')
          .reply(302, '', { Location: target });
        const archive = nock(
          registry,
          authorization ? { reqheaders: { authorization } } : { badheaders: ['authorization'] }
        )
          .get(target)
          .reply(200, 'archive');

        const client = new DefaultRegistryClient();
        expect(await text(await client.download('package', '1.0.0'))).toBe('archive');
        primary.done();
        archive.done();
      }
    );
  });
});
