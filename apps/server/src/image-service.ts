import fs from "node:fs/promises";
import path from "node:path";
import { exiftool } from "exiftool-vendored";
import heicConvert from "heic-convert";
import sharp from "sharp";

export type PhotoMetadata = {
  latitude: number | null;
  longitude: number | null;
  capturedAt: string | null;
};

export function safeExtension(originalName: string, mimeType: string) {
  const extension = path.extname(originalName).toLowerCase();
  const allowed = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"]);
  if (allowed.has(extension)) return extension;
  const byMime: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/webp": ".webp",
  };
  return byMime[mimeType] ?? ".bin";
}

export async function readPhotoMetadata(filePath: string): Promise<PhotoMetadata> {
  try {
    const metadata = await exiftool.read(filePath);
    const latitude = typeof metadata.GPSLatitude === "number" ? metadata.GPSLatitude : null;
    const longitude = typeof metadata.GPSLongitude === "number" ? metadata.GPSLongitude : null;
    const rawDate = metadata.DateTimeOriginal ?? metadata.CreateDate ?? null;
    const date = rawDate && typeof rawDate === "object" && "toDate" in rawDate ? rawDate.toDate() : null;
    const capturedAt = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    return { latitude, longitude, capturedAt };
  } catch {
    return { latitude: null, longitude: null, capturedAt: null };
  }
}

export async function closeMetadataReader() {
  await exiftool.end();
}

export async function persistPhoto(options: {
  dataDir: string;
  projectId: string;
  pointId: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const extension = safeExtension(options.originalName, options.mimeType);
  const originalDirectory = path.join(options.dataDir, "originals", options.projectId);
  const previewDirectory = path.join(options.dataDir, "previews", options.projectId);
  await Promise.all([
    fs.mkdir(originalDirectory, { recursive: true }),
    fs.mkdir(previewDirectory, { recursive: true }),
  ]);

  const storedFilename = `${options.pointId}${extension}`;
  const originalPath = path.join(originalDirectory, storedFilename);
  const previewPath = path.join(previewDirectory, `${options.pointId}.jpg`);
  await fs.writeFile(originalPath, options.buffer, { flag: "wx" });
  try {
    try {
      await createPreview(options.buffer, previewPath);
    } catch (sharpError) {
      const isHeic = /\.(heic|heif)$/i.test(options.originalName) || /image\/hei[cf]/i.test(options.mimeType);
      if (!isHeic) throw sharpError;
      const converted = Buffer.from(await heicConvert({ buffer: options.buffer, format: "JPEG", quality: 0.9 }));
      await createPreview(converted, previewPath);
    }
  } catch (error) {
    await fs.rm(originalPath, { force: true });
    throw new Error(`Nie udało się odczytać zdjęcia ${options.originalName}. ${error instanceof Error ? error.message : ""}`);
  }
  return { storedFilename, originalPath, previewPath };
}

async function createPreview(buffer: Buffer, destination: string) {
  await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 1_800, height: 1_800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, progressive: true, mozjpeg: true })
    .toFile(destination);
}

export function previewPath(dataDir: string, point: { projectId: string; id: string }) {
  return path.join(dataDir, "previews", point.projectId, `${point.id}.jpg`);
}

export function originalPath(dataDir: string, point: { projectId: string; filename: string }) {
  return path.join(dataDir, "originals", point.projectId, point.filename);
}
