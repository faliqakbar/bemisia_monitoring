export function resolutionCheck(width: number, height: number, min = 1000) {
  return width >= min && height >= min;
}
