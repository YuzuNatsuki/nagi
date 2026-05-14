# API のみ（モノレポの backend ワークスペース）
# ビルド: リポジトリの nagi ディレクトリで `docker build -t nagi-api .`
FROM node:22-alpine AS builder
WORKDIR /ws
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY backend ./backend
RUN npm run build -w backend

FROM node:22-alpine AS runner
WORKDIR /ws
ENV NODE_ENV=production
ENV PORT=8080
ENV BIND_HOST=0.0.0.0
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev
COPY --from=builder /ws/backend/dist ./backend/dist
EXPOSE 8080
USER node
CMD ["node", "backend/dist/index.js"]
