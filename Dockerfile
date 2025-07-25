# ステージ1: ビルド環境
FROM node:20-alpine AS builder

WORKDIR /app

# pnpmを有効化
RUN corepack enable

# 依存関係のインストール
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ソースコードをコピーしてコンパイル
COPY . .
RUN pnpm run build

# 本番用の依存関係のみを再インストール
RUN pnpm install --prod --frozen-lockfile


# ステージ2: 本番環境
FROM node:20-alpine AS production

WORKDIR /app

# pnpmを有効化
RUN corepack enable

# ビルドステージから必要なファイルのみコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# ボットを実行
CMD ["node", "dist/index.js"]
