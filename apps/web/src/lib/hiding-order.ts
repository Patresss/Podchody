import type { Point } from "../types";
import { distanceMeters } from "./geo";

export function pathDistanceMeters(points: Array<Pick<Point, "latitude" | "longitude">>) {
  return points.slice(1).reduce((total, point, index) => total + distanceMeters(points[index]!, point), 0);
}

export function optimizeHidingOrder<T extends Pick<Point, "latitude" | "longitude">>(points: T[]): T[] {
  if (points.length < 3) return [...points];

  const distances = points.map((point) => points.map((other) => distanceMeters(point, other)));
  if (points.length <= 15) return exactOpenPath(points, distances);

  let bestOrder: number[] = [];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let start = 0; start < points.length; start += 1) {
    const remaining = new Set(points.map((_, index) => index));
    remaining.delete(start);
    const order = [start];
    while (remaining.size) {
      const current = order.at(-1)!;
      let nearest = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of remaining) {
        const distance = distances[current]![candidate]!;
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
      order.push(nearest);
      remaining.delete(nearest);
    }

    improveOpenPath(order, distances);
    const distance = order.slice(1).reduce((total, pointIndex, index) => total + distances[order[index]!]![pointIndex]!, 0);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOrder = order;
    }
  }

  return bestOrder.map((index) => points[index]!);
}

function exactOpenPath<T>(points: T[], distances: number[][]) {
  const count = points.length;
  const stateCount = 1 << count;
  const costs = new Float64Array(stateCount * count);
  costs.fill(Number.POSITIVE_INFINITY);
  const parents = new Int16Array(stateCount * count);
  parents.fill(-1);

  for (let index = 0; index < count; index += 1) costs[(1 << index) * count + index] = 0;

  for (let mask = 1; mask < stateCount; mask += 1) {
    for (let end = 0; end < count; end += 1) {
      if ((mask & (1 << end)) === 0) continue;
      const previousMask = mask ^ (1 << end);
      if (!previousMask) continue;
      const stateIndex = mask * count + end;
      for (let previous = 0; previous < count; previous += 1) {
        if ((previousMask & (1 << previous)) === 0) continue;
        const candidate = costs[previousMask * count + previous]! + distances[previous]![end]!;
        if (candidate < costs[stateIndex]!) {
          costs[stateIndex] = candidate;
          parents[stateIndex] = previous;
        }
      }
    }
  }

  const fullMask = stateCount - 1;
  let end = 0;
  for (let candidate = 1; candidate < count; candidate += 1) {
    if (costs[fullMask * count + candidate]! < costs[fullMask * count + end]!) end = candidate;
  }
  const order: number[] = [];
  let mask = fullMask;
  while (end >= 0) {
    order.push(end);
    const previous = parents[mask * count + end]!;
    mask ^= 1 << end;
    end = previous;
  }
  order.reverse();
  return order.map((index) => points[index]!);
}

function improveOpenPath(order: number[], distances: number[][]) {
  let improved = true;
  while (improved) {
    improved = false;
    for (let start = 0; start < order.length - 1; start += 1) {
      for (let end = start + 1; end < order.length; end += 1) {
        const before = start > 0 ? distances[order[start - 1]!]![order[start]!]! : 0;
        const after = end < order.length - 1 ? distances[order[end]!]![order[end + 1]!]! : 0;
        const reversedBefore = start > 0 ? distances[order[start - 1]!]![order[end]!]! : 0;
        const reversedAfter = end < order.length - 1 ? distances[order[start]!]![order[end + 1]!]! : 0;
        if (reversedBefore + reversedAfter + 0.01 < before + after) {
          const replacement = order.slice(start, end + 1).reverse();
          order.splice(start, replacement.length, ...replacement);
          improved = true;
        }
      }
    }
  }
}
