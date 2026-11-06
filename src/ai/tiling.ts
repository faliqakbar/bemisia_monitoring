import type { Detection } from "./types";
export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function getTilePositions(
  width: number,
  height: number,
  size = 320,
  overlap = 0.25,
): Tile[] {
  if (
    ![width, height, size, overlap].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    size < 1 ||
    overlap < 0 ||
    overlap >= 1
  )
    throw new Error("Konfigurasi tile tidak valid");
  const stride = Math.max(1, Math.floor(size * (1 - overlap)));
  const axis = (length: number) => {
    const result = [0];
    while (result[result.length - 1] + size < length)
      result.push(
        Math.min(
          result[result.length - 1] + stride,
          Math.max(0, length - size),
        ),
      );
    return result;
  };
  // Anchor the final tile to the image edge: no uncovered strips or duplicate tiles.
  return axis(height).flatMap((y) =>
    axis(width).map((x) => ({
      x,
      y,
      width: Math.min(size, width - x),
      height: Math.min(size, height - y),
    })),
  );
}
export function remapDetection(
  d: Detection,
  tile: Tile,
  inputSize = 640,
): Detection {
  // The tile is resized (not the full photograph); undo each axis scale then add crop origin.
  const clamp = (v: number) => Math.min(inputSize, Math.max(0, v));
  return {
    ...d,
    x1: tile.x + (clamp(d.x1) * tile.width) / inputSize,
    y1: tile.y + (clamp(d.y1) * tile.height) / inputSize,
    x2: tile.x + (clamp(d.x2) * tile.width) / inputSize,
    y2: tile.y + (clamp(d.y2) * tile.height) / inputSize,
  };
}
