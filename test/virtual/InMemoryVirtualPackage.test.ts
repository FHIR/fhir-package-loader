import { InMemoryVirtualPackage } from '../../src/virtual/InMemoryVirtualPackage';
import { loggerSpy } from '../testhelpers';

describe('InMemoryVirtualPackage', () => {
  let resourceMap: Map<string, any>;

  beforeEach(() => {
    loggerSpy.reset();
    resourceMap = new Map<string, any>();
    resourceMap.set('Encounter-abc-123', { resourceType: 'Encounter', id: 'abc-123' });
    resourceMap.set('Observation-A', { resourceType: 'Observation', id: 'A' });
    resourceMap.set('Patient-1', { resourceType: 'Patient', id: '1' });
  });

  describe('#registerResources', () => {
    it('should not register any resources when empty map is provided', async () => {
      const registerFn = jest.fn();
      const vPack = new InMemoryVirtualPackage(
        { name: 'vpack', version: '1.0.0' },
        new Map<string, any>()
      );
      await vPack.registerResources(registerFn);
      expect(registerFn).toHaveBeenCalledTimes(0);
    });

    it('should register all resources in provided map using default options', async () => {
      const registerFn = jest.fn();
      const vPack = new InMemoryVirtualPackage({ name: 'vpack', version: '1.0.0' }, resourceMap, {
        log: loggerSpy.log
      });
      await vPack.registerResources(registerFn);

      expect(registerFn).toHaveBeenCalledTimes(3);
      expect(registerFn).toHaveBeenNthCalledWith(
        1,
        'Encounter-abc-123',
        { resourceType: 'Encounter', id: 'abc-123' },
        false
      );
      expect(registerFn).toHaveBeenNthCalledWith(
        2,
        'Observation-A',
        { resourceType: 'Observation', id: 'A' },
        false
      );
      expect(registerFn).toHaveBeenNthCalledWith(
        3,
        'Patient-1',
        { resourceType: 'Patient', id: '1' },
        false
      );

      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should register all resources in provided map allowing non-resources when allowNonResources option is true', async () => {
      const registerFn = jest.fn();
      const vPack = new InMemoryVirtualPackage({ name: 'vpack', version: '1.0.0' }, resourceMap, {
        allowNonResources: true,
        log: loggerSpy.log
      });
      await vPack.registerResources(registerFn);

      expect(registerFn).toHaveBeenCalledTimes(3);
      expect(registerFn).toHaveBeenNthCalledWith(
        1,
        'Encounter-abc-123',
        { resourceType: 'Encounter', id: 'abc-123' },
        true
      );
      expect(registerFn).toHaveBeenNthCalledWith(
        2,
        'Observation-A',
        { resourceType: 'Observation', id: 'A' },
        true
      );
      expect(registerFn).toHaveBeenNthCalledWith(
        3,
        'Patient-1',
        { resourceType: 'Patient', id: '1' },
        true
      );

      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should gracefully handle errors thrown from the register function', async () => {
      const registerFn = jest.fn().mockImplementation((key: string) => {
        if (key === 'Observation-A') {
          throw new Error('Problem with Observation-A');
        }
      });
      const vPack = new InMemoryVirtualPackage({ name: 'vpack', version: '1.0.0' }, resourceMap, {
        log: loggerSpy.log
      });
      await vPack.registerResources(registerFn);

      expect(registerFn).toHaveBeenCalledTimes(3);
      expect(registerFn).toHaveBeenNthCalledWith(
        1,
        'Encounter-abc-123',
        { resourceType: 'Encounter', id: 'abc-123' },
        false
      );
      expect(registerFn).toHaveBeenNthCalledWith(
        2,
        'Observation-A',
        { resourceType: 'Observation', id: 'A' },
        false
      );
      expect(registerFn).toHaveBeenNthCalledWith(
        3,
        'Patient-1',
        { resourceType: 'Patient', id: '1' },
        false
      );

      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(1);
      expect(loggerSpy.getLastMessage('error')).toMatch(
        'Failed to register resource with key: Observation-A'
      );
    });
  });

  describe('#getPackageJSON', () => {
    it('should get the package JSON from the virtual package', () => {
      const vPack = new InMemoryVirtualPackage(
        { name: 'vpack', version: '1.0.0', otherProp: 'otherValue' },
        resourceMap
      );
      expect(vPack.getPackageJSON()).toEqual({
        name: 'vpack',
        version: '1.0.0',
        otherProp: 'otherValue'
      });
    });
  });

  describe('#getResourceByKey', () => {
    let vPack: InMemoryVirtualPackage;
    beforeEach(() => {
      const registerFn = jest.fn().mockImplementation((key: string) => {
        if (key === 'Observation-A') {
          throw new Error('Problem with Observation-A');
        }
      });
      vPack = new InMemoryVirtualPackage({ name: 'vpack', version: '1.0.0' }, resourceMap, {
        log: loggerSpy.log
      });
      vPack.registerResources(registerFn);
      // reset the logger again since we expect the setup code to log an error during registration
      loggerSpy.reset();
    });

    it('should return a valid registered resource', () => {
      const resource = vPack.getResourceByKey('Patient-1');
      expect(resource).toBeDefined();
      expect(resource).toMatchObject({
        id: '1',
        resourceType: 'Patient'
      });
      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should throw error when getting a key that was in the map but failed registration', () => {
      expect(() => {
        vPack.getResourceByKey('Observation-A');
      }).toThrow(/Unregistered resource key: Observation-A/);
    });

    it('should throw error when getting a key that was in the map but removed from the map after', () => {
      // The map ought not be modified, but just in case someone does it
      resourceMap.delete('Patient-1');
      expect(() => {
        vPack.getResourceByKey('Patient-1');
      }).toThrow(/Could not find in-memory resource with key: Patient-1/);
    });

    it('should throw error when getting a key that was not in the resource map', () => {
      expect(() => {
        vPack.getResourceByKey('SomeResource-5');
      }).toThrow(/Unregistered resource key: SomeResource-5/);
    });
  });
});
