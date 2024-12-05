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
      expect(loggerSpy.getLastMessage('info')).toBe(
        'Using custom registry specified by FPL_REGISTRY environment variable: https://custom-registry.example.org'
      );
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
  });
});
