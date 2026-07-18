import type { AppDatabase } from "./database.js";
import { haversineMeters, type CoordinatePoint } from "./route-optimizer.js";
import type { Point, Project, PuzzleType, Route } from "./types.js";

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  point_count?: number;
  route_count?: number;
  cover_id?: string | null;
};

type PointRow = {
  id: string;
  project_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  latitude: number | null;
  longitude: number | null;
  exif_latitude: number | null;
  exif_longitude: number | null;
  captured_at: string | null;
  marker_x: number | null;
  marker_y: number | null;
  display_name: string | null;
  symbol: Point["symbol"];
  created_at: string;
};

type RouteRow = {
  id: string;
  project_id: string;
  name: string;
  point_ids: string;
  generation_mode: "manual" | "automatic";
  distance_mode: "maximum" | "balanced" | "compact";
  puzzle_type: string | null;
  created_at: string;
  updated_at: string;
};

export function mapPoint(row: PointRow): Point {
  return {
    id: row.id,
    projectId: row.project_id,
    filename: row.filename,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    latitude: row.latitude,
    longitude: row.longitude,
    exifLatitude: row.exif_latitude,
    exifLongitude: row.exif_longitude,
    capturedAt: row.captured_at,
    markerX: row.marker_x,
    markerY: row.marker_y,
    displayName: row.display_name,
    symbol: row.symbol,
    createdAt: row.created_at,
    previewUrl: `/api/points/${row.id}/preview`,
  };
}

export function listProjects(database: AppDatabase): Project[] {
  const rows = database.prepare(`
    SELECT p.*,
      COUNT(DISTINCT pt.id) AS point_count,
      COUNT(DISTINCT r.id) AS route_count,
      COALESCE(
        (SELECT id FROM points WHERE id = p.cover_point_id AND project_id = p.id),
        (SELECT id FROM points WHERE project_id = p.id ORDER BY created_at LIMIT 1)
      ) AS cover_id
    FROM projects p
    LEFT JOIN points pt ON pt.project_id = p.id
    LEFT JOIN routes r ON r.project_id = p.id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `).all() as ProjectRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pointCount: row.point_count ?? 0,
    routeCount: row.route_count ?? 0,
    coverPointId: row.cover_id ?? null,
    coverUrl: row.cover_id ? `/api/points/${row.cover_id}/preview` : null,
  }));
}

export function getProject(database: AppDatabase, id: string): Project | null {
  const row = database.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM points WHERE project_id = p.id) AS point_count,
      (SELECT COUNT(*) FROM routes WHERE project_id = p.id) AS route_count,
      COALESCE(
        (SELECT id FROM points WHERE id = p.cover_point_id AND project_id = p.id),
        (SELECT id FROM points WHERE project_id = p.id ORDER BY created_at LIMIT 1)
      ) AS cover_id
    FROM projects p WHERE p.id = ?
  `).get(id) as ProjectRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pointCount: row.point_count ?? 0,
    routeCount: row.route_count ?? 0,
    coverPointId: row.cover_id ?? null,
    coverUrl: row.cover_id ? `/api/points/${row.cover_id}/preview` : null,
  };
}

export function listPoints(database: AppDatabase, projectId: string) {
  return (database.prepare("SELECT * FROM points WHERE project_id = ? ORDER BY captured_at, created_at").all(projectId) as PointRow[]).map(mapPoint);
}

export function getPoint(database: AppDatabase, id: string) {
  const row = database.prepare("SELECT * FROM points WHERE id = ?").get(id) as PointRow | undefined;
  return row ? mapPoint(row) : null;
}

export function routeWithMetrics(database: AppDatabase, row: RouteRow): Route {
  const pointIds = JSON.parse(row.point_ids) as string[];
  const pointMap = new Map(listPoints(database, row.project_id).map((point) => [point.id, point]));
  const ordered = pointIds.map((id) => pointMap.get(id)).filter((point): point is Point & { latitude: number; longitude: number } => Boolean(point && point.latitude != null && point.longitude != null));
  const legs = ordered.slice(1).map((point, index) => haversineMeters(ordered[index]! as CoordinatePoint, point as CoordinatePoint));
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    pointIds,
    generationMode: row.generation_mode,
    distanceMode: row.distance_mode,
    puzzleTypes: parsePuzzleTypes(row.puzzle_type),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalDistanceMeters: legs.reduce((sum, distance) => sum + distance, 0),
    minLegMeters: legs.length ? Math.min(...legs) : 0,
  };
}

function parsePuzzleTypes(value: string | null): PuzzleType[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed as PuzzleType[];
  } catch {
    // Starsze trasy przechowywały pojedynczy typ jako zwykły tekst.
  }
  return [value as PuzzleType];
}

export function listRoutes(database: AppDatabase, projectId: string) {
  return (database.prepare("SELECT * FROM routes WHERE project_id = ? ORDER BY updated_at DESC").all(projectId) as RouteRow[]).map((row) => routeWithMetrics(database, row));
}

export function getRoute(database: AppDatabase, id: string) {
  const row = database.prepare("SELECT * FROM routes WHERE id = ?").get(id) as RouteRow | undefined;
  return row ? routeWithMetrics(database, row) : null;
}
