export interface Detection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  classId: number;
  className: string;
}
export interface DetectorResult {
  detections: Detection[];
  count: number;
  meanConfidence: number;
  inferenceTimeMs: number;
  modelVersion: string;
  tileCount: number;
  warning?: string;
}
export interface ModelInfo {
  version: string;
  simulation: boolean;
}
export interface BemisiaDetector {
  initialize(): Promise<void>;
  detect(
    image: HTMLCanvasElement,
    onProgress?: (message: string) => void,
  ): Promise<DetectorResult>;
  getModelInfo(): ModelInfo;
}
