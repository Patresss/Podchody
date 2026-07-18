import type { Point } from "../types";

export function distanceMeters(a: Pick<Point, "latitude" | "longitude">, b: Pick<Point, "latitude" | "longitude">) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return 0;
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(value));
}

export function formatDistance(meters: number) {
  return meters >= 1_000 ? `${(meters / 1_000).toFixed(2).replace(".", ",")} km` : `${Math.round(meters)} m`;
}
