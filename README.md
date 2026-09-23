# つぎどこ

2軒目を、1軒だけ。

飲み会の2軒目を決めるためのPWA。条件を設定して「さがす」と、近くの評判の良い店を **1軒だけ** 提案する。合わなければNGで次の1軒、合えばOKで決定。一覧・ランキング・比較は持たない。

店舗情報は [ホットペッパーグルメ Webサービス](https://webservice.recruit.co.jp/) を利用する。

## ドキュメント

| 文書 | ID | 内容 |
| --- | --- | --- |
| [01_要件定義書](docs/01_要件定義書.md) | REQ-001 | 目的・機能要件・検索条件・受入条件 |
| [02_基本設計書](docs/02_基本設計書.md) | BAS-001 | 全体構成・技術スタック・画面フロー・ディレクトリ |
| [03_フロントエンド設計書](docs/03_フロントエンド設計書.md) | FE-001 | 画面・状態・提示ロジック・デザイン・スマホでの体感 |
| [04_バックエンドAP設計書](docs/04_バックエンドAP設計書.md) | BE-001 | API I/F・外部API境界・セキュリティ |
| [05_データ設計書](docs/05_データ設計書.md) | DATA-001 | Web Storage・永続データ・プライバシー |
| [06_テスト・CI設計書](docs/06_テスト・CI設計書.md) | TEST-001 | テスト観点・CI/CD・手動確認項目 |

設計書の内容とコードは一致させる。挙動を変えるPRでは該当する設計書も同じPRで更新する。

## モック

| [トップ](docs/mock/01_トップ画面.png) | [結果](docs/mock/02_結果画面.png) | [候補なし](docs/mock/03_候補なし.png) | [履歴](docs/mock/04_履歴シート.png) |
| --- | --- | --- | --- |
| <img src="docs/mock/01_トップ画面.png" width="180"> | <img src="docs/mock/02_結果画面.png" width="180"> | <img src="docs/mock/03_候補なし.png" width="180"> | <img src="docs/mock/04_履歴シート.png" width="180"> |

生成元は [`docs/mock/mock.html`](docs/mock/mock.html)。`node docs/mock/shot.mjs` で再生成できる（[手順](docs/mock/README.md)）。

## ステータス

MVPの実装が一通り完了。デプロイは未実施。

| 領域 | 状態 |
| --- | --- |
| Worker（`/api/search`） | 完了 |
| F/Eロジック（storage / relax / shuffle / reducer） | 完了 |
| 画面 | 完了 |
| PWA | 完了 |
| CI | 完了 |
| 実APIでの動作確認 | **未** — HotPepper APIキーが必要 |
| デプロイ | **未** — Cloudflareの認証情報が必要 |

テスト409件（Worker 187 / F/E 222）。

## 技術スタック

Vite + React + TypeScript / Cloudflare Workers + Static Assets / HotPepper グルメサーチAPI

```text
src/       F/E（React）。画面・提示制御・Web Storage
worker/    Cloudflare Worker。/api/search とHotPepperとの境界
shared/    F/EとWorkerで共有するAPI I/F型と定数
scripts/   予算マスタ生成・アイコン生成
tests/     スタイルシート横断の検証
docs/      設計書とモック
```

## セットアップ

```bash
npm ci
cp .dev.vars.example .dev.vars   # HotPepper APIキーと合言葉を記入（.dev.vars は gitignore 済み）
```

**`npm install` ではなく `npm ci` を使う。** npm 10 系は本プロジェクトの依存関係（vitest の optional peer）で
ideal tree の構築に失敗する。依存を追加・更新するときだけ `npx npm@11 install` を使い、
生成された `package-lock.json` をコミットする。

改行コードは `.gitattributes` で LF に固定している。Windows でも追加設定なしで `format:check` が通る。

## 開発

```bash
npm run dev          # F/E（Vite）。/api/* は :8787 へプロキシ
npm run dev:worker   # Worker（wrangler dev）
```

## 検証

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test          # F/E（jsdom）
npm run test:worker   # Worker（workerd 実runtime）
npm run build
```

CIはPRとmainへのpushで同じ内容を実行する（`.github/workflows/ci.yml`）。
テストは外部APIへ通信しない。

## 環境変数

| 名前 | 種別 | 用途 |
| --- | --- | --- |
| `HOTPEPPER_API_KEY` | Secret | HotPepper APIキー。デプロイ時に GitHub Secret から Worker へ反映される |
| `APP_PASSCODE` | Secret | `/api/search` の合言葉。未設定なら500を返す。同上 |
| `ALLOWED_ORIGIN` | Var（任意） | `/api/search` を許可するOrigin。未設定ならWorker自身のオリジン。F/Eを別ポートで動かす開発時だけ `.dev.vars` に書く |
| `HOTPEPPER_ENDPOINT` | Var（任意） | HotPepperのエンドポイント差し替え。開発時のみ |

APIキーと合言葉をリポジトリへコミットしない。ローカルは `.dev.vars`、本番は Cloudflare Secret を使う。

レート制限（IP単位・60秒30回）は `wrangler.jsonc` のバインディングで効く。Cloudflareダッシュボードでの設定は不要。

## デプロイ手順（iPhoneだけで完結します）

ターミナルは不要です。GitHubとCloudflareのWeb画面だけで進められます。

**1. Cloudflareで APIトークンとアカウントIDを取る**

- [dash.cloudflare.com](https://dash.cloudflare.com/) → 右上メニュー → My Profile → API Tokens
- Create Token → テンプレート **Edit Cloudflare Workers** → Continue → Create
- 表示されたトークンをコピー（**この画面を離れると二度と見られません**）
- Workers & Pages の画面に出ている **Account ID** もコピー

**2. GitHubにSecretを4つ登録する**

リポジトリ → Settings → Secrets and variables → Actions → New repository secret

| 名前 | 値 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 手順1のトークン |
| `CLOUDFLARE_ACCOUNT_ID` | 手順1のアカウントID |
| `HOTPEPPER_API_KEY` | ホットペッパーのAPIキー |
| `APP_PASSCODE` | 自分で決めた合言葉（24文字以上のランダムな文字列） |

`APP_PASSCODE` は身内だけが使えるようにするための合言葉です。アプリを初めて開いたときに1回入力すると、その端末では次回から聞かれません。**未登録のままデプロイすると検索が500で失敗します**（誰でも使える状態にしないため）。変えたいときはSecretを更新して再デプロイすると、全端末で入力し直しになります。

**3. 予算マスタを実データにする**

Actions タブ → 左の「予算マスタを生成」 → Run workflow → Run workflow

暫定データが実データへ置き換わり、`main` へ自動でコミットされます。

**4. デプロイする**

手順3が予算マスタを更新すると、続けて Deploy が自動的に走ります。
走らない場合は Actions タブ → 「Deploy」 → Run workflow から手動実行してください。

完了すると Cloudflare の Workers & Pages に `tsugidoko` が現れ、
`https://tsugidoko.<サブドメイン>.workers.dev` で開けます。

`HOTPEPPER_API_KEY` と `APP_PASSCODE` はデプロイ時に Worker の Secret へ自動で反映されます。
`ALLOWED_ORIGIN` の設定は不要です（未設定ならWorker自身のオリジンを許可します）。

**5. 実機で確認する**

デプロイ先のURLをiPhoneで開き、[TEST-001 §8](docs/06_テスト・CI設計書.md) の手動確認項目を上から順に確認します。
