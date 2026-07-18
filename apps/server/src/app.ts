import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { z } from "zod";
import {
  authMiddleware,
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  readSessionToken,
  setSessionCookie,
  verifyPassword,
} from "./auth.js";
import { loadConfig, type AppConfig } from "./config.js";
import { createDatabase, type AppDatabase } from "./database.js";
import { originalPath, persistPhoto, previewPath, readPhotoMetadata } from "./image-service.js";
import { getPoint, getProject, getRoute, listPoints, listProjects, listRoutes } from "./repositories.js";
import { generateRoute, optimizeRoute } from "./route-optimizer.js";

const projectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
});

const projectUpdateSchema = projectSchema.partial().extend({
  coverPointId: z.string().uuid().nullable().optional(),
});

const pointUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  markerX: z.number().min(0).max(1).nullable().optional(),
  markerY: z.number().min(0).max(1).nullable().optional(),
  displayName: z.string().trim().max(40).nullable().optional(),
  symbol: z.enum(["pin", "tree", "bench", "playground", "building", "ball", "entrance", "lamp", "nature", "flag"]).nullable().optional(),
});

const puzzleTypeSchema = z.enum(["counting", "patterns", "matching", "word-copy", "missing-letter", "math-10", "math-20"]);
const puzzleTypesSchema = z.array(puzzleTypeSchema).max(7).refine((values) => new Set(values).size === values.length, { message: "Każdy rodzaj zagadki wybierz tylko raz." });

const routeCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mode: z.enum(["manual", "automatic"]).default("manual"),
  distanceMode: z.enum(["maximum", "balanced", "compact"]).default("maximum"),
  puzzleTypes: puzzleTypesSchema.default([]),
  pointIds: z.array(z.string().uuid()).min(2).max(100).optional(),
  count: z.number().int().min(2).max(100).optional(),
}).superRefine((body, context) => {
  if (body.mode === "manual" && !body.pointIds) {
    context.addIssue({ code: "custom", message: "Wybierz co najmniej dwa zdjęcia." });
  }
  if (body.mode === "automatic" && body.count == null) {
    context.addIssue({ code: "custom", message: "Podaj liczbę zdjęć do wylosowania." });
  }
});

const routeOrderSchema = z.object({
  pointIds: z.array(z.string().uuid()).min(2).max(100),
});

const routeRerollSchema = z.object({
  distanceMode: z.enum(["maximum", "balanced", "compact"]).optional(),
});

const routeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  puzzleTypes: puzzleTypesSchema.optional(),
}).refine((body) => body.name !== undefined || body.puzzleTypes !== undefined, { message: "Podaj ustawienie do zmiany." });

function parseBody<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error(result.error.issues.map((issue) => issue.message).join(", "));
    Object.assign(error, { status: 400 });
    throw error;
  }
  return result.data;
}

function ensureUnique(values: string[]) {
  if (new Set(values).size !== values.length) {
    const error = new Error("Każdy punkt może wystąpić w trasie tylko raz.");
    Object.assign(error, { status: 400 });
    throw error;
  }
}

async function backfillPhotoHashes(database: AppDatabase, dataDir: string) {
  const points = database.prepare(`
    SELECT id, project_id AS projectId, filename
    FROM points
    WHERE content_hash IS NULL
    ORDER BY created_at, id
  `).all() as Array<{ id: string; projectId: string; filename: string }>;

  const findHash = database.prepare("SELECT id FROM points WHERE project_id = ? AND content_hash = ?");
  const saveHash = database.prepare("UPDATE points SET content_hash = ? WHERE id = ?");
  for (const point of points) {
    try {
      const file = await fs.readFile(path.join(dataDir, "originals", point.projectId, point.filename));
      const contentHash = createHash("sha256").update(file).digest("hex");
      if (!findHash.get(point.projectId, contentHash)) saveHash.run(contentHash, point.id);
    } catch {
      // Brakujący plik nie powinien blokować uruchomienia pozostałych projektów.
    }
  }
}

