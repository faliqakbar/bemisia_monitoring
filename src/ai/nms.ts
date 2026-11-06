import type { Detection } from "./types";
export function iou(a: Detection, b: Detection) {
  const intersection =
    Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) *
    Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const union =
    (a.x2 - a.x1) * (a.y2 - a.y1) +
    (b.x2 - b.x1) * (b.y2 - b.y1) -
    intersection;
  return union > 0 ? intersection / union : 0;
}
export function globalNms(
  detections: Detection[],
  threshold = 0.35,
  confidence = 0.25,
): Detection[] {
  // Class-aware suppression across ALL tiles, in original image coordinates.
  const sorted = detections
    .filter((d) => d.confidence >= confidence && d.x2 > d.x1 && d.y2 > d.y1)
    .sort((a, b) => b.confidence - a.confidence);
  const keep: Detection[] = [];
  for (const d of sorted)
    if (!keep.some((k) => k.classId === d.classId && iou(k, d) > threshold))
      keep.push(d);
  return keep;
}
