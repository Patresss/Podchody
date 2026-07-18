import { describe, expect, it } from "vitest";
import { optimizeHidingOrder, pathDistanceMeters } from "./hiding-order";

describe("hiding order", () => {
  it("finds a short open path through every point", () => {
    const points = [
      { id: "a", latitude: 50, longitude: 19 },
      { id: "d", latitude: 50, longitude: 19.003 },
      { id: "b", latitude: 50, longitude: 19.001 },
      { id: "c", latitude: 50, longitude: 19.002 },
    ];

    const optimized = optimizeHidingOrder(points);

    expect(["a,b,c,d", "d,c,b,a"]).toContain(optimized.map((point) => point.id).join(","));
    expect(pathDistanceMeters(optimized)).toBeLessThan(pathDistanceMeters(points));
  });
});
