import { describe, expect, it } from "vitest";

import { PageNumbers } from "./PageNumbers";

describe("PageNumbers", () => {
  it.each([
    [0, 50, 1],
    [1, 50, 1],
    [50, 50, 1],
    [51, 50, 2],
    [142, 50, 3],
  ])("needs the pages it needs for %i rows of %i", (total, size, pages) => {
    expect(PageNumbers.count(total, size)).toBe(pages);
  });

  it("shows every page when there are few", () => {
    expect(PageNumbers.window(1, 1)).toEqual([1]);
    expect(PageNumbers.window(1, 3)).toEqual([1, 2, 3]);
    expect(PageNumbers.window(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("shows the first, the last and the neighbours, with gaps between", () => {
    expect(PageNumbers.window(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(PageNumbers.window(1, 10)).toEqual([1, 2, "gap", 10]);
    expect(PageNumbers.window(10, 10)).toEqual([1, "gap", 9, 10]);
  });

  it("writes the page out rather than a gap that would hide only one", () => {
    expect(PageNumbers.window(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
