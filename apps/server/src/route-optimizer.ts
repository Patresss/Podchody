export type CoordinatePoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type RouteDistanceMode = "maximum" | "balanced" | "compact";

export function haversineMeters(a: CoordinatePoint, b: CoordinatePoint) {
  const earthRadius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(value));
}

export function routeMetrics(points: CoordinatePoint[]) {
  const legs = points.slice(1).map((point, index) => haversineMeters(points[index]!, point));
  return {
    legs,
    totalDistanceMeters: legs.reduce((sum, distance) => sum + distance, 0),
    minLegMeters: legs.length > 0 ? Math.min(...legs) : 0,
  };
}

function weightedChoice<T>(items: T[], weights: number[], random: () => number) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return items[index]!;
  }
  return items.at(-1)!;
}

function pointSpreads(points: CoordinatePoint[]) {
  return points.map((point) => {
    const distances = points.filter((candidate) => candidate.id !== point.id).map((candidate) => haversineMeters(point, candidate));
    return distances.length ? distances.reduce((sum, distance) => sum + distance, 0) / distances.length : 0;
  });
}

function shuffledWeightedRoute(points: CoordinatePoint[], targetCount: number, spreads: number[], random: () => number, mode: RouteDistanceMode) {
  const unused = [...points];
  const spreadById = new Map(points.map((point, index) => [point.id, spreads[index] ?? 0]));
  const maximumSpread = Math.max(1, ...spreads);
  const firstWeights = unused.map((point) => {
    const spread = spreadById.get(point.id) ?? 0;
    if (mode === "compact") return Math.pow(Math.max(1, maximumSpread * 1.15 - spread), 2.4);
    return Math.pow(Math.max(1, spread), mode === "maximum" ? 3 : 1.8);
  });
  const first = weightedChoice(unused, firstWeights, random);
  const result = [first];
  unused.splice(unused.indexOf(first), 1);
  while (unused.length > 0 && result.length < targetCount) {
    const current = result.at(-1)!;
    const distances = unused.map((candidate) => haversineMeters(current, candidate));
    const maximumDistance = Math.max(1, ...distances);
    const preferredMinimum = maximumDistance * (mode === "maximum" ? 0.45 : 0.28);
    const weights = distances.map((distance, index) => {
      const candidate = unused[index]!;
      if (mode === "compact") {
        const centralBonus = 1.2 - 0.55 * (spreadById.get(candidate.id) ?? 0) / maximumSpread;
        return centralBonus / Math.pow(Math.max(8, distance), 1.65);
      }
      if (mode === "balanced") {
        const target = maximumDistance * 0.58;
        const spread = Math.max(8, maximumDistance * 0.28);
        const mediumDistanceBonus = 0.15 + Math.exp(-Math.pow((distance - target) / spread, 2));
        const peripheralBonus = 0.85 + 0.45 * (spreadById.get(candidate.id) ?? 0) / maximumSpread;
        return mediumDistanceBonus * peripheralBonus;
      }
      const distanceWeight = Math.pow(Math.max(1, distance), mode === "maximum" ? 3.1 : 1.75);
      const peripheralBonus = 0.72 + (spreadById.get(candidate.id) ?? 0) / maximumSpread;
      const penaltyFloor = mode === "maximum" ? 0.08 : 0.32;
      const shortPenalty = distance >= preferredMinimum ? 1 : penaltyFloor + (1 - penaltyFloor) * Math.pow(distance / preferredMinimum, 2.5);
      return distanceWeight * peripheralBonus * shortPenalty;
    });
    const next = weightedChoice(unused, weights, random);
    result.push(next);
    unused.splice(unused.indexOf(next), 1);
  }
  return result;
}

