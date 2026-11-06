export function blurCheck(values: Float32Array, width: number, height: number) {
  // Variance of a four-neighbor Laplacian, measured at a fixed thumbnail scale.
  let sum = 0,
    squares = 0,
    n = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v =
        values[i - 1] +
        values[i + 1] +
        values[i - width] +
        values[i + width] -
        4 * values[i];
      sum += v;
      squares += v * v;
      n++;
    }
  return n ? Math.max(0, squares / n - (sum / n) ** 2) : 0;
}
