import path from 'path';
import { DiskBasedVirtualPackage } from '../../src/virtual/DiskBasedVirtualPackage';
import { loggerSpy } from '../testhelpers';

describe('DiskBasedVirtualPackage', () => {
  const local1Folder = path.resolve(__dirname, 'fixtures', 'local1');
  const local2Folder = path.resolve(__dirname, 'fixtures', 'local2');

  function expectCallFn(registerFn: any, root: string) {
    return (
      callNum: number,
      fileName: string,
      resourceType: string,
      id: string,
      allowNonResources = false
    ) => {
      expect(registerFn).toHaveBeenNthCalledWith(
        callNum,
        path.join(root, fileName),
        expect.objectContaining({ id, resourceType }),
        allowNonResources
      );
    };
  }

  beforeEach(() => {
    loggerSpy.reset();
  });

  describe('#registerResources', () => {
    it('should not register any resources when no paths were provided', async () => {
      const registerFn = jest.fn();
      const vPack = new DiskBasedVirtualPackage({ name: 'vpack', version: '1.0.0' });
      await vPack.registerResources(registerFn);
      expect(registerFn).toHaveBeenCalledTimes(0);
    });

    it('should register all potential resources in provided paths using default options', async () => {
      const registerFn = jest.fn();
      const vPack = new DiskBasedVirtualPackage(
        { name: 'vpack', version: '1.0.0' },
        [local1Folder, local2Folder],
        { log: loggerSpy.log }
      );
      await vPack.registerResources(registerFn);

      expect(registerFn).toHaveBeenCalledTimes(11);
      const expectL1 = expectCallFn(registerFn, local1Folder);
      const expectL2 = expectCallFn(registerFn, local2Folder);
      expectL1(1, 'CodeSystem-a-to-d.json', 'CodeSystem', 'a-to-d');
      expectL1(2, 'CodeSystem-x-to-z.xml', 'CodeSystem', 'x-to-z');
      expectL1(3, 'StructureDefinition-family-member.json', 'StructureDefinition', 'family-member');
      expectL1(
        4,
        'StructureDefinition-human-being-logical-model.json',
        'StructureDefinition',
        'human-being-logical-model'
      );
      expectL1(5, 'StructureDefinition-true-false.xml', 'StructureDefinition', 'true-false');
      expectL1(
        6,
        'StructureDefinition-valued-observation.json',
        'StructureDefinition',
        'valued-observation'
      );
      expectL1(7, 'ValueSet-beginning-and-end.json', 'ValueSet', 'beginning-and-end');
      expectL2(
        8,
        'Binary-LogicalModelExample.json',
        'CustomLogicalModel',
        'example-json-logical-model'
      );
      expectL2(9, 'Observation-A1Example.xml', 'Observation', 'A1Example');
      expectL2(10, 'Observation-B2Example.json', 'Observation', 'B2Example');
      expectL2(11, 'Patient-JamesPondExample.json', 'Patient', 'JamesPondExample');

      expect(
        loggerSpy
          .getAllMessages('debug')
          .some(m => /^Skipped spreadsheet XML file: .*resources-spreadsheet\.xml$/.test(m))
      ).toBeTruthy();
      expect(
        loggerSpy
          .getAllMessages('debug')
          .some(m =>
            /^Skipped spreadsheet XML file: .*sneaky-spread-like-bread-sheet\.xml$/.test(m)
          )
      ).toBeTruthy();
      expect(
        loggerSpy
          .getAllMessages('debug')
          .some(m => /^Skipped non-JSON \/ non-XML file: .*not-a-resource\.txt$/.test(m))
      ).toBeTruthy();
      expect(loggerSpy.getAllLogs('info')).toHaveLength(2);
      expect(loggerSpy.getFirstMessage('info')).toMatch(
        /Found 2 spreadsheet\(s\) in directory: .*local1\./
      );
      expect(loggerSpy.getLastMessage('info')).toMatch(
        /Found 1 non-JSON \/ non-XML file\(s\) in directory: .*local2\./
      );
      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should register all resources for direct paths to files', async () => {
      const registerFn = jest.fn();
      const vPack = new DiskBasedVirtualPackage(
        { name: 'vpack', version: '1.0.0' },
        [
          path.join(local1Folder, 'StructureDefinition-valued-observation.json'),
          path.join(local2Folder, 'Observation-A1Example.xml')
        ],
        { log: loggerSpy.log }
      );
      await vPack.registerResources(registerFn);

      expect(registerFn).toHaveBeenCalledTimes(2);
      const expectL1 = expectCallFn(registerFn, local1Folder);
      const expectL2 = expectCallFn(registerFn, local2Folder);
      expectL1(
        1,
        'StructureDefinition-valued-observation.json',
        'StructureDefinition',
        'valued-observation'
      );
      expectL2(2, 'Observation-A1Example.xml', 'Observation', 'A1Example');

      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should register potential resources allowing non-resources when allowNonResources option is true', async () => {
      const registerFn = jest.fn();
      const vPack = new DiskBasedVirtualPackage(
        { name: 'vpack', version: '1.0.0' },
        [local2Folder],
        { allowNonResources: true, log: loggerSpy.log }
      );
      await vPack.registerResources(registerFn);

      expect(registerFn).toHaveBeenCalledTimes(4);
      const expectL2 = expectCallFn(registerFn, local2Folder);
      expectL2(
        1,
        'Binary-LogicalModelExample.json',
        'CustomLogicalModel',
        'example-json-logical-model',
        true
      );
      expectL2(2, 'Observation-A1Example.xml', 'Observation', 'A1Example', true);
      expectL2(3, 'Observation-B2Example.json', 'Observation', 'B2Example', true);
      expectL2(4, 'Patient-JamesPondExample.json', 'Patient', 'JamesPondExample', true);

      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should register nested potential resources when recursive option is true', async () => {
      const registerFn = jest.fn();
      const vPack = new DiskBasedVirtualPackage(
        { name: 'vpack', version: '1.0.0' },
        [local2Folder],
        { recursive: true, log: loggerSpy.log }
      );
      await vPack.registerResources(registerFn);

      expect(registerFn).toHaveBeenCalledTimes(6);
      const expectL2 = expectCallFn(registerFn, local2Folder);
      expectL2(
        1,
        'Binary-LogicalModelExample.json',
        'CustomLogicalModel',
        'example-json-logical-model'
      );
      expectL2(2, 'Observation-A1Example.xml', 'Observation', 'A1Example');
      expectL2(3, 'Observation-B2Example.json', 'Observation', 'B2Example');
      expectL2(4, 'Patient-JamesPondExample.json', 'Patient', 'JamesPondExample');
      expectL2(
        5,
        path.join('nested', 'Patient-NestedJamesPondExample.json'),
        'Patient',
        'NestedJamesPondExample'
      );
      expectL2(
        6,
        path.join('nested', 'doublyNested', 'Observation-DoublyNestedB2Example.json'),
        'Observation',
        'DoublyNestedB2Example'
      );

      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should gracefully handle errors thrown from the register function', async () => {
      const registerFn = jest.fn().mockImplementation((file: string) => {
        if (file.endsWith('Observation-B2Example.json')) {
          throw new Error('Problem with B2Example');
        }
      });
      const vPack = new DiskBasedVirtualPackage(
        { name: 'vpack', version: '1.0.0' },
        [local2Folder],
        { log: loggerSpy.log }
      );
      await vPack.registerResources(registerFn);

      expect(registerFn).toHaveBeenCalledTimes(4);
      const expectL2 = expectCallFn(registerFn, local2Folder);
      expectL2(
        1,
        'Binary-LogicalModelExample.json',
        'CustomLogicalModel',
        'example-json-logical-model'
      );
      expectL2(2, 'Observation-A1Example.xml', 'Observation', 'A1Example');
      expectL2(3, 'Observation-B2Example.json', 'Observation', 'B2Example');
      expectL2(4, 'Patient-JamesPondExample.json', 'Patient', 'JamesPondExample');

      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(1);
      expect(loggerSpy.getLastMessage('error')).toMatch(
        /Failed to register resource at path: .*Observation-B2Example\.json/
      );
    });
  });

  describe('#getPackageJSON', () => {
    it('should get the package JSON from the virtual package', () => {
      const vPack = new DiskBasedVirtualPackage(
        { name: 'vpack', version: '1.0.0', otherProp: 'otherValue' },
        [local1Folder]
      );
      expect(vPack.getPackageJSON()).toEqual({
        name: 'vpack',
        version: '1.0.0',
        otherProp: 'otherValue'
      });
    });
  });

  describe('#getResourceByKey', () => {
    let vPack: DiskBasedVirtualPackage;

    beforeEach(() => {
      const registerFn = jest.fn();
      vPack = new DiskBasedVirtualPackage(
        { name: 'vpack', version: '1.0.0' },
        [local1Folder, local2Folder],
        { log: loggerSpy.log }
      );
      vPack.registerResources(registerFn);
    });

    it('should return a valid JSON resource', () => {
      // DiskBasedVirtualPackage uses the filepath as the key
      const totalPath = path.resolve(local1Folder, 'StructureDefinition-valued-observation.json');
      const resource = vPack.getResourceByKey(totalPath);
      expect(resource).toBeDefined();
      expect(resource).toMatchObject({
        id: 'valued-observation',
        resourceType: 'StructureDefinition',
        type: 'Observation'
      });
      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should return a resource with an xml path where xml was converted to a resource', () => {
      const totalPath = path.resolve(local1Folder, 'StructureDefinition-true-false.xml');
      const resource = vPack.getResourceByKey(totalPath);
      expect(resource).toBeDefined();
      expect(resource).toMatchObject({
        id: 'true-false',
        resourceType: 'StructureDefinition',
        type: 'Extension'
      });
      expect(resource.xml).toBeUndefined();
      expect(loggerSpy.getAllLogs('warn')).toHaveLength(0);
      expect(loggerSpy.getAllLogs('error')).toHaveLength(0);
    });

    it('should throw error when path points to a xml file that cannot be converted to JSON', () => {
      // An unconvertible XML file won't be registered, so it can't be retrieved
      const totalPath = path.resolve(local2Folder, 'Binary-LogicalModelExample.xml');
      expect(() => {
        vPack.getResourceByKey(totalPath);
      }).toThrow(/Unregistered resource key: .*Binary-LogicalModelExample\.xml/);
    });

    it('should throw error when path points to file that is not xml or json', () => {
      const totalPath = path.resolve(local2Folder, 'not-a-resource.txt');
      expect(() => {
        vPack.getResourceByKey(totalPath);
      }).toThrow(/Unregistered resource key: .*not-a-resource\.txt/);
    });

    it('should throw error when path points to a folder', () => {
      const totalPath = path.resolve(local1Folder);
      expect(() => {
        vPack.getResourceByKey(totalPath);
      }).toThrow(/Unregistered resource key: .*local1/);
    });

    it('should throw error when path points to a xml file that does not exist', () => {
      const totalPath = path.resolve(local1Folder, 'example-file-that-doesnt-exist.xml');
      expect(() => {
        vPack.getResourceByKey(totalPath);
      }).toThrow(/Unregistered resource key: .*example-file-that-doesnt-exist\.xml/);
    });

    it('should throw error when path points to a json file that does not exist', () => {
      const totalPath = path.resolve(local1Folder, 'example-file-that-doesnt-exist.json');
      expect(() => {
        vPack.getResourceByKey(totalPath);
      }).toThrow(/Unregistered resource key: .*example-file-that-doesnt-exist\.json/);
    });

    it('should throw error when path points to an invalid file type that does not exist', () => {
      const totalPath = path.resolve(local1Folder, 'example-file-that-doesnt-exist.txt');
      expect(() => {
        vPack.getResourceByKey(totalPath);
      }).toThrow(/Unregistered resource key: .*example-file-that-doesnt-exist\.txt/);
    });
  });
});
