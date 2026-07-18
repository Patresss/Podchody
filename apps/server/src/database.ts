import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

export function createDatabase(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_point_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS points (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      content_hash TEXT,
      latitude REAL,
      longitude REAL,
      exif_latitude REAL,
      exif_longitude REAL,
      captured_at TEXT,
      marker_x REAL,
      marker_y REAL,
      display_name TEXT,
      symbol TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS points_project_id_idx ON points(project_id);

    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      point_ids TEXT NOT NULL,
      generation_mode TEXT NOT NULL DEFAULT 'manual',
      distance_mode TEXT NOT NULL DEFAULT 'maximum',
      puzzle_type TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS routes_project_id_idx ON routes(project_id);
  `);

  const projectColumns = database.pragma("table_info(projects)") as Array<{ name: string }>;
  if (!projectColumns.some((column) => column.name === "cover_point_id")) {
    database.exec("ALTER TABLE projects ADD COLUMN cover_point_id TEXT");
  }
  const pointColumns = database.pragma("table_info(points)") as Array<{ name: string }>;
  if (!pointColumns.some((column) => column.name === "content_hash")) {
    database.exec("ALTER TABLE points ADD COLUMN content_hash TEXT");
  }
  if (!pointColumns.some((column) => column.name === "display_name")) {
    database.exec("ALTER TABLE points ADD COLUMN display_name TEXT");
  }
  if (!pointColumns.some((column) => column.name === "symbol")) {
    database.exec("ALTER TABLE points ADD COLUMN symbol TEXT");
  }
  const routeColumns = database.pragma("table_info(routes)") as Array<{ name: string }>;
  if (!routeColumns.some((column) => column.name === "generation_mode")) {
    database.exec("ALTER TABLE routes ADD COLUMN generation_mode TEXT NOT NULL DEFAULT 'manual'");
  }
  if (!routeColumns.some((column) => column.name === "distance_mode")) {
    database.exec("ALTER TABLE routes ADD COLUMN distance_mode TEXT NOT NULL DEFAULT 'maximum'");
  }
  if (!routeColumns.some((column) => column.name === "puzzle_type")) {
    database.exec("ALTER TABLE routes ADD COLUMN puzzle_type TEXT");
  }
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS points_project_content_hash_idx ON points(project_id, content_hash) WHERE content_hash IS NOT NULL");
  return database;
}
