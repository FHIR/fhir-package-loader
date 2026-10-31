import { Readable } from 'stream';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { DefaultRegistryClient } from '../../src/registry/DefaultRegistryClient';
import { axiosGet } from '../../src/utils/axiosUtils';

describe('axiosUtils', () => {
  let getSpy: jest.SpyInstance;

  beforeAll(() => {
    getSpy = jest.spyOn(axios, 'get');
    delete process.env.HTTPS_PROXY;
  });

  afterEach(() => {
    delete process.env.HTTPS_PROXY;
    getSpy.mockReset();
  });

  describe('#axiosGet', () => {
    it('releases failed response streams before falling back to another registry', async () => {
      const failedStream = Readable.from(['Not found']);
      const tarballStream = Readable.from(['tarball']);
      getSpy
        .mockRejectedValueOnce({ response: { status: 404, data: failedStream } })
        .mockResolvedValueOnce({ status: 200, data: tarballStream });
      // Explicitly use the built-in registries regardless of the environment.
      const previousRegistry = process.env.FPL_REGISTRY;
      delete process.env.FPL_REGISTRY;
      try {
        const result = await new DefaultRegistryClient({}).download('us.nlm.vsac', '0.24.0');
        expect(result).toBe(tarballStream);
        expect(failedStream.destroyed).toBeTrue();
        expect(tarballStream.destroyed).toBeFalse();
        expect(getSpy).toHaveBeenCalledTimes(2);
      } finally {
        if (previousRegistry !== undefined) process.env.FPL_REGISTRY = previousRegistry;
        tarballStream.destroy();
      }
    });

    it('releases a failed response stream and rethrows the original error', async () => {
      const data = Readable.from(['Server error']);
      const error = { response: { status: 500, data } };
      getSpy.mockRejectedValueOnce(error);
      await expect(
        axiosGet('https://example.org/package', { responseType: 'stream' })
      ).rejects.toBe(error);
      expect(data.destroyed).toBeTrue();
    });

    it('releases unauthorized response streams while still returning the response', async () => {
      const data = Readable.from(['Unauthorized']);
      const response = { status: 401, data };
      getSpy.mockRejectedValueOnce({ response });
      await expect(
        axiosGet('https://example.org/package', { responseType: 'stream' })
      ).resolves.toBe(response);
      expect(data.destroyed).toBeTrue();
    });

    it('preserves errors without a response when requesting a stream', async () => {
      const error = new Error('Connection failed');
      getSpy.mockRejectedValueOnce(error);
      await expect(
        axiosGet('https://example.org/package', { responseType: 'stream' })
      ).rejects.toBe(error);
    });

    it('preserves non-stream error responses', async () => {
      const response = { status: 401, data: { message: 'Unauthorized' } };
      getSpy.mockRejectedValueOnce({ response });
      await expect(axiosGet('https://example.org/package')).resolves.toBe(response);
    });

    it('returns get with responseType assigned when it is used as argument', async () => {
      getSpy.mockImplementationOnce(() => Promise.resolve({}));
      await axiosGet('packages.fhir.org/de.basisprofil.r4/1.1.0', { responseType: 'arraybuffer' });
      expect(getSpy).toHaveBeenCalledWith('packages.fhir.org/de.basisprofil.r4/1.1.0', {
        responseType: 'arraybuffer'
      });
    });

    it('returns get without responseType assigned by default', async () => {
      getSpy.mockImplementationOnce(() => Promise.resolve({}));
      await axiosGet('packages.fhir.org/de.basisprofil.r4/1.1.0');
      expect(getSpy).toHaveBeenCalledWith('packages.fhir.org/de.basisprofil.r4/1.1.0');
    });

    it('calls get with proxy agent when https env variable is set', async () => {
      getSpy.mockImplementationOnce(() => Promise.resolve({}));
      process.env.HTTPS_PROXY = 'https://127.0.0.1:2626';
      await axiosGet('packages.fhir.org/de.basisprofil.r4/1.1.0');
      expect(getSpy).toHaveBeenCalledOnce();
      const axiosGetArgs = getSpy.mock.calls[0];
      expect(axiosGetArgs[0]).toBe('packages.fhir.org/de.basisprofil.r4/1.1.0');
      expect(axiosGetArgs[1].proxy).toBeFalse();
      expect(axiosGetArgs[1].httpsAgent).toBeInstanceOf(HttpsProxyAgent);
      expect(axiosGetArgs[1].httpsAgent.proxy).toEqual(new URL('https://127.0.0.1:2626'));
    });
  });
});
