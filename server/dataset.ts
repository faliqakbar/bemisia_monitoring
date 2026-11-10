// Reviewed photos sent from the app for retraining, stored in a private Hugging Face
// dataset: images/<YYYY-MM>/<id>.<ext> plus labels/<id>.json with the model's boxes.
import { HttpError } from "./params";

export interface DatasetMeta {
  id: string;
  label: string;
  trap_id: string;
  captured_at: string;
  model_version: string;
  width: number;
  height: number;
  feedback: "unreviewed" | "correct" | "needs_review";
  notes: string;
  bemisia_count: number;
  exposure_days: number | null;
  detections: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
  }[];
}

const FEEDBACK = ["unreviewed", "correct", "needs_review"];
const MAX_DETECTIONS = 5000;

const fail = (message: string): never => {
  throw new HttpError(400, `Metadata dataset tidak valid: ${message}.`);
};
const text = (v: unknown, name: string, pattern: RegExp) =>
  typeof v === "string" && pattern.test(v) ? v : fail(name);
const num = (v: unknown, name: string) =>
  typeof v === "number" && Number.isFinite(v) ? v : fail(name);

// Untrusted request body: accept only the fields the dataset needs, in range.
export function parseDatasetMeta(value: unknown): DatasetMeta {
  if (!value || typeof value !== "object") fail("bukan objek");
  const v = value as Record<string, unknown>;
  const width = num(v.width, "width"),
    height = num(v.height, "height");
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  )
    fail("ukuran foto");
  if (!Array.isArray(v.detections) || v.detections.length > MAX_DETECTIONS)
    fail("detections");
  const detections = (v.detections as Record<string, unknown>[]).map((d) => {
    const box = {
      x1: num(d?.x1, "x1"),
      y1: num(d?.y1, "y1"),
      x2: num(d?.x2, "x2"),
      y2: num(d?.y2, "y2"),
      confidence: num(d?.confidence, "confidence"),
    };
    if (box.x2 <= box.x1 || box.y2 <= box.y1) fail("box");
    return box;
  });
  const capturedAt = text(
    v.captured_at,
    "captured_at",
    /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/,
  );
  if (Number.isNaN(Date.parse(capturedAt))) fail("captured_at");
  const exposure =
    v.exposure_days === null ? null : num(v.exposure_days, "exposure_days");
  return {
    id: text(v.id, "id", /^[a-zA-Z0-9-]{8,64}$/),
    label: text(v.label, "label", /^[A-Za-z0-9_ /-]{1,40}$/),
    trap_id: text(v.trap_id, "trap_id", /^[a-zA-Z0-9-]{1,64}$/),
    captured_at: capturedAt,
    model_version: text(
      v.model_version,
      "model_version",
      /^[a-zA-Z0-9._-]{1,120}$/,
    ),
    width,
    height,
    feedback: FEEDBACK.includes(v.feedback as string)
      ? (v.feedback as DatasetMeta["feedback"])
      : fail("feedback"),
    notes: typeof v.notes === "string" ? v.notes.slice(0, 1000) : "",
    bemisia_count: num(v.bemisia_count, "bemisia_count"),
    exposure_days: exposure,
    detections,
  };
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Paths and the label file stored next to the photo.
export function datasetFiles(meta: DatasetMeta, photoType: string) {
  const ext = EXTENSIONS[photoType] ?? fail("tipe foto");
  const image = `images/${meta.captured_at.slice(0, 7)}/${meta.id}.${ext}`;
  const label = {
    ...meta,
    image,
    // Model boxes as fractions of the upright photo, ready to become Label Studio predictions.
    predictions: meta.detections.map((d) => ({
      x: d.x1 / meta.width,
      y: d.y1 / meta.height,
      width: (d.x2 - d.x1) / meta.width,
      height: (d.y2 - d.y1) / meta.height,
      confidence: d.confidence,
    })),
  };
  return { image, labelPath: `labels/${meta.id}.json`, label };
}
