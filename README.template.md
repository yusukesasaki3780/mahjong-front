# Mahjong App 🀄️

生成日: {{ date }}

## 1. 📚 プロジェクト紹介
Mahjong App は、麻雀店スタッフ向けの勤怠管理・成績管理 Web アプリです。モバイル入力を第一に考えた UI/UX を備え、シフト登録、成績集計、ランキング、統計ダッシュボードまでをワンストップで提供します。

## 2. 🧩 機能一覧
- 🔐 **認証**: JWT ベースのログイン / ログアウト。
- 🙋 **プロフィール管理**: 基本情報の編集、アバター管理。
- 📅 **シフト管理**: 月/週表示、ドロワー編集、休憩入力、前借控除管理。
- 🀄️ **成績管理**: 三麻/四麻の登録、チップ計算、自動バリデーション。
- 🏠 **ダッシュボード**: 主要機能へのアクセス、メトリクス表示。
- 🏆 **ランキング**: ゲーム種別・期間でのランキング切り替え。
- ⚙️ **ゲーム設定**: 手当・ゲーム代・賃金体系などの設定とバリデーション。
- 📊 **統計ダッシュボード**: 期間別の収支推移、着順割合、サマリー表示。
- 📱 **スマホ最適化**: max-width 480px、44px ボタン基準、タップ優先インターフェイス。

## 3. 🏗 システム構成図（アスキーアート）
```
┌────────┐     HTTPS      ┌────────────┐      ┌────────┐
│ Frontend │ ───────────▶ │ RESTful API │ ───▶ │ Backend │
│ (Vue)    │              │ (Ktor)      │      │ Services│
└────────┘              └────────────┘      └────┬───┘
                                                      │
                                                 ┌────▼────┐
                                                 │PostgreSQL│
                                                 └─────────┘
```

## 4. 🛠 技術スタック
- **Frontend**: Vue 3 / TypeScript / Vite / Naive UI / ECharts / dayjs
- **Backend**: Kotlin / Ktor / Exposed / PostgreSQL / Swagger / JWT
- **CI/CD**: GitHub Actions / npm / Gradle
- **その他**: Docker（任意）、Playwright（E2E）

## 5. 🚀 セットアップ方法

### フロントエンド (mahjong-front)
```bash
cd mahjong-front
npm install
npm run dev   # 開発
npm run build # 本番ビルド
```

### バックエンド (mahjong-api)
`.env` 例:
```
PORT=8080
DATABASE_URL=jdbc:postgresql://localhost:5432/mahjong
DATABASE_USER=mahjong
DATABASE_PASSWORD=secret
JWT_SECRET=super-secret
```
セットアップ:
```bash
cd mahjong-api
./gradlew clean build
./gradlew run
```

## 6. 🗂 ディレクトリ構造
```
mahjong-app/
├─ mahjong-front/
│  ├─ src/
│  │  ├─ api/
│  │  ├─ components/
│  │  ├─ pages/
│  │  └─ views/
│  ├─ public/
│  └─ package.json
└─ mahjong-api/
   ├─ src/main/kotlin/
   │  ├─ routes/
   │  ├─ services/
   │  └─ repositories/
   ├─ resources/
   └─ build.gradle.kts
```

## 7. 📑 API 仕様
- **Swagger**: `https://api.example.com/swagger`（本番 URL に合わせて置き換えてください）

### 主なエンドポイント
| 機能         | メソッド | エンドポイント                     |
|--------------|----------|------------------------------------|
| 認証         | POST     | `/auth/login`, `/auth/logout`      |
| シフト       | GET/POST | `/users/{id}/shifts`               |
| シフト統計   | GET      | `/users/{id}/shifts/stats`         |
| 成績         | CRUD     | `/users/{id}/results`              |
| ランキング   | GET      | `/ranking`                         |
| ゲーム設定   | GET/PUT  | `/users/{id}/settings`             |
| プロフィール | GET/PUT  | `/users/{id}`                      |
| 給与         | GET      | `/users/{id}/salary/{yyyy-mm}`     |

> **注意**: 実際のベース URL やパラメータは環境に合わせて更新してください。

---
GitHub Actions で `README.md` を自動生成する際は、この `README.template.md` を読み込み、`{{ date }}` を置換してご利用ください。
