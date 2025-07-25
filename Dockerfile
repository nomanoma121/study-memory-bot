# npm版のDockerfile
FROM node:20-alpine

WORKDIR /app

# better-sqlite3のビルドに必要なツールをインストール
RUN apk add --no-cache python3 make g++

# 依存関係のインストール
COPY package.json ./
RUN npm install

# better-sqlite3を明示的にリビルド
RUN npm rebuild better-sqlite3

# ソースコードをコピーしてコンパイル
COPY . .
RUN npm run build

# ボットを実行
CMD ["node", "dist/index.js"]