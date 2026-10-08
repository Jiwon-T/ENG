FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev && npm cache clean --force
COPY api ./api
COPY src/lib ./src/lib
COPY scripts/template-sync-worker.ts ./scripts/template-sync-worker.ts
COPY firebase-applet-config.json ./firebase-applet-config.json
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "scripts/template-sync-worker.ts"]
