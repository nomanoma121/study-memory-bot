# Discord勉強時間共有ボット

Discordサーバー内でユーザーの勉強時間を記録・共有し、学習のモチベーションを維持・向上させるためのボットです。

## 機能概要

- 勉強時間の記録・管理
- サーバー内のリアルタイム学習状況表示
- 個人別勉強ログの確認
- 勉強時間ランキングの表示

## セットアップ方法

### 1. 前提条件

- Node.js v20以降
- pnpm
- Discord Bot Token、Client ID、Guild ID

### 2. 環境設定

1. プロジェクトをクローンまたはダウンロード
2. `.env.example` をコピーして `.env` を作成
3. Discord Bot Token、Client ID、Guild ID を設定

```bash
cp .env.example .env
```

`.env` ファイルを編集：
```
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_discord_guild_id_here
```

### 3. インストール・ビルド

```bash
# 依存関係のインストール
pnpm install

# TypeScriptビルド
pnpm build

# コマンドの登録
pnpm deploy-commands

# ボット起動
pnpm start
```

### 4. 開発モード

```bash
# 開発モードで起動（ファイル変更を自動検知）
pnpm dev
```

## Dockerでの起動

### 1. Docker Composeを使用（推奨）

```bash
# ビルドして起動
docker-compose up -d --build

# ログの確認
docker-compose logs -f bot
```

### 2. 直接Dockerを使用

```bash
# イメージをビルド
docker build -t discord-study-bot .

# コンテナを起動
docker run -d --name study-bot --env-file .env discord-study-bot
```

## コマンド一覧

### `/study start [subject] [force]`
勉強時間の計測を開始します。

- **subject** (オプション): 勉強内容（デフォルト: "作業中"）
- **force** (オプション): 進行中のセッションを強制終了して新しいセッションを開始

**例:**
- `/study start subject:数学`
- `/study start subject:React force:true`

### `/study stop [note]`
勉強時間の計測を終了します。

- **note** (オプション): 勉強の振り返りメモ

**例:**
- `/study stop`
- `/study stop note:問題集を3章まで完了`

### `/study add <subject> <minutes> [date] [notes]`
過去の勉強記録を手動で追加します。

- **subject** (必須): 勉強した内容
- **minutes** (必須): 勉強時間（分）
- **date** (オプション): 勉強した日付 (YYYY-MM-DD 形式、省略時は今日)
- **notes** (オプション): 勉強の内容やメモ

**例:**
- `/study add subject:数学 minutes:90`
- `/study add subject:React minutes:120 date:2024-01-15 notes:コンポーネント作成`

### `/status`
現在サーバー内で勉強しているメンバーの一覧と進行時間を表示します。

### `/log [period] [user]`
指定したユーザーの勉強時間ログを期間別に表示します。

- **period** (オプション): 集計期間
  - `today`: 今日
  - `week`: 過去7日間（デフォルト）
  - `month`: 過去30日間
  - `all`: 全期間
- **user** (オプション): 対象ユーザー（デフォルト: 自分）

**例:**
- `/log period:today`
- `/log period:month user:@username`

### `/rank [period]`
サーバー内の勉強時間ランキングを表示します（上位10名）。

- **period** (オプション): 集計期間（`/log`と同様）

**例:**
- `/rank period:week`

### `/edit list` / `/edit delete` / `/edit update`
勉強記録の編集・削除を行います（過去24時間限定）。

- `/edit list` - 編集可能な記録一覧を表示
- `/edit delete id:<ID>` - 指定IDの記録を削除
- `/edit update id:<ID> [subject:<内容>] [minutes:<時間>] [notes:<メモ>]` - 記録内容を更新

**例:**
- `/edit list`
- `/edit delete id:123`
- `/edit update id:123 subject:英語 minutes:60`

### `/report [date]`
サーバー全体の勉強レポートを表示します。

- **date** (オプション): レポートの日付 (YYYY-MM-DD 形式、省略時は今日)

毎日午後11時に自動でレポートが送信されます。

**例:**
- `/report`
- `/report date:2024-01-15`

### `/help`
ボットの使い方とコマンド一覧を表示します。

初回利用時や使い方を忘れた時にご利用ください。

## データベース

- **データベース**: SQLite
- **ファイル名**: `study_data.db`
- **場所**: プロジェクトルート（Dockerの場合は `./data/` にマウント）

### テーブル構造

```sql
CREATE TABLE study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  guildId TEXT NOT NULL,
  subject TEXT,
  startTime INTEGER NOT NULL,
  endTime INTEGER,
  notes TEXT
);
```

## トラブルシューティング

### よくある問題

1. **ボットがオンラインにならない**
   - Discord Token が正しく設定されているか確認
   - ボットがサーバーに招待されているか確認

2. **コマンドが表示されない**
   - `pnpm deploy-commands` を実行してコマンドを登録
   - ギルドコマンドのため即座に反映されます
   - DISCORD_GUILD_IDが正しく設定されているか確認

3. **データベースエラー**
   - データベースファイルの書き込み権限を確認
   - Dockerの場合はボリュームマウントが正しく設定されているか確認

### ログの確認

```bash
# 開発モード
pnpm dev

# Docker Compose
docker-compose logs -f bot

# Docker（直接）
docker logs -f study-bot
```

## 技術スタック

- **言語**: TypeScript
- **ランタイム**: Node.js v20
- **Discordライブラリ**: discord.js v14
- **データベース**: SQLite (better-sqlite3)
- **パッケージマネージャー**: pnpm
- **コンテナ**: Docker

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 貢献

バグ報告や機能追加の提案は、GitHubのIssuesでお願いします。