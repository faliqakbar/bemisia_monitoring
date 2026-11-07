import { DEFAULT_SETTINGS } from "../src/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Mirrors the ranges allowed on the Settings page.
const PARAMS = {
  confidence: [0.01, 0.95],
  nmsIou: [0.01, 0.95],
  tileSize: [64, 1024],
  overlap: [0, 0.75],
} as const;
export function parseParams(query: URLSearchParams) {
  const result = {
    confidence: DEFAULT_SETTINGS.confidence,
    nmsIou: DEFAULT_SETTINGS.nmsIou,
    tileSize: DEFAULT_SETTINGS.tileSize,
    overlap: DEFAULT_SETTINGS.overlap,
  };
  for (const key of Object.keys(PARAMS) as (keyof typeof PARAMS)[]) {
    const raw = query.get(key);
    if (raw === null) continue;
    const value = Number(raw),
      [min, max] = PARAMS[key];
    if (!Number.isFinite(value) || value < min || value > max)
      throw new HttpError(400, `${key} harus di antara ${min} dan ${max}.`);
    result[key] = key === "tileSize" ? Math.round(value) : value;
  }
  return result;
}

// Optional width/height of the photo as the app decoded it (after EXIF rotation).
export function parseExpectedSize(query: URLSearchParams) {
  const width = query.get("width"),
    height = query.get("height");
  if (width === null && height === null) return null;
  const w = Number(width),
    h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1)
    throw new HttpError(400, "width dan height harus bilangan bulat positif.");
  return { width: w, height: h };
}
