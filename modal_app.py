"""Bemisia AI server on Modal (https://modal.com).

Runs the same Node server as the Dockerfile (server/), with the shared detector code
in src/ and the installed weights in public/models. Deploy from this folder:

    modal deploy modal_app.py
"""

import subprocess

import modal

IGNORE = ["node_modules", "dist"]

image = (
    modal.Image.from_registry("node:22-slim", add_python="3.12")
    # CPU binaries ship inside onnxruntime-node; skip the optional CUDA download.
    # NODE_ENV=production is set only at runtime: here it would skip esbuild.
    .env({"ONNXRUNTIME_NODE_INSTALL": "skip"})
    .add_local_dir("server", "/app/server", copy=True, ignore=IGNORE)
    .add_local_dir("src", "/app/src", copy=True)
    .run_commands(
        "cd /app/server && npm ci && npm run build && npm prune --omit=dev"
    )
    # Weights last so a model swap does not rebuild the npm layers.
    .add_local_file("public/models/bemisia.onnx", "/app/models/bemisia.onnx")
    .add_local_file("public/models/model-info.json", "/app/models/model-info.json")
)

app = modal.App("bemisia-ai", image=image)


@app.function(
    cpu=4,
    memory=4096,
    timeout=300,
    # Cost guard: the endpoint is public, so at most two containers ever run.
    max_containers=2,
    # Stay warm for 5 minutes after a request so a series of traps avoids cold starts.
    scaledown_window=300,
)
# One photo per container: an analysis uses every core.
@modal.concurrent(max_inputs=1)
@modal.web_server(port=8080, startup_timeout=120)
def serve():
    subprocess.Popen(
        ["node", "/app/server/dist/index.mjs"],
        cwd="/app/server",
        env={
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "PORT": "8080",
            "MODEL_DIR": "/app/models",
            "NODE_ENV": "production",
        },
    )
