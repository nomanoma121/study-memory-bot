# ステージ1: ビルド環境
FROM node:20-alpine AS builder

WORKDIR /app

# better-sqlite3のビルドに必要なツールをインストール
RUN apk add --no-cache python3 make g++

# pnpmを有効化
RUN corepack enable

# 依存関係のインストール
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# better-sqlite3を明示的にリビルド
RUN pnpm rebuild better-sqlite3

# ソースコードをコピーしてコンパイル
COPY . .
RUN pnpm run build

# 本番用の依存関係のみを再インストール
RUN pnpm install --prod --frozen-lockfile
RUN pnpm rebuild better-sqlite3


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
