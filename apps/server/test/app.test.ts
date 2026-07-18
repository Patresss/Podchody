import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closeMetadataReader } from "../src/image-service.js";

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("API flow", () => {
  it("authenticates, creates a project, uploads photos and generates a route", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "podchody-test-"));
    temporaryDirectories.push(dataDir);
    const { app, database } = await createApp({
      dataDir,
      databasePath: path.join(dataDir, "test.sqlite"),
      adminUsername: "admin",
      adminPassword: "bezpieczne-haslo-testowe",
      sessionSecret: "01234567890123456789012345678901",
      cookieSecure: false,
      isProduction: false,
    });
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ username: "admin", password: "bezpieczne-haslo-testowe" }).expect(200);
    const projectResponse = await agent.post("/api/projects").send({ name: "Testowa trasa", description: "" }).expect(201);
    const projectId = projectResponse.body.project.id as string;
    const jpeg = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#78a58e" } }).jpeg().toBuffer();
    const secondJpeg = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#5b79ba" } }).jpeg().toBuffer();
    const uploadResponse = await agent.post(`/api/projects/${projectId}/photos`)
      .attach("photos", jpeg, { filename: "punkt-1.jpg", contentType: "image/jpeg" })
      .attach("photos", secondJpeg, { filename: "punkt-2.jpg", contentType: "image/jpeg" })
      .expect(201);
    expect(uploadResponse.body.points).toHaveLength(2);
    const [first, second] = uploadResponse.body.points as Array<{ id: string }>;
    const coverResponse = await agent.patch(`/api/projects/${projectId}`).send({ coverPointId: second!.id }).expect(200);
    expect(coverResponse.body.project.coverPointId).toBe(second!.id);
    expect(coverResponse.body.project.coverUrl).toContain(second!.id);
    const projectListResponse = await agent.get("/api/projects").expect(200);
    expect(projectListResponse.body.projects[0].coverPointId).toBe(second!.id);
    await agent.get(`/api/points/${first!.id}/preview`)
      .expect("Cache-Control", "private, no-cache")
      .expect("Content-Type", /image\/jpeg/)
      .expect(200);
    const duplicateResponse = await agent.post(`/api/projects/${projectId}/photos`)
      .attach("photos", jpeg, { filename: "punkt-1-kopia.jpg", contentType: "image/jpeg" })
      .expect(200);
    expect(duplicateResponse.body.points).toHaveLength(0);
    expect(duplicateResponse.body.errors[0].kind).toBe("duplicate");
    const namedPointResponse = await agent.patch(`/api/points/${first!.id}`).send({
      latitude: 50.0362,
      longitude: 19.9340,
      displayName: "Ławka przy zjeżdżalni",
      symbol: "bench",
    }).expect(200);
    expect(namedPointResponse.body.point.displayName).toBe("Ławka przy zjeżdżalni");
    expect(namedPointResponse.body.point.symbol).toBe("bench");
    await agent.patch(`/api/points/${second!.id}`).send({ latitude: 50.0372, longitude: 19.9352 }).expect(200);
    const routeResponse = await agent.post(`/api/projects/${projectId}/routes`).send({
      name: "Dużo biegania",
      pointIds: [first!.id, second!.id],
      puzzleType: "math-20",
    }).expect(201);
    expect(routeResponse.body.route.pointIds).toHaveLength(2);
    expect(routeResponse.body.route.totalDistanceMeters).toBeGreaterThan(100);
    expect(routeResponse.body.route.generationMode).toBe("manual");
    expect(routeResponse.body.route.distanceMode).toBe("maximum");
    expect(routeResponse.body.route.puzzleType).toBe("math-20");
    const automaticRouteResponse = await agent.post(`/api/projects/${projectId}/routes`).send({
      name: "Automatyczna trasa",
      mode: "automatic",
      count: 2,
    }).expect(201);
    expect(automaticRouteResponse.body.route.pointIds).toHaveLength(2);
    expect(automaticRouteResponse.body.route.generationMode).toBe("automatic");
    const rerolledResponse = await agent.post(`/api/routes/${automaticRouteResponse.body.route.id}/reroll`).send({ distanceMode: "compact" }).expect(200);
    expect(rerolledResponse.body.route.distanceMode).toBe("compact");
    database.close();
    await closeMetadataReader();
  });
});