function scoreRoute(points: CoordinatePoint[], pairMedian: number, mode: RouteDistanceMode) {
  const metrics = routeMetrics(points);
  if (mode === "compact") {
    const tooShortLimit = Math.max(6, pairMedian * 0.16);
    const tooShortPenalty = metrics.legs.reduce((penalty, leg) => penalty + (leg < tooShortLimit ? (tooShortLimit - leg) * 5 : 0), 0);
    return -metrics.totalDistanceMeters + metrics.minLegMeters * 0.35 - tooShortPenalty;
  }
  if (mode === "balanced") {
    const idealLeg = Math.max(12, pairMedian * 0.9);
    const deviation = metrics.legs.reduce((sum, leg) => sum + Math.abs(leg - idealLeg), 0);
    const shortPenalty = metrics.legs.reduce((sum, leg) => sum + (leg < idealLeg * 0.35 ? (idealLeg * 0.35 - leg) * 3 : 0), 0);
    return -deviation + metrics.minLegMeters * 0.45 - shortPenalty;
  }
  const shortLimit = Math.max(8, pairMedian * 0.32);
  const shortPenalty = metrics.legs.reduce((penalty, leg) => {
    if (leg >= shortLimit) return penalty;
    return penalty + (shortLimit - leg) * 4.5;
  }, 0);
  let span = 0;
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      span = Math.max(span, haversineMeters(points[first]!, points[second]!));
    }
  }
  return metrics.totalDistanceMeters + metrics.minLegMeters * 2.2 + span * 0.35 - shortPenalty;
}

function improveRoute(route: CoordinatePoint[], pairMedian: number, mode: RouteDistanceMode) {
  let best = [...route];
  let bestScore = scoreRoute(best, pairMedian, mode);
  for (let pass = 0; pass < 2; pass += 1) {
    let improved = false;
    for (let start = 0; start < best.length - 1; start += 1) {
      for (let end = start + 1; end < best.length; end += 1) {
        const candidate = [...best.slice(0, start), ...best.slice(start, end + 1).reverse(), ...best.slice(end + 1)];
        const candidateScore = scoreRoute(candidate, pairMedian, mode);
        if (candidateScore > bestScore + 0.01) {
          best = candidate;
          bestScore = candidateScore;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return { route: best, score: bestScore };
}

export function selectRandomPoints(points: CoordinatePoint[], targetCount: number, random: () => number = Math.random) {
  if (points.length < 2) throw new Error("Trasa wymaga co najmniej dwóch punktów.");
  if (!Number.isInteger(targetCount) || targetCount < 2 || targetCount > points.length) {
    throw new Error(`Liczba punktów musi mieścić się między 2 a ${points.length}.`);
  }

  const shuffled = [...points];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled.slice(0, targetCount);
}

function planRoute(points: CoordinatePoint[], random: () => number, mode: RouteDistanceMode) {
  const targetCount = points.length;
  const pairDistances: number[] = [];
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      pairDistances.push(haversineMeters(points[a]!, points[b]!));
    }
  }
  pairDistances.sort((a, b) => a - b);
  const pairMedian = Math.max(1, pairDistances[Math.floor(pairDistances.length / 2)] ?? 1);
  const spreads = pointSpreads(points);

  const attempts = Math.min(1_600, Math.max(450, points.length * targetCount * 4));
  let candidates = Array.from({ length: attempts }, () => {
    const route = shuffledWeightedRoute(points, targetCount, spreads, random, mode);
    return { route, score: scoreRoute(route, pairMedian, mode) };
  }).sort((a, b) => b.score - a.score);

  // Lokalna poprawa jest kosztowniejsza, więc wykonujemy ją tylko dla najlepszych
  // wylosowanych kandydatów. Daje niemal ten sam wynik bez wielosekundowego
  // oczekiwania przy trasach mających kilkanaście punktów.
  if (targetCount <= 16) {
    const improvementCount = Math.min(32, candidates.length);
    candidates = [
      ...candidates.slice(0, improvementCount).map(({ route }) => improveRoute(route, pairMedian, mode)),
      ...candidates.slice(improvementCount),
    ].sort((a, b) => b.score - a.score);
  }

  // Losowanie z najlepszych wyników daje różne trasy, ale nie poświęca długich odcinków.
  const topCount = Math.max(1, Math.min(10, Math.ceil(candidates.length * 0.012)));
  return candidates[Math.floor(random() * topCount)]!.route;
}

export function generateRoute(points: CoordinatePoint[], targetCount: number, random: () => number = Math.random, mode: RouteDistanceMode = "maximum") {
  const selected = selectRandomPoints(points, targetCount, random);
  return planRoute(selected, random, mode);
}

export function optimizeRoute(points: CoordinatePoint[], random: () => number = Math.random, mode: RouteDistanceMode = "maximum") {
  if (points.length < 2) throw new Error("Trasa wymaga co najmniej dwóch punktów.");
  return planRoute(points, random, mode);
}
