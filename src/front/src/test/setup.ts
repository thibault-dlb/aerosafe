import "@testing-library/jest-dom/vitest";

// jsdom has no canvas: the maps draw nothing there, and the tests look at what they hold.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
