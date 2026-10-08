import { describe, expect, it } from "vitest";
import { preloadSquare } from "./SquareCard";

describe("preloadSquare", () => {
  it("is a safe no-op on the server, however often it's called", () => {
    expect(typeof window).toBe("undefined");
    expect(() => {
      preloadSquare();
      preloadSquare();
    }).not.toThrow();
  });
});
