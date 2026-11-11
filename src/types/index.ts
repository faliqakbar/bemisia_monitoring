import type { Detection, DetectorResult } from "../ai/types";
import type { QualityResult } from "../imageQuality/qualityEvaluator";
export interface Greenhouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  active: boolean;
  created_at: string;
}
export interface Trap {
  id: string;
  greenhouse_id: string;
  trap_code: string;
  qr_code: string;
  location_description: string | null;
  installation_date: string | null;
  active: boolean;
  created_at: string;
}
export interface MonitoringSession {
  id: string;
  trap_id: string;
  captured_at: string;
  trap_installed_at: string | null;
  exposure_days: number | null;
  bemisia_count: number;
  previous_count: number | null;
  count_difference: number | null;
  percent_change: number | null;
  bemisia_per_day: number | null;
  previous_bemisia_per_day: number | null;
  rate_change_percent: number | null;
  image_quality_score: number;
  image_quality_status: string;
  mean_confidence: number;
  min_confidence: number;
  max_confidence: number;
  model_version: string;
  original_image_url: string | null;
  detection_image_url: string | null;
  notes: string;
  feedback_status: "unreviewed" | "correct" | "needs_review";
  image_width: number;
  image_height: number;
  tile_count: number;
  inference_time_ms: number;
  total_processing_time_ms: number;
  created_at: string;
  sync_status: "local" | "pending" | "synced";
  owner_id?: string;
  detections: Detection[];
}
export interface Draft {
  trap: Trap;
  image: HTMLCanvasElement;
  quality: QualityResult;
  result: DetectorResult;
  capturedAt: string;
  totalMs: number;
  // Set when the draft came from the background analysis queue.
  jobId?: string;
}
// A photo waiting for, or finished with, background analysis (src/offline/analysisQueue.ts).
export interface AnalysisJob {
  id: string;
  trap_id: string;
  label: string;
  captured_at: string;
  created_at: string;
  quality: QualityResult;
  // Detection settings at the moment the photo was queued.
  settings: Settings;
  file_name: string;
  // Pixel rectangle of the trap in the original photo; null analyses the whole photo.
  crop?: { x: number; y: number; width: number; height: number } | null;
  status: "waiting" | "processing" | "done" | "failed";
  attempts: number;
  result?: DetectorResult;
  total_ms?: number;
  error?: string;
}
export interface Settings {
  confidence: number;
  nmsIou: number;
  tileSize: number;
  overlap: number;
  watchThreshold: number;
  highThreshold: number;
  minResolution: number;
  blurRetake: number;
  blurWarning: number;
  preferOnnx: boolean;
  // Analyse on the Cloud Run server while online (only when VITE_AI_SERVER_URL is set).
  useServer: boolean;
  // Analyse only the trap area found from its yellow colour (utils/crop.ts).
  autoCrop: boolean;
}
// Threshold epidemiological/action level belum divalidasi dan hanya untuk prototype.
export const DEFAULT_SETTINGS: Settings = {
  confidence: 0.25,
  nmsIou: 0.35,
  tileSize: 320,
  overlap: 0.25,
  watchThreshold: 20,
  highThreshold: 50,
  minResolution: 1000,
  blurRetake: 25,
  blurWarning: 70,
  // The installed model (and the AI server while online) is used on a new device
  // without visiting Settings; Simulation Mode is opt-in.
  preferOnnx: true,
  useServer: true,
  autoCrop: true,
};
