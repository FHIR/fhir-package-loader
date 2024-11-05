import { byType } from '../../src/sort/byType';

describe('#byType', () => {
  it('should be empty type list by default', () => {
    const result = byType();
    expect(result).toEqual({
      sortBy: 'Type',
      types: []
    });
  });

  it('should preserve type order of args', () => {
    const result = byType('ValueSet', 'StructureDefinition', 'CodeSystem');
    expect(result).toEqual({
      sortBy: 'Type',
      types: ['ValueSet', 'StructureDefinition', 'CodeSystem']
    });
  });
});
