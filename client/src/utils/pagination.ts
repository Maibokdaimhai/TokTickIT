// A bounded window avoids overflowing narrow layouts or allocating all pages.
export function paginationPages(page: number, totalPages: number): number[] {
  const length = Math.min(5, Math.max(0, totalPages));
  const start = Math.max(1, Math.min(page - 2, totalPages - length + 1));
  return Array.from({ length }, (_, index) => start + index);
}
