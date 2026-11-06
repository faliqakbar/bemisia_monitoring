import { useEffect, useRef, useState } from "react";
import type { Detection } from "../ai/types";
export function DetectionCanvas({
  image,
  detections,
}: {
  image: HTMLCanvasElement;
  detections: Detection[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; left: number; top: number } | null>(
      null,
    );
  const [boxes, setBoxes] = useState(true),
    [labels, setLabels] = useState(false),
    [zoom, setZoom] = useState(1);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    if (boxes) {
      ctx.lineWidth = Math.max(2, image.width / 900);
      ctx.font = `${Math.max(14, image.width / 100)}px sans-serif`;
      detections.forEach((d, i) => {
        ctx.strokeStyle = "#f04a46";
        ctx.strokeRect(d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1);
        if (labels) {
          const text = `${i + 1} · ${(d.confidence * 100).toFixed(0)}%`;
          const h = Math.max(18, image.width / 85);
          ctx.fillStyle = "#9b211b";
          ctx.fillRect(
            d.x1,
            Math.max(0, d.y1 - h),
            ctx.measureText(text).width + 8,
            h,
          );
          ctx.fillStyle = "#fff";
          ctx.fillText(text, d.x1 + 4, Math.max(h, d.y1) - 3);
        }
      });
    }
  }, [image, detections, boxes, labels]);
  return (
    <section className="panel viewer">
      <div className="section-head">
        <h2>Review Detection</h2>
        <span className="badge">{detections.length} boxes</span>
      </div>
      <div className="viewer-controls">
        <label>
          <input
            type="checkbox"
            checked={boxes}
            onChange={(e) => setBoxes(e.target.checked)}
          />{" "}
          Bounding box
        </label>
        <label>
          <input
            type="checkbox"
            checked={labels}
            onChange={(e) => setLabels(e.target.checked)}
          />{" "}
          Nomor & confidence
        </label>
        <label>
          Zoom{" "}
          <input
            aria-label="Zoom foto"
            type="range"
            min="1"
            max="6"
            step=".25"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          {zoom}×
        </label>
      </div>
      <div
        ref={viewport}
        className="image-viewport"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && viewport.current) {
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              left: viewport.current.scrollLeft,
              top: viewport.current.scrollTop,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (drag.current && viewport.current) {
            viewport.current.scrollLeft =
              drag.current.left - e.clientX + drag.current.x;
            viewport.current.scrollTop =
              drag.current.top - e.clientY + drag.current.y;
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <canvas
          ref={canvas}
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
          aria-label="Foto asli dengan bounding box deteksi"
        />
      </div>
      <small>Geser foto untuk pan. Buffer foto tetap pada resolusi asli.</small>
    </section>
  );
}
