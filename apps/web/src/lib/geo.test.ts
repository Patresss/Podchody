import { describe, expect, it } from "vitest";
import { distanceMeters, formatDistance } from "./geo";

describe("geo helpers", () => {
  it("calculates a short local distance", () => {
    const meters = distanceMeters(
      { latitude: 50.0362, longitude: 19.9340 },
      { latitude: 50.0372, longitude: 19.9352 },
    );
    expect(meters).toBeGreaterThan(130);
    expect(meters).toBeLessThan(150);
  });

  it("formats meters and kilometers in Polish notation", () => {
    expect(formatDistance(118.6)).toBe("119 m");
    expect(formatDistance(1234)).toBe("1,23 km");
  });
});
