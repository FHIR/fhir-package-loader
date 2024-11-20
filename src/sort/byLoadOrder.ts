import { SortBy } from '../package';

export function byLoadOrder(ascending = true): SortBy {
  return {
    sortBy: 'LoadOrder',
    ascending
  };
}
