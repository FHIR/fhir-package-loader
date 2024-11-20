import { byLoadOrder } from '../../src/sort/byLoadOrder';

describe('#byLoadOrder', () => {
  it('should be ascending by default', () => {
    const result = byLoadOrder();
    expect(result).toEqual({
      sortBy: 'LoadOrder',
      ascending: true
    });
  });

  it('should be ascending when argument is true', () => {
    const result = byLoadOrder(true);
    expect(result).toEqual({
      sortBy: 'LoadOrder',
      ascending: true
    });
  });

  it('should be descending when argument is false', () => {
    const result = byLoadOrder(false);
    expect(result).toEqual({
      sortBy: 'LoadOrder',
      ascending: false
    });
  });
});
