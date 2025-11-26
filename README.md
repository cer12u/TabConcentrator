# ブックマークマネージャー

ブラウザで開いている大量のタブを整理・管理するための、シンプルで使いやすいブックマーク管理アプリケーションです。

## 特徴

### 🔖 ブックマーク管理
- URLをドラッグ&ドロップまたは入力で簡単に追加
- 各ブックマークに3行までのメモを添付可能（改行を保持）
- ドメイン名とタイトルを自動抽出して表示

### 📂 コレクション機能
- タブベースでブックマークを複数のリストに整理
- 「すべて」タブで全ブックマークを一覧表示
- カスタムコレクションを自由に作成・編集・削除
- 初期表示タブを設定可能（ログイン時に自動選択）

### 🎨 ファビコンのカスタマイズ
- ドラッグ&ドロップで画像URLまたはファイルをアップロード
- URLからの自動ダウンロード（サーバー側でbase64変換）
- すべての画像をシステム内にセルフホスト（外部依存なし）

### ⚙️ 設定画面
- コレクションの一元管理（追加・編集・削除）
- 初期タブ設定でログイン時の表示を制御
- すっきりしたインターフェースで簡単操作

### 🔐 ユーザー認証
- セッションベースの認証システム
- ユーザーごとに独立したブックマーク管理
- 安全なパスワード保存

## 技術スタック

### フロントエンド
- **React 18** - UIフレームワーク
- **TypeScript** - 型安全な開発
- **Tailwind CSS** - ユーティリティファーストなスタイリング
- **shadcn/ui** - 高品質なUIコンポーネント
- **TanStack Query** - サーバー状態管理
- **Wouter** - 軽量なルーティング
- **Vite** - 高速なビルドツール

### バックエンド
- **Node.js + Express** - サーバーフレームワーク
- **Amazon S3** - JSON ストレージ（読み込み専用）
- **AWS Lambda** - 追加/更新/削除を行い S3 オブジェクトを再生成
- **express-session + memorystore** - セッション管理（小規模利用向け）
- **Zod** - スキーマバリデーション

## セットアップ

### 前提条件
- Node.js 18以上
- S3 バケットと JSON オブジェクトキー（例: `data.json`）
- (推奨) 書き込み用の Lambda エンドポイント（Function URL や API Gateway）

### インストール

1. リポジトリをクローン
```bash
git clone <repository-url>
cd <repository-name>
```

2. 依存関係をインストール
```bash
npm install
```

> 💡 `@aws-sdk/client-s3` はデフォルトではインストールしません（CI がレジストリへ到達できない環境でも成功させるため）。実際に S3 へ接続して動かす環境では、別途 `npm install @aws-sdk/client-s3` を実行して依存を満たしてください。

3. 環境変数を設定

`.env`ファイルを作成し、以下の変数を設定：
```env
S3_BUCKET=your-bucket
S3_KEY=data.json
S3_REGION=ap-northeast-1
LAMBDA_WRITE_URL=https://your-lambda-writer-url (任意: ローカル開発では未設定でも可)
SESSION_SECRET=your-random-secret-key
COGNITO_USER_POOL_ID=your-user-pool-id
COGNITO_CLIENT_ID=your-user-pool-client-id
COGNITO_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your-iam-access-key
AWS_SECRET_ACCESS_KEY=your-iam-secret-key
S3_CACHE_TTL_MS=300000
```

`S3_BUCKET` と `S3_KEY` を指定すると、アプリ起動時に自動で S3 ストレージを選択します。S3 を使わない場合は `DATABASE_URL` を設定するか
、`SESSION_STORE_STRATEGY=memory` でメモリセッションのみを利用してください（メモリストアはスケールアウト時にセッションが消えます）。

認証は AWS Cognito に委譲します。`COGNITO_*` と AWS の署名用クレデンシャル（`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`）を
設定してください。サインアップ・ログイン・パスワードリセットは Cognito のユーザープール API を経由して行われます。

5. 開発サーバーを起動
```bash
npm run dev
```

アプリケーションは `http://localhost:5000` で起動します。

## サーバレスデプロイ（AWS Lambda を例に）

このリポジトリは Express アプリを AWS Lambda + API Gateway 上で動作させるためのエントリポイント `server/lambda.ts` を提供しています。低トラフィック時にコストを抑えたい場合は以下の構成が推奨です。

### バックエンド API
1. 本番ビルド + パッケージ生成
   ```bash
   npm run package:lambda
   ```
   `build/lambda.zip` に Lambda へアップロード可能な ZIP を生成します（`dist`/`shared`/`client`/`node_modules` をまとめ、エントリーポイントは
   `index.mjs`）。
2. Lambda のハンドラーには `index.handler` を指定します。
3. API Gateway を REST / HTTP API として作成し、Lambda と統合します。環境変数は Lambda の設定または Systems Manager Parameter Store / Secrets Manager から読み込みます。

### セッションとデータストア
- セッションは `memorystore` を利用したインメモリ管理です（小規模利用前提）。
- ブックマークやユーザー情報は S3 上の JSON へ保存され、更新系は Lambda から S3 へ書き戻す構成です。

