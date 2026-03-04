# ========== 階段 1：構建 ==========
FROM node:20-alpine AS build

WORKDIR /app

# 安裝構建所需的系統依賴
RUN apk add --no-cache python3 make g++

# 先複製 package 檔案，利用 Docker 快取
COPY package.json package-lock.json ./

# 安裝所有依賴（含 devDependencies，構建需要）
RUN npm ci

# 複製原始碼
COPY . .

# 構建前後端（esbuild + vite）
RUN npm run build

# ========== 階段 2：生產環境 ==========
FROM node:20-alpine AS production

WORKDIR /app

# 安裝 runtime 所需的系統依賴
RUN apk add --no-cache curl

# 複製 package 檔案
COPY package.json package-lock.json ./

# 只安裝生產依賴（external deps 需要在 node_modules）
RUN npm ci --omit=dev && npm cache clean --force

# 從 build 階段複製構建產物
COPY --from=build /app/dist ./dist

# 設定環境變數
ENV NODE_ENV=production
ENV PORT=3333

EXPOSE 3333

# 健康檢查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3333/health || exit 1

# 啟動應用
CMD ["node", "dist/index.cjs"]
