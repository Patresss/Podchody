export type Project = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  pointCount?: number;
  routeCount?: number;
  coverPointId: string | null;
  coverUrl?: string | null;
};

export type Point = {
  id: string;
  projectId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  latitude: number | null;
  longitude: number | null;
  exifLatitude: number | null;
  exifLongitude: number | null;
  capturedAt: string | null;
  markerX: number | null;
  markerY: number | null;
  displayName: string | null;
  symbol: "pin" | "tree" | "bench" | "playground" | "building" | "ball" | "entrance" | "lamp" | "nature" | "flag" | null;
  createdAt: string;
  previewUrl: string;
};

export type Route = {
  id: string;
  projectId: string;
  name: string;
  pointIds: string[];
  generationMode: "manual" | "automatic";
  distanceMode: "maximum" | "balanced" | "compact";
  puzzleTypes: PuzzleType[];
  createdAt: string;
  updatedAt: string;
  totalDistanceMeters?: number;
  minLegMeters?: number;
};

export type PuzzleType = "counting" | "patterns" | "matching" | "word-copy" | "missing-letter" | "math-10" | "math-20";
