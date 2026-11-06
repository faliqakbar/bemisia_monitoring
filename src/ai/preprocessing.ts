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
  const pixels = canvas.width * canvas.height;
  const output = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++)
    for (let c = 0; c < 3; c++) output[c * pixels + i] = data[i * 4 + c] / 255;
  return output;
}
