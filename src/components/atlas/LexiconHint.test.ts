import { describe, expect, it } from "vitest";
import { hintPosition } from "./LexiconHint";

describe("hintPosition", () => {
  it("keeps the computed width and right edge inside narrow screens", () => {
    const position = hintPosition({ left: 340, top: 100, bottom: 120 }, 360, 800, 180);
    expect(position.width).toBe(288);
    expect(position.left + position.width).toBe(348);
    expect(position.top).toBe(128);
    expect(hintPosition({ left: 200, top: 100, bottom: 120 }, 250, 800, 180).width).toBe(226);
  });
  it("places measured panels above a trigger near the viewport bottom", () => {
    expect(hintPosition({ left: 10, top: 700, bottom: 720 }, 390, 844, 200)).toEqual({ width: 288, left: 12, top: 492 });
  });
});