### フロントエンド配信
- `npm run build` で生成される `dist/public` ディレクトリを S3 にアップロードし、CloudFront から配信します。
- `APP_BASE_URL` は CloudFront の公開 URL に設定してください。

### GitHub Actions によるデプロイ
- `.github/workflows/deploy.yml` を使うと、`npm ci`・`npm run package:lambda` を含むビルドの上で S3 への静的アセット同期と Lambda コードの更新までを自動化できます。
- OIDC 経由で Assume するロール（`AWS_ROLE_ARN`）とリージョン（`AWS_REGION`）を GitHub Secrets に登録してください。併せて、静的アセット用 S3 バケット名（`FRONTEND_BUCKET`）、Lambda 関数名（`LAMBDA_FUNCTION_NAME`）、任意で CloudFront ディストリビューション ID（`CLOUDFRONT_DISTRIBUTION_ID`）も設定します。
- ワークフロー内で `npm install @aws-sdk/client-s3` を実行して S3 SDK を取り込み、Lambda パッケージ生成後に `aws s3 sync` と `aws lambda update-function-code` を呼び出します。

### デプロイ後の確認
- API Gateway 経由で `/api/csrf-token`, `/api/auth/register`, `/api/auth/login` が期待通り動作することを確認してください。
- CloudFront 経由でフロントエンドにアクセスし、登録・ログイン・パスワードリセットのフローがサーバレス構成で正常に動くかを確認します。

## 運用：RDB から S3 へのエクスポート

### エクスポートスクリプト
- 既存データベースの内容をユーザー単位で JSON に変換し、S3 にアップロードするスクリプトを追加しました。
- 実行前に `S3_EXPORT_BUCKET`（必須）と `S3_EXPORT_PREFIX`（任意）を設定し、AWS 認証情報を有効にしてください。
- `@aws-sdk/client-s3` が環境にインストールされている必要があります（エクスポートを実行する環境で追加してください）。
- 実行コマンド例：
  ```bash
  S3_EXPORT_BUCKET=my-export-bucket \
  S3_EXPORT_PREFIX=backups \
  AWS_REGION=ap-northeast-1 \
  DATABASE_URL=postgres://... \
  npm run export:s3
  ```
- 出力例：`s3://my-export-bucket/backups/<user-id>-migration.json` に各ユーザーのブックマークやコレクションをまとめた JSON を保存します。

### API からのオンデマンドエクスポート
- 認証済みユーザーは `POST /api/exports/s3` を呼び出すことで、自身のデータを S3 にエクスポートできます。
- 環境変数 `EXPORT_ACCESS_TOKEN` を設定すると、`X-Export-Token` ヘッダーによる追加認証が求められます。
- テストや CI では S3 クライアントをモック化しており、外部ネットワークに依存せずに成功/失敗パスを検証できます。

## 使い方

### 初回セットアップ
1. アプリケーションにアクセス
2. 新規ユーザーとして登録
3. ログイン

### ブックマークの追加
1. URL入力欄にURLを入力またはドラッグ&ドロップ
2. 「追加」ボタンをクリック
3. 必要に応じて編集ボタンからメモやファビコンを追加

### コレクションの管理
1. 右上の「設定」ボタンをクリック
2. 「新しいコレクション」欄に名前を入力して追加
3. 既存のコレクションを編集または削除
4. 初期タブを選択して保存

### ファビコンの設定
1. ブックマークの編集モードに入る
2. ファビコン入力欄に画像URLを入力、または画像ファイルをドラッグ&ドロップ
3. 保存ボタンをクリック
4. 画像は自動的にシステム内に保存されます

## データ構造

### Users（ユーザー）
- ユーザー名とパスワードで認証
- 各ユーザーは独立したブックマークとコレクションを所有

### Collections（コレクション）
- ユーザーが作成したブックマークのグループ
- 名前でカスタマイズ可能
- 削除時、所属するブックマークは「すべて」タブに移動

### Bookmarks（ブックマーク）
- URL、タイトル、ドメイン、メモを保存
- オプションでコレクションに所属
- ファビコンはbase64形式で内部保存

## セキュリティ

- セッションベースの認証
- HTTPオンリークッキーでXSS攻撃を防止
- ユーザースコープのデータアクセス制御
- 画像はすべて内部保存（外部依存なし）

## 開発

### スクリプト
- `npm run dev` - 開発サーバー起動
- `npm run build` - プロダクションビルド
- `npm run check` - TypeScript 型チェック

### プロジェクト構成
```
├── client/              # フロントエンドコード
│   ├── src/
│   │   ├── components/  # Reactコンポーネント
│   │   ├── pages/       # ページコンポーネント
│   │   └── lib/         # ユーティリティ
├── server/              # バックエンドコード
│   ├── routes.ts        # APIルート
│   ├── storage.ts       # データアクセス層
│   └── utils/           # サーバーユーティリティ
├── shared/              # 共有コード
│   └── schema.ts        # データベーススキーマ
└── dist/                # ビルド済みサーバー出力
```

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。
