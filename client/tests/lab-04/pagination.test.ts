import { describe,it,expect } from 'vitest';
import { paginationPages } from '../../src/utils/pagination.js';
describe('Bounded accessible page navigation',()=>{
 it('keeps every page for short lists and handles an empty list',()=>{expect(paginationPages(1,0)).toEqual([]);expect(paginationPages(2,3)).toEqual([1,2,3]);});
 it('centres a long-list window and keeps the last page reachable',()=>{expect(paginationPages(8,100)).toEqual([6,7,8,9,10]);expect(paginationPages(100,100)).toEqual([96,97,98,99,100]);});
 it('does not allocate or render billions of page controls',()=>{expect(paginationPages(1,2147483647)).toEqual([1,2,3,4,5]);});
});
