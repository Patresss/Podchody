import { describe, expect, it } from "vitest";
import { generateRoute, optimizeRoute, routeMetrics, type CoordinatePoint } from "../src/route-optimizer.js";

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

  it("selects the requested number of points and alternates distant areas", () => {
    const clustered: CoordinatePoint[] = [
      { id: "left-1", latitude: 50.0360, longitude: 19.9300 },
      { id: "left-2", latitude: 50.0361, longitude: 19.9301 },
      { id: "left-3", latitude: 50.0362, longitude: 19.9300 },
      { id: "left-4", latitude: 50.0363, longitude: 19.9301 },
      { id: "right-1", latitude: 50.0360, longitude: 19.9400 },
      { id: "right-2", latitude: 50.0361, longitude: 19.9401 },
      { id: "right-3", latitude: 50.0362, longitude: 19.9400 },
      { id: "right-4", latitude: 50.0363, longitude: 19.9401 },
      { id: "middle-1", latitude: 50.0360, longitude: 19.9350 },
      { id: "middle-2", latitude: 50.0363, longitude: 19.9351 },
    ];
    const route = generateRoute(clustered, 6, seededRandom(77));
    const metrics = routeMetrics(route);
    expect(route).toHaveLength(6);
    expect(new Set(route.map((point) => point.id)).size).toBe(6);
    expect(route.some((point) => point.id.startsWith("left"))).toBe(true);
    expect(route.some((point) => point.id.startsWith("right"))).toBe(true);
    expect(metrics.minLegMeters).toBeGreaterThan(600);
  });

  it("offers meaningfully different distance styles", () => {
    const maximum = routeMetrics(generateRoute(points, 4, seededRandom(91), "maximum")).totalDistanceMeters;
    const balanced = routeMetrics(generateRoute(points, 4, seededRandom(91), "balanced")).totalDistanceMeters;
    const compact = routeMetrics(generateRoute(points, 4, seededRandom(91), "compact")).totalDistanceMeters;
    expect(maximum).toBeGreaterThan(balanced * 1.2);
    expect(balanced).toBeGreaterThan(compact * 1.2);
  });
});

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}
