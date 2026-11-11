import type { Rect } from "../imageQuality/trapCheck";
import { sourceFiles } from "./image";

// Margin kept around the trap so insects on its edge are not cut off.
export const CROP_PADDING = 0.03;
// Cropping that keeps more than this share of the photo saves too little to bother.
const MAX_USEFUL_AREA = 0.9;

// Cropped canvas -> the original photo file and where the crop sits in it, so the
// server gets the original file and the dataset keeps the whole photo.
export interface CropSource {
  file: File;
  x: number;
  y: number;
  fullWidth: number;
  fullHeight: number;
}
export const cropSources = new WeakMap<HTMLCanvasElement, CropSource>();

// Pixel rectangle of the trap plus padding, or null when cropping would not help.
export function trapCropRect(
  box: Rect | null | undefined,
  width: number,
  height: number,
): Rect | null {
  if (!box) return null;
  const x0 = Math.max(0, Math.floor((box.x - CROP_PADDING) * width)),
    y0 = Math.max(0, Math.floor((box.y - CROP_PADDING) * height)),
    x1 = Math.min(width, Math.ceil((box.x + box.width + CROP_PADDING) * width)),
    y1 = Math.min(
      height,
      Math.ceil((box.y + box.height + CROP_PADDING) * height),
    );
  const w = x1 - x0,
    h = y1 - y0;
  if (w < 64 || h < 64 || w * h > MAX_USEFUL_AREA * width * height) return null;
  return { x: x0, y: y0, width: w, height: h };
}

export function cropCanvas(full: HTMLCanvasElement, rect: Rect) {
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas
    .getContext("2d")!
    .drawImage(
      full,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height,
    );
  const file = sourceFiles.get(full);
  if (file)
    cropSources.set(canvas, {
      file,
      x: rect.x,
      y: rect.y,
      fullWidth: full.width,
      fullHeight: full.height,
    });
  return canvas;
}
