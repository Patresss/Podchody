import type { Point, Project, PuzzleType, RouteDistanceMode, RoutePlan } from "../types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error ?? "Wystąpił błąd połączenia.", response.status);
  return payload as T;
}

export const api = {
  session: () => request<{ username: string }>("/api/auth/session"),
  login: (username: string, password: string) => request<{ username: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  projects: () => request<{ projects: Project[] }>("/api/projects"),
  createProject: (name: string, description: string) => request<{ project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  }),
  project: (id: string) => request<{ project: Project; points: Point[]; routes: RoutePlan[] }>(`/api/projects/${id}`),
  updateProject: (id: string, body: Partial<Pick<Project, "name" | "description" | "coverPointId">>) => request<{ project: Project }>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  uploadPhotos: async (projectId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("photos", file));
    return request<{ points: Point[]; errors: { filename: string; error: string; kind?: "duplicate" | "processing" }[] }>(`/api/projects/${projectId}/photos`, {
      method: "POST",
      body: form,
    });
  },
  updatePoint: (id: string, body: Partial<Pick<Point, "latitude" | "longitude" | "markerX" | "markerY" | "displayName" | "symbol">>) => request<{ point: Point }>(`/api/points/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }),
  deletePoint: (id: string) => request<void>(`/api/points/${id}`, { method: "DELETE" }),
  createRoute: (projectId: string, name: string, selection: { mode: "automatic"; count: number; distanceMode: RouteDistanceMode; puzzleTypes: PuzzleType[] } | { mode: "manual"; pointIds: string[]; distanceMode: RouteDistanceMode; puzzleTypes: PuzzleType[] }) => request<{ route: RoutePlan }>(`/api/projects/${projectId}/routes`, {
    method: "POST",
    body: JSON.stringify({ name, ...selection }),
  }),
  route: (id: string) => request<{ route: RoutePlan; points: Point[] }>(`/api/routes/${id}`),
  rerollRoute: (id: string, distanceMode?: RouteDistanceMode) => request<{ route: RoutePlan }>(`/api/routes/${id}/reroll`, { method: "POST", body: JSON.stringify(distanceMode ? { distanceMode } : {}) }),
  reorderRoute: (id: string, pointIds: string[]) => request<{ route: RoutePlan }>(`/api/routes/${id}/order`, {
    method: "PATCH",
    body: JSON.stringify({ pointIds }),
  }),
  renameRoute: (id: string, name: string) => request<{ route: RoutePlan }>(`/api/routes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  }),
  updateRoutePuzzles: (id: string, puzzleTypes: PuzzleType[]) => request<{ route: RoutePlan }>(`/api/routes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ puzzleTypes }),
  }),
  deleteRoute: (id: string) => request<void>(`/api/routes/${id}`, { method: "DELETE" }),
};
