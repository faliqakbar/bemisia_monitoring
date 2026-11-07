# Cloud Run AI server (see server/). The build context is the repository root so the
# server shares src/ai and public/models with the web app.
FROM node:22-slim AS build
WORKDIR /app/server
# CPU binaries ship inside onnxruntime-node; skip the optional CUDA download.
ENV ONNXRUNTIME_NODE_INSTALL=skip
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
COPY src /app/src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY public/models/bemisia.onnx public/models/model-info.json ./models/
USER node
CMD ["node", "dist/index.mjs"]
