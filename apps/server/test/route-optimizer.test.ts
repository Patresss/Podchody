import { describe, expect, it } from "vitest";
import { generateRoute, optimizeRoute, routeMetrics, selectRandomPoints, type CoordinatePoint } from "../src/route-optimizer.js";

function seededRandom(seed = 12345) {
  return () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
}

const points: CoordinatePoint[] = [
  { id: "a", latitude: 50.0362, longitude: 19.9340 },
  { id: "b", latitude: 50.0372, longitude: 19.9352 },
  { id: "c", latitude: 50.0362, longitude: 19.9352 },
  { id: "d", latitude: 50.0372, longitude: 19.9340 },
  { id: "e", latitude: 50.0367, longitude: 19.9346 },
  { id: "f", latitude: 50.0367, longitude: 19.9350 },
];

describe("route optimizer", () => {
  it("uses every selected point exactly once", () => {
    const route = optimizeRoute(points, seededRandom());
    expect(route).toHaveLength(points.length);
    expect(new Set(route.map((point) => point.id))).toEqual(new Set(points.map((point) => point.id)));
  });

  it("prefers a long zig-zag over source order", () => {
    const optimized = routeMetrics(optimizeRoute(points, seededRandom())).totalDistanceMeters;
    const theoreticalBest = Math.max(...permutations(points).map((candidate) => routeMetrics(candidate).totalDistanceMeters));
    expect(optimized).toBeGreaterThan(theoreticalBest * 0.9);
  });

  it("selects every point with an equal probability and without duplicates", () => {
    const random = seededRandom(77);
    const runs = 8_000;
    const selectedPerRun = 3;
    const frequencies = new Map(points.map((point) => [point.id, 0]));
    for (let run = 0; run < runs; run += 1) {
      const selected = selectRandomPoints(points, selectedPerRun, random);
      expect(new Set(selected.map((point) => point.id)).size).toBe(selectedPerRun);
      selected.forEach((point) => frequencies.set(point.id, frequencies.get(point.id)! + 1));
    }
    const expected = runs * selectedPerRun / points.length;
    frequencies.forEach((frequency) => expect(Math.abs(frequency - expected)).toBeLessThan(expected * 0.05));
  });

  it("uses the distance style only for ordering, not for selecting points", () => {
    const maximum = generateRoute(points, 4, seededRandom(91), "maximum").map((point) => point.id).sort();
    const balanced = generateRoute(points, 4, seededRandom(91), "balanced").map((point) => point.id).sort();
    const compact = generateRoute(points, 4, seededRandom(91), "compact").map((point) => point.id).sort();
    expect(maximum).toEqual(balanced);
    expect(maximum).toEqual(compact);
  });

  it("offers meaningfully different distance styles", () => {
    const maximum = routeMetrics(optimizeRoute(points, seededRandom(91), "maximum")).totalDistanceMeters;
    const balanced = routeMetrics(optimizeRoute(points, seededRandom(91), "balanced")).totalDistanceMeters;
    const compact = routeMetrics(optimizeRoute(points, seededRandom(91), "compact")).totalDistanceMeters;
    expect(maximum).toBeGreaterThan(balanced * 1.2);
    expect(balanced).toBeGreaterThan(compact * 1.2);
  });
});

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}
