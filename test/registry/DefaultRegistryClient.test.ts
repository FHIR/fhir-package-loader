import { DefaultRegistryClient } from '../../src/registry/DefaultRegistryClient';
import { loggerSpy } from '../testhelpers';

describe('DefaultRegistryClient', () => {
  describe('#constructor', () => {
    beforeEach(() => {
      loggerSpy.reset();
      delete process.env.FPL_REGISTRY;
    });
    afterEach(() => {});

    it('should make a custom registry client when specified', () => {
      process.env.FPL_REGISTRY = 'https://custom-registry.example.org/';
      new DefaultRegistryClient({ log: loggerSpy.log });
      expect(loggerSpy.getLastMessage('info')).toBe(
        'Using custom registry specified by FPL_REGISTRY environment variable: https://custom-registry.example.org/'
      );
    });

    it('should use the first default set for a custom registry client when specified', () => {
      process.env.FPL_REGISTRY = 'https://custom-registry.example.org/';
      new DefaultRegistryClient({ log: loggerSpy.log });
      // expect(loggerSpy.getLastMessage('info')).toBe('Using custom registry specified by FPL_REGISTRY environment variable: https://custom-registry.example.org/');

      process.env.FPL_REGISTRY = 'https://custom-registry-second.example.org/';
      new DefaultRegistryClient({ log: loggerSpy.log });
      // expect(loggerSpy.getLastMessage('info')).toBe('Using custom registry specified by FPL_REGISTRY environment variable: https://custom-registry.example.org/');
    });

    it('should make a FHIR registry client when custom registry not specified', () => {
      new DefaultRegistryClient({ log: loggerSpy.log });
      expect(loggerSpy.getLastMessage('info')).toBeUndefined();
    });
  });
});
