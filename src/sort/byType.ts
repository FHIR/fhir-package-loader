import { SortBy } from '../package';

export function byType(...type: string[]): SortBy {
  return {
    sortBy: 'Type',
    types: type
  };
}
