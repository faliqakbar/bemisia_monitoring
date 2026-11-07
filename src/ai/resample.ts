import type { Tile } from "./tiling";

// Bilinear resize that samples at pixel centres and clamps at the edges, like canvas
// drawImage with smoothing. The server uses it so its tiles match the browser's:
// libvips kernels shift detections enough to change counts on low-confidence objects.
export function resizeTileBilinear(
  source: ArrayLike<number>,
  sourceWidth: number,
  channels: number,
  tile: Tile,
  size = 640,
) {
  const output = new Uint8Array(size * size * 3),
    scaleX = tile.width / size,
    scaleY = tile.height / size;
  for (let j = 0; j < size; j++) {
    const fy = Math.min(tile.height - 1, Math.max(0, (j + 0.5) * scaleY - 0.5)),
      y0 = Math.floor(fy),
      y1 = Math.min(tile.height - 1, y0 + 1),
      wy = fy - y0,
      row0 = (tile.y + y0) * sourceWidth,
      row1 = (tile.y + y1) * sourceWidth;
    for (let i = 0; i < size; i++) {
      const fx = Math.min(
          tile.width - 1,
          Math.max(0, (i + 0.5) * scaleX - 0.5),
        ),
        x0 = Math.floor(fx),
        x1 = Math.min(tile.width - 1, x0 + 1),
        wx = fx - x0,
        a = (row0 + tile.x + x0) * channels,
        b = (row0 + tile.x + x1) * channels,
        c = (row1 + tile.x + x0) * channels,
        d = (row1 + tile.x + x1) * channels,
        o = (j * size + i) * 3;
      for (let k = 0; k < 3; k++)
        output[o + k] = Math.round(
          (source[a + k] * (1 - wx) + source[b + k] * wx) * (1 - wy) +
            (source[c + k] * (1 - wx) + source[d + k] * wx) * wy,
        );
    }
  }
  return output;
}
