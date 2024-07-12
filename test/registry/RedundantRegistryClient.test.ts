import { RedundantRegistryClient } from '../../src/registry/RedundantRegistryClient';
import { loggerSpy } from '../testhelpers';
import { Readable } from 'stream';

class MyMockClient {
  public endpoint: string;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
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
      const latest = await client.download('hl7.terminology.r4', '1.1.2');

      // should get first client specified that doesn't throw error
      expect(latest).toBeDefined();
      expect(latest).toBeInstanceOf(Readable);
      expect(latest.read()).toBe(
        'MyMockDownload of hl7.terminology.r4#1.1.2 from https://packages.fhir.org/hl7.terminology.r4/1.1.2'
      );
    });

    it('should download the second client specified (NPM client) if first is unable to download', async () => {
      const mockClient1 = new MyMockClient('failed.to.download');
      const mockClient2 = new MyMockClient('https://packages-second-client.fhir.org');
      const client = new RedundantRegistryClient([mockClient1, mockClient2], {
        log: loggerSpy.log
      });
      const latest = await client.download('hl7.terminology.r4', '1.1.2');

      // will get second client specified since first throw error and goes to next client
      expect(latest).toBeDefined();
      expect(latest).toBeInstanceOf(Readable);
      expect(latest.read()).toBe(
        'MyMockDownload of hl7.terminology.r4#1.1.2 from https://packages-second-client.fhir.org/hl7.terminology.r4/1.1.2'
      );
    });

    it('should throw error when no package server provided', async () => {
      const client = new RedundantRegistryClient([], { log: loggerSpy.log });
      const latest = client.download('hl7.terminology.r4', '1.1.2');
      expect(latest).rejects.toThrow(Error);
      expect(latest).rejects.toThrow('Failed to download hl7.terminology.r4#1.1.2');
    });

    it('should throw error when all package servers provided fail', async () => {
      const mockClient1 = new MyMockClient('failed.to.download');
      const mockClient2 = new MyMockClient('failed.to.download');
      const client = new RedundantRegistryClient([mockClient1, mockClient2], {
        log: loggerSpy.log
      });
      const latest = client.download('hl7.terminology.r4', '1.1.2');
      expect(latest).rejects.toThrow(Error);
      expect(latest).rejects.toThrow('Failed to download hl7.terminology.r4#1.1.2');
    });
  });
});
