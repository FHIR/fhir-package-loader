import { Readable } from 'stream';

import { LatestVersionUnavailableError } from '../../src/errors';
import { RedundantRegistryClient } from '../../src/registry/RedundantRegistryClient';
import { RegistryClient } from '../../src/registry/RegistryClient';
import { loggerSpy } from '../testhelpers';

class MyMockClient implements RegistryClient {
  public endpoint: string;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async resolveVersion(name: string, version: string): Promise<string> {
    return version;
  }

  async download(name: string, version: string): Promise<Readable> {
    // to mimic failure of download
    if (this.endpoint == 'failed.to.download') throw new Error('Failed to download');

    return Readable.from([
      `MyMockDownload of ${name}#${version} from ${this.endpoint}/${name}/${version}`
    ]);
  }
}

describe('RedundantRegistryClient', () => {
  describe('#resolveVersion', () => {
    beforeEach(() => {
      loggerSpy.reset();
    });

    it('should resolve using the first client specified', async () => {
      const mockClient1 = new MyMockClient('https://first.packages.server.org');
      jest.spyOn(mockClient1, 'resolveVersion').mockResolvedValue('4.6.8');
      const mockClient2 = new MyMockClient('https://second.packages.server.org');
      const client = new RedundantRegistryClient([mockClient1, mockClient2], {
        log: loggerSpy.log
      });
      const latest = await client.resolveVersion('my.favorite.package', 'latest');
      expect(latest).toEqual('4.6.8');
    });

    it('should resolve using the second client specified if the first cannot resolve the version', async () => {
      const mockClient1 = new MyMockClient('https://first.packages.server.org');
      jest
        .spyOn(mockClient1, 'resolveVersion')
        .mockRejectedValue(new LatestVersionUnavailableError('my.favorite.package'));
      const mockClient2 = new MyMockClient('https://second.packages.server.org');
      jest.spyOn(mockClient2, 'resolveVersion').mockResolvedValue('9.8.7');
      const client = new RedundantRegistryClient([mockClient1, mockClient2], {
        log: loggerSpy.log
      });
      const latest = await client.resolveVersion('my.favorite.package', 'latest');
      expect(latest).toEqual('9.8.7');
    });

    it('should throw error when no package server provided', async () => {
      const client = new RedundantRegistryClient([], { log: loggerSpy.log });
      const latest = client.resolveVersion('my.favorite.package', 'latest');
      await expect(latest).rejects.toThrow(Error);
      await expect(latest).rejects.toThrow(
        'Failed to resolve version for my.favorite.package#latest'
      );
    });

    it('should throw error when all package servers provided fail', async () => {
      const mockClient1 = new MyMockClient('https://first.packages.server.org');
      jest
        .spyOn(mockClient1, 'resolveVersion')
        .mockRejectedValue(new LatestVersionUnavailableError('my.favorite.package'));
      const mockClient2 = new MyMockClient('https://second.packages.server.org');
      jest
        .spyOn(mockClient2, 'resolveVersion')
        .mockRejectedValue(new LatestVersionUnavailableError('my.favorite.package'));
      const client = new RedundantRegistryClient([mockClient1, mockClient2], {
        log: loggerSpy.log
      });
      const latest = client.resolveVersion('my.favorite.package', 'latest');
      await expect(latest).rejects.toThrow(Error);
      await expect(latest).rejects.toThrow(
        'Failed to resolve version for my.favorite.package#latest'
      );
    });
  });

  describe('#download', () => {
    beforeEach(() => {
      loggerSpy.reset();
    });

    it('should download the first client specified (FHIR client)', async () => {
      const mockClient1 = new MyMockClient('https://packages.fhir.org');
      const mockClient2 = new MyMockClient('failed.to.download');
      const client = new RedundantRegistryClient([mockClient1, mockClient2], {
        log: loggerSpy.log
      });
      const result = await client.download('hl7.terminology.r4', '1.1.2');

      // should get first client specified that doesn't throw error
      expect(result).toBeInstanceOf(Readable);
      expect(result.read()).toBe(
        'MyMockDownload of hl7.terminology.r4#1.1.2 from https://packages.fhir.org/hl7.terminology.r4/1.1.2'
      );
    });

    it('should download the second client specified (NPM client) if first is unable to download', async () => {
      const mockClient1 = new MyMockClient('failed.to.download');
      const mockClient2 = new MyMockClient('https://packages-second-client.fhir.org');
      const client = new RedundantRegistryClient([mockClient1, mockClient2], {
        log: loggerSpy.log
      });
      const result = await client.download('hl7.terminology.r4', '1.1.2');

      // will get second client specified since first throw error and goes to next client
      expect(result).toBeInstanceOf(Readable);
      expect(result.read()).toBe(
        'MyMockDownload of hl7.terminology.r4#1.1.2 from https://packages-second-client.fhir.org/hl7.terminology.r4/1.1.2'
      );
    });

    it('should throw error when no package server provided', async () => {
      const client = new RedundantRegistryClient([], { log: loggerSpy.log });
      const result = client.download('hl7.terminology.r4', '1.1.2');
      await expect(result).rejects.toThrow(Error);
      await expect(result).rejects.toThrow('Failed to download hl7.terminology.r4#1.1.2');
    });

    it('should throw error when all package servers provided fail', async () => {
      const mockClient1 = new MyMockClient('failed.to.download');
      const mockClient2 = new MyMockClient('failed.to.download');
      const client = new RedundantRegistryClient([mockClient1, mockClient2], {
        log: loggerSpy.log
      });
      const result = client.download('hl7.terminology.r4', '1.1.2');
      await expect(result).rejects.toThrow(Error);
      await expect(result).rejects.toThrow('Failed to download hl7.terminology.r4#1.1.2');
    });
  });
});
