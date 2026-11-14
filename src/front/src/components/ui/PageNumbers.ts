/** A page number, or a gap standing for the pages left out. */
export type PageItem = number | "gap";

/** Which page numbers a pager shows: the first, the last and the ones around the current page. */
export class PageNumbers {
  /** Number of pages needed for `total` rows, at least one. */
  static count(total: number, pageSize: number): number {
    return Math.max(1, Math.ceil(total / pageSize));
  }

  /** Pages from 1; `current` is the page being shown. */
  static window(current: number, count: number): PageItem[] {
    const wanted = new Set([1, count, current - 1, current, current + 1]);
    const pages = [...wanted].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
    const items: PageItem[] = [];
    pages.forEach((page, index) => {
      const previous = pages[index - 1];
      if (previous !== undefined && page - previous === 2) {
        items.push(previous + 1);
      } else if (previous !== undefined && page - previous > 2) {
        items.push("gap");
      }
      items.push(page);
    });
    return items;
  }
}
