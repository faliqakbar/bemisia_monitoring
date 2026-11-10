"""Build Label Studio tasks from the private Hugging Face dataset (docs/DATASET.md).

Downloads liq30/bemisia-traps (or --repo) into --root, then writes tasks.json in which
every photo already carries the model's boxes as predictions, "Perlu Koreksi" first.

    set HF_TOKEN=hf_...            (PowerShell: $env:HF_TOKEN = "hf_...")
    python scripts/labelstudio_tasks.py --root C:/bemisia-labeling
"""

import argparse
import json
import os
from pathlib import Path

from huggingface_hub import snapshot_download

parser = argparse.ArgumentParser()
parser.add_argument("--repo", default="liq30/bemisia-traps")
parser.add_argument("--root", type=Path, required=True,
                    help="Folder Label Studio serves local files from")
parser.add_argument("--check-below", type=float, default=0.40,
                    help="Model boxes under this confidence get the cyan \"Cek\" label")
parser.add_argument("--no-download", action="store_true",
                    help="Use the copy already in --root")
args = parser.parse_args()

root = args.root.resolve()
dataset = root / args.repo.split("/")[-1]
if not args.no_download:
    snapshot_download(args.repo, repo_type="dataset", local_dir=dataset,
                      token=os.environ.get("HF_TOKEN"))

ORDER = {"needs_review": 0, "unreviewed": 1, "correct": 2}
tasks = []
for label_file in sorted((dataset / "labels").glob("*.json")):
    meta = json.loads(label_file.read_text(encoding="utf-8"))
    image = dataset / meta["image"]
    if not image.exists():
        print(f"skip {label_file.name}: photo missing")
        continue
    relative = image.relative_to(root).as_posix()
    boxes = [
        {
            "id": f"p{i}",
            "from_name": "label",
            "to_name": "image",
            "type": "rectanglelabels",
            "original_width": meta["width"],
            "original_height": meta["height"],
            "image_rotation": 0,
            "score": p["confidence"],
            # Label Studio uses percentages of the upright photo.
            "value": {
                "x": p["x"] * 100,
                "y": p["y"] * 100,
                "width": p["width"] * 100,
                "height": p["height"] * 100,
                "rotation": 0,
                # Low-confidence boxes stand out in cyan so they are easy to find.
                "rectanglelabels": [
                    "Cek" if p["confidence"] < args.check_below else "Bemisia"
                ],
            },
        }
        for i, p in enumerate(meta["predictions"])
    ]
    tasks.append({
        "data": {
            "image": f"/data/local-files/?d={relative}",
            "trap": meta["label"],
            "captured_at": meta["captured_at"],
            "feedback": meta["feedback"],
            "notes": meta.get("notes") or "-",
            "model_version": meta["model_version"],
            "id": meta["id"],
        },
        "predictions": [{"model_version": meta["model_version"], "result": boxes}],
        "_order": (ORDER.get(meta["feedback"], 1), meta["captured_at"]),
    })

tasks.sort(key=lambda t: t.pop("_order"))
out = root / "tasks.json"
out.write_text(json.dumps(tasks, indent=1), encoding="utf-8")
needs = sum(t["data"]["feedback"] == "needs_review" for t in tasks)
print(f"{len(tasks)} tasks ({needs} Perlu Koreksi first) -> {out}")