export async function createApp(configOverrides: Partial<AppConfig> = {}) {
  const config = loadConfig(configOverrides);
  await fs.mkdir(config.dataDir, { recursive: true });
  const database = createDatabase(config.databasePath);
  await backfillPhotoHashes(database, config.dataDir);
  const configuredHash = config.adminPasswordHash ?? (config.adminPassword ? await hashPassword(config.adminPassword) : "");
  const app = express();

  app.disable("x-powered-by");
  if (config.trustProxyHops > 0) app.set("trust proxy", config.trustProxyHops);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://tile.openstreetmap.org"],
        connectSrc: ["'self'", "https://tile.openstreetmap.org"],
        workerSrc: ["'self'", "blob:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
      },
    },
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", time: new Date().toISOString() });
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut." },
  });

  app.post("/api/auth/login", loginLimiter, async (request, response) => {
    const credentials = parseBody(z.object({ username: z.string().min(1), password: z.string().min(1) }), request.body);
    const validUsername = credentials.username === config.adminUsername;
    const validPassword = validUsername ? await verifyPassword(credentials.password, configuredHash) : false;
    if (!validUsername || !validPassword) {
      response.status(401).json({ error: "Nieprawidłowy login lub hasło." });
      return;
    }
    setSessionCookie(response, createSessionToken(config.adminUsername, config.sessionSecret), config.cookieSecure);
    response.json({ username: config.adminUsername });
  });

  app.post("/api/auth/logout", (_request, response) => {
    clearSessionCookie(response, config.cookieSecure);
    response.status(204).end();
  });

  app.get("/api/auth/session", (request, response) => {
    const session = readSessionToken(request.cookies?.podchody_session, config.sessionSecret);
    if (!session) {
      response.status(401).json({ error: "Brak aktywnej sesji." });
      return;
    }
    response.json({ username: session.username });
  });

  app.use("/api", authMiddleware(config.sessionSecret));

  app.get("/api/projects", (_request, response) => {
    response.json({ projects: listProjects(database) });
  });

  app.post("/api/projects", (request, response) => {
    const body = parseBody(projectSchema, request.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    database.prepare("INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, body.name, body.description, now, now);
    response.status(201).json({ project: getProject(database, id) });
  });

  app.get("/api/projects/:projectId", (request, response) => {
    const project = getProject(database, request.params.projectId!);
    if (!project) {
      response.status(404).json({ error: "Nie znaleziono projektu." });
      return;
    }
    response.json({ project, points: listPoints(database, project.id), routes: listRoutes(database, project.id) });
  });

  app.patch("/api/projects/:projectId", (request, response) => {
    const project = getProject(database, request.params.projectId!);
    if (!project) {
      response.status(404).json({ error: "Nie znaleziono projektu." });
      return;
    }
    const body = parseBody(projectUpdateSchema, request.body);
    const name = body.name ?? project.name;
    const description = body.description ?? project.description;
    if (body.coverPointId !== undefined) {
      const coverPoint = body.coverPointId == null ? null : getPoint(database, body.coverPointId);
      if (body.coverPointId != null && (!coverPoint || coverPoint.projectId !== project.id)) {
        response.status(400).json({ error: "Zdjęcie główne musi należeć do tego projektu." });
        return;
      }
      database.prepare("UPDATE projects SET name = ?, description = ?, cover_point_id = ?, updated_at = ? WHERE id = ?")
        .run(name, description, body.coverPointId, new Date().toISOString(), project.id);
    } else {
      database.prepare("UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?")
        .run(name, description, new Date().toISOString(), project.id);
    }
    response.json({ project: getProject(database, project.id) });
  });

  app.delete("/api/projects/:projectId", async (request, response) => {
    const project = getProject(database, request.params.projectId!);
    if (!project) {
      response.status(404).json({ error: "Nie znaleziono projektu." });
      return;
    }
    database.prepare("DELETE FROM projects WHERE id = ?").run(project.id);
    await Promise.all([
      fs.rm(path.join(config.dataDir, "originals", project.id), { recursive: true, force: true }),
      fs.rm(path.join(config.dataDir, "previews", project.id), { recursive: true, force: true }),
    ]);
    response.status(204).end();
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024, files: 100 },
    fileFilter: (_request, file, callback) => {
      const validMime = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp", "application/octet-stream"].includes(file.mimetype);
      const validExtension = /\.(jpe?g|png|heic|heif|webp)$/i.test(file.originalname);
      if (validMime && validExtension) callback(null, true);
      else callback(new Error(`Nieobsługiwany plik: ${file.originalname}`));
    },
  });

  app.post("/api/projects/:projectId/photos", upload.array("photos", 100), async (request, response) => {
    const project = getProject(database, request.params.projectId as string);
    if (!project) {
      response.status(404).json({ error: "Nie znaleziono projektu." });
      return;
    }
    const files = (request.files ?? []) as Express.Multer.File[];
    if (!files.length) {
      response.status(400).json({ error: "Wybierz co najmniej jedno zdjęcie." });
      return;
    }

    const created = [];
    const errors: { filename: string; error: string; kind: "duplicate" | "processing" }[] = [];
    for (const file of files) {
      const id = randomUUID();
      const contentHash = createHash("sha256").update(file.buffer).digest("hex");
      const duplicate = database.prepare("SELECT id FROM points WHERE project_id = ? AND content_hash = ?").get(project.id, contentHash);
      if (duplicate) {
        errors.push({ filename: file.originalname, error: "To zdjęcie już znajduje się w projekcie.", kind: "duplicate" });
        continue;
      }
      let stored: Awaited<ReturnType<typeof persistPhoto>> | undefined;
      try {
        stored = await persistPhoto({
          dataDir: config.dataDir,
          projectId: project.id,
          pointId: id,
          originalName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
        const metadata = await readPhotoMetadata(stored.originalPath);
        const now = new Date().toISOString();
        database.prepare(`
          INSERT INTO points (
            id, project_id, filename, original_filename, mime_type,
            content_hash, latitude, longitude, exif_latitude, exif_longitude, captured_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, project.id, stored.storedFilename, file.originalname, file.mimetype,
          contentHash,
          metadata.latitude, metadata.longitude, metadata.latitude, metadata.longitude,
          metadata.capturedAt, now,
        );
        created.push(getPoint(database, id)!);
      } catch (error) {
        if (stored) await Promise.all([fs.rm(stored.originalPath, { force: true }), fs.rm(stored.previewPath, { force: true })]);
        errors.push({ filename: file.originalname, error: error instanceof Error ? error.message : "Nieznany błąd", kind: "processing" });
      }
    }
    database.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), project.id);
    response.status(created.length ? 201 : 200).json({ points: created, errors });
  });

  app.get("/api/points/:pointId/preview", (request, response) => {
    const point = getPoint(database, request.params.pointId!);
    if (!point) {
      response.status(404).json({ error: "Nie znaleziono zdjęcia." });
      return;
    }
    response.setHeader("Cache-Control", "private, no-cache");
    response.sendFile(previewPath(config.dataDir, point));
  });

  app.get("/api/points/:pointId/original", (request, response) => {
    const point = getPoint(database, request.params.pointId!);
    if (!point) {
      response.status(404).json({ error: "Nie znaleziono zdjęcia." });
      return;
    }
    response.download(originalPath(config.dataDir, point), point.originalFilename);
  });

  app.patch("/api/points/:pointId", (request, response) => {
    const point = getPoint(database, request.params.pointId!);
    if (!point) {
      response.status(404).json({ error: "Nie znaleziono punktu." });
      return;
    }
    const body = parseBody(pointUpdateSchema, request.body);
    const latitude = body.latitude !== undefined ? body.latitude : point.latitude;
    const longitude = body.longitude !== undefined ? body.longitude : point.longitude;
    const markerX = body.markerX !== undefined ? body.markerX : point.markerX;
    const markerY = body.markerY !== undefined ? body.markerY : point.markerY;
    const displayName = body.displayName !== undefined ? body.displayName?.trim() || null : point.displayName;
    const symbol = body.symbol !== undefined ? body.symbol : point.symbol;
    if ((latitude == null) !== (longitude == null)) {
      response.status(400).json({ error: "Szerokość i długość geograficzna muszą być ustawione razem." });
      return;
    }
    database.prepare("UPDATE points SET latitude = ?, longitude = ?, marker_x = ?, marker_y = ?, display_name = ?, symbol = ? WHERE id = ?")
      .run(latitude, longitude, markerX, markerY, displayName, symbol, point.id);
    database.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), point.projectId);
    response.json({ point: getPoint(database, point.id) });
  });

  app.delete("/api/points/:pointId", async (request, response) => {
    const point = getPoint(database, request.params.pointId!);
    if (!point) {
      response.status(404).json({ error: "Nie znaleziono punktu." });
      return;
    }
    const usedBy = listRoutes(database, point.projectId).find((route) => route.pointIds.includes(point.id));
    if (usedBy) {
      response.status(409).json({ error: `Zdjęcie jest używane w trasie „${usedBy.name}”.` });
      return;
    }
    database.prepare(`
      UPDATE projects
      SET cover_point_id = CASE WHEN cover_point_id = ? THEN NULL ELSE cover_point_id END,
          updated_at = ?
      WHERE id = ?
    `).run(point.id, new Date().toISOString(), point.projectId);
    database.prepare("DELETE FROM points WHERE id = ?").run(point.id);
    await Promise.all([
      fs.rm(previewPath(config.dataDir, point), { force: true }),
      fs.rm(originalPath(config.dataDir, point), { force: true }),
    ]);
    response.status(204).end();
  });

  app.post("/api/projects/:projectId/routes", (request, response) => {
    const project = getProject(database, request.params.projectId!);
    if (!project) {
      response.status(404).json({ error: "Nie znaleziono projektu." });
      return;
    }
    const body = parseBody(routeCreateSchema, request.body);
    const points = listPoints(database, project.id);
    let ordered;
    if (body.mode === "automatic") {
      const located = points.filter((point): point is typeof point & { latitude: number; longitude: number } => point.latitude != null && point.longitude != null);
      if (body.count! > located.length) {
        response.status(400).json({ error: `Tylko ${located.length} zdjęć ma współrzędne. Zmniejsz liczbę punktów.` });
        return;
      }
      ordered = generateRoute(located.map((point) => ({ id: point.id, latitude: point.latitude, longitude: point.longitude })), body.count!, Math.random, body.distanceMode);
    } else {
      const pointIds = body.pointIds!;
      ensureUnique(pointIds);
      const selected = pointIds.map((id) => points.find((point) => point.id === id));
      if (selected.some((point) => !point)) {
        response.status(400).json({ error: "Co najmniej jeden punkt nie należy do tego projektu." });
        return;
      }
      if (selected.some((point) => point!.latitude == null || point!.longitude == null)) {
        response.status(400).json({ error: "Każdy wybrany punkt musi mieć współrzędne." });
        return;
      }
      ordered = optimizeRoute(selected.map((point) => ({ id: point!.id, latitude: point!.latitude!, longitude: point!.longitude! })), Math.random, body.distanceMode);
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    database.prepare("INSERT INTO routes (id, project_id, name, point_ids, generation_mode, distance_mode, puzzle_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, project.id, body.name, JSON.stringify(ordered.map((point) => point.id)), body.mode, body.distanceMode, body.puzzleTypes.length ? JSON.stringify(body.puzzleTypes) : null, now, now);
    response.status(201).json({ route: getRoute(database, id) });
  });

  app.get("/api/routes/:routeId", (request, response) => {
    const route = getRoute(database, request.params.routeId!);
    if (!route) {
      response.status(404).json({ error: "Nie znaleziono trasy." });
      return;
    }
    response.json({ route, points: listPoints(database, route.projectId) });
  });

  app.post("/api/routes/:routeId/reroll", (request, response) => {
    const route = getRoute(database, request.params.routeId!);
    if (!route) {
      response.status(404).json({ error: "Nie znaleziono trasy." });
      return;
    }
    const body = parseBody(routeRerollSchema, request.body ?? {});
    const distanceMode = body.distanceMode ?? route.distanceMode;
    const projectPoints = listPoints(database, route.projectId);
    const pointMap = new Map(projectPoints.map((point) => [point.id, point]));
    let ordered;
    const isStyleChange = body.distanceMode != null;
    if (route.generationMode === "automatic" && !isStyleChange) {
      const located = projectPoints.filter((point): point is typeof point & { latitude: number; longitude: number } => point.latitude != null && point.longitude != null);
      if (located.length < route.pointIds.length) {
        response.status(400).json({ error: "Za mało zdjęć ma współrzędne, aby ponownie wylosować tę trasę." });
        return;
      }
      ordered = generateRoute(located.map((point) => ({ id: point.id, latitude: point.latitude, longitude: point.longitude })), route.pointIds.length, Math.random, distanceMode);
    } else {
      const selected = route.pointIds.map((id) => pointMap.get(id));
      if (selected.some((point) => !point || point.latitude == null || point.longitude == null)) {
        response.status(400).json({ error: "Każdy punkt trasy musi mieć współrzędne." });
        return;
      }
      ordered = optimizeRoute(selected.map((point) => ({ id: point!.id, latitude: point!.latitude!, longitude: point!.longitude! })), Math.random, distanceMode);
    }
    database.prepare("UPDATE routes SET point_ids = ?, distance_mode = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(ordered.map((point) => point.id)), distanceMode, new Date().toISOString(), route.id);
    response.json({ route: getRoute(database, route.id) });
  });

  app.patch("/api/routes/:routeId/order", (request, response) => {
    const route = getRoute(database, request.params.routeId!);
    if (!route) {
      response.status(404).json({ error: "Nie znaleziono trasy." });
      return;
    }
    const body = parseBody(routeOrderSchema, request.body);
    ensureUnique(body.pointIds);
    if (body.pointIds.length !== route.pointIds.length || body.pointIds.some((id) => !route.pointIds.includes(id))) {
      response.status(400).json({ error: "Nowa kolejność musi zawierać dokładnie te same punkty." });
      return;
    }
    database.prepare("UPDATE routes SET point_ids = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(body.pointIds), new Date().toISOString(), route.id);
    response.json({ route: getRoute(database, route.id) });
  });

  app.patch("/api/routes/:routeId", (request, response) => {
    const route = getRoute(database, request.params.routeId!);
    if (!route) {
      response.status(404).json({ error: "Nie znaleziono trasy." });
      return;
    }
    const body = parseBody(routeUpdateSchema, request.body);
    const name = body.name ?? route.name;
    const puzzleTypes = body.puzzleTypes ?? route.puzzleTypes;
    database.prepare("UPDATE routes SET name = ?, puzzle_type = ?, updated_at = ? WHERE id = ?")
      .run(name, puzzleTypes.length ? JSON.stringify(puzzleTypes) : null, new Date().toISOString(), route.id);
    response.json({ route: getRoute(database, route.id) });
  });

  app.delete("/api/routes/:routeId", (request, response) => {
    const result = database.prepare("DELETE FROM routes WHERE id = ?").run(request.params.routeId!);
    if (!result.changes) {
      response.status(404).json({ error: "Nie znaleziono trasy." });
      return;
    }
    response.status(204).end();
  });

  if (config.isProduction) {
    const webRoot = path.resolve("apps/web/dist");
    app.use(express.static(webRoot, { maxAge: "1d", index: false }));
    app.get("*splat", (_request, response) => response.sendFile(path.join(webRoot, "index.html")));
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const status = typeof error?.status === "number" ? error.status : error instanceof multer.MulterError ? 400 : 500;
    if (status >= 500) console.error(error);
    response.status(status).json({ error: error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd." });
  };
  app.use(errorHandler);

  return { app, database, config };
}
