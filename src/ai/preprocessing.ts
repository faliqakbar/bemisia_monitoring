import { toPlanar } from "./yolo";
import type { Tile } from "./tiling";
export function cropTile(image: HTMLCanvasElement, tile: Tile, size = 640) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.drawImage(
    image,
    tile.x,
    tile.y,
    tile.width,
    tile.height,
    0,
    0,
    size,
    size,
  );
  return canvas;
}
export function toCHW(canvas: HTMLCanvasElement) {
  const { data } = canvas
    .getContext("2d")!
    .getImageData(0, 0, canvas.width, canvas.height);
  return toPlanar(data, canvas.width * canvas.height, 4);
}
