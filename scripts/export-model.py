"""Export the user's trusted Ultralytics detector and validate CPU parity.

Run with the project's .venv-model Python; source weights are copied before export.
"""
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
import ultralytics
from ultralytics import YOLO

parser = argparse.ArgumentParser()
parser.add_argument("weights", type=Path)
parser.add_argument("--version", default="bemisia-trial-v1")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
work = root / "model-work"
work.mkdir(exist_ok=True)
source = args.weights.resolve(strict=True)
copy = work / "best.pt"
if source != copy.resolve():
    shutil.copy2(source, copy)
torch.set_num_threads(2)
model = YOLO(str(copy))
names = {int(k): str(v) for k, v in model.names.items()}
print(json.dumps({"task": model.task, "classes": names, "training_imgsz": model.ckpt.get("train_args", {}).get("imgsz"), "exporter": ultralytics.__version__}), flush=True)
if model.task != "detect" or names != {0: "bemisia"}:
    raise ValueError("Expected single-class Bemisia detection. Review decoder/class mapping before export.")
exported = Path(model.export(format="onnx", imgsz=640, batch=1, dynamic=False,
                             simplify=True, opset=17, nms=False, half=False, device="cpu"))
graph = onnx.load(str(exported))
onnx.checker.check_model(graph)
session = ort.InferenceSession(str(exported), providers=["CPUExecutionProvider"])
input_shape = session.get_inputs()[0].shape
output_shape = session.get_outputs()[0].shape
if input_shape != [1, 3, 640, 640] or len(output_shape) != 3 or output_shape[:2] != [1, 5]:
    raise ValueError(f"Incompatible tensor shapes: {input_shape} -> {output_shape}")
sample = ((np.arange(3*640*640, dtype=np.float32) % 251)/250).reshape(1,3,640,640)
model.model.eval().float()
with torch.no_grad():
    expected = model.model(torch.from_numpy(sample))
    if isinstance(expected, (tuple, list)):
        expected = expected[0]
    expected = expected.detach().cpu().numpy()
actual = session.run(None, {session.get_inputs()[0].name: sample})[0]
np.testing.assert_allclose(actual, expected, rtol=1e-3, atol=1e-3)
validation = {"inputShape": input_shape, "outputShape": output_shape,
              "maxAbsoluteDifference": float(np.abs(actual-expected).max()),
              "maxConfidenceDifference": float(np.abs(actual[:,4,:]-expected[:,4,:]).max()),
              "pytorchOnnxParity": "passed", "providers": session.get_providers()}
destination = root / "public" / "models"
destination.mkdir(parents=True, exist_ok=True)
shutil.copy2(exported, destination / "bemisia.onnx")
sha = hashlib.sha256(exported.read_bytes()).hexdigest()
manifest = {"version": args.version, "sha256": sha, "trial": True,
            "classNames": [names[0]], "inputSize": 640,
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "ultralyticsVersion": ultralytics.__version__, "opset": 17,
            "validation": validation}
(destination / "model-info.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8")
print(json.dumps({"installed": str(destination / "bemisia.onnx"), "version": args.version, "bytes": exported.stat().st_size, **validation}), flush=True)
