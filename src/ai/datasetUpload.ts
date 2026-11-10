import type { Draft, MonitoringSession } from "../types";
import { aiServerUrl } from "./serverDetector";
import { sourceFiles } from "../utils/image";

let available: Promise<boolean> | undefined;
// Whether the AI server is set up to store dataset photos (its /health says so).
export function datasetAvailable() {
  available ??= aiServerUrl
    ? fetch(aiServerUrl + "/health")
        .then((r) => r.json())
        .then((h: { dataset?: boolean }) => h.dataset === true)
        .catch(() => false)
    : Promise.resolve(false);
  return available;
}

// Sends a reviewed photo (original file) and the model's boxes to the AI server,
// which stores them in the private Hugging Face dataset (server/dataset.ts).
export async function sendToDataset(input: {
  draft: Draft;
  sessionId: string;
  label: string;
  exposureDays: number | null;
  feedback: MonitoringSession["feedback_status"];
  notes: string;
}) {
  const { draft } = input;
  const photo =
    sourceFiles.get(draft.image) ??
    (await new Promise<Blob>((resolve, reject) =>
      draft.image.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Foto gagal disiapkan."))),
        "image/png",
      ),
    ));
  const meta = {
    id: input.sessionId,
    label: input.label,
    trap_id: draft.trap.id,
    captured_at: draft.capturedAt,
    model_version: draft.result.modelVersion,
    width: draft.image.width,
    height: draft.image.height,
    feedback: input.feedback,
    notes: input.notes,
    bemisia_count: draft.result.count,
    exposure_days: input.exposureDays,
    detections: draft.result.detections.map(
      ({ x1, y1, x2, y2, confidence }) => ({
        x1,
        y1,
        x2,
        y2,
        confidence,
      }),
    ),
  };
  const form = new FormData();
  form.append("photo", photo, "photo");
  form.append("meta", JSON.stringify(meta));
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${aiServerUrl}/dataset`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        ((await response.json().catch(() => null)) as { error?: string } | null)
          ?.error ?? `HTTP ${response.status}`,
      );
  } finally {
    clearTimeout(timer);
  }
}
