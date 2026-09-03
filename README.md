# SIGNAL 10

生成AIの重要ニュースを、毎朝6:30（日本時間）に重要度順で10本だけ届ける日本語ダイジェストです。見出しだけでなく、3つの要点、重要な理由、原文、関連ソースまで読めます。

限定公開アプリ: [https://signal-10.minty-trail-0785.chatgpt.site](https://signal-10.minty-trail-0785.chatgpt.site)

## 主な機能

- 公式AIラボ、主要テック企業、研究、海外・国内メディアの計43ソースを2時間ごとに巡回
- URLと見出しの類似度から同じ出来事を統合し、重複掲載を防止
- 公式性、影響範囲、報道の広がり、新しさをもとに上位10件を選定
- 日本語の要約、3つの要点、「なぜ重要か」、原文・関連ソースを表示
- 毎朝6:30にGitHub Issueを作成し、リポジトリ所有者へ通知
- Slack、Discord、任意Webhookへの追加配信
- カテゴリ絞り込み、共有、ブラウザ通知、モバイル表示、オフライン時の保存版表示
- 各収集元の成功・失敗を `public/data/source-health.json` に記録し、主要11公式ソースの停止を別枠で検知

## 毎日の流れ

GitHub Actionsの `Collect and deliver SIGNAL 10` が次を自動実行します。

1. 2時間ごとの実行では全ソースを取得し、14日分の候補アーカイブと取得状況だけを更新します。
2. 06:30 JSTの実行で直近60時間（候補不足時は最大14日）から重複トピックを束ね、最大48件の有力候補を抽出します。
3. 重要度順の10件を選びます。OpenAI APIを設定している場合は、別々の生成・検証モデルで日本語要約を作り、過去7日間に配信した話題は再掲載しません。
4. 本番ビルドとテストに成功した号だけを保存し、当日のGitHub Issueを作成して所有者へ割り当てます。
5. Slack、Discord、汎用Webhookが設定されていれば同じ号を配信します。

APIキーが未設定、要約の根拠が不足、または検証モデルが利用できない場合も、原文の見出し・本文を使った決定的なフォールバックで10件の配信を継続します。候補が10件未満のときは、不完全な号で上書きせず直前の正常な号を保持します。

AI要約では、見出し・要約・3要点を固定ID付きの主張に分け、各主張に同じ記事内の原文引用を必須化します。生成モデルと異なるモデルが50主張を個別に検証し、1主張でも未確認なら、その記事のAI文章をすべて原文フォールバックへ戻します。「なぜ重要か」はカテゴリ別の決定的な説明を使います。

全体の取得成功率・直近21日の更新率に加えて、主要な公式ソース群も同じ基準で監視します。主要ソースの取得や更新が基準を下回った号は `degraded` と表示し、通知にも収集状態を明記します。

## ローカルで動かす

Node.js 22.13以降が必要です。

```bash
npm install
npm run dev
```

品質チェックは次の1コマンドです。

```bash
npm run check
```

ニュースを手動更新する場合:

```bash
npm run news:update
```

## 通知先を追加する

GitHub通知は追加設定なしで動きます。別の通知先を使う場合、リポジトリの **Settings → Secrets and variables → Actions** に以下を登録します。

| 名前 | 種別 | 用途 |
| --- | --- | --- |
| `PUBLIC_APP_URL` | Variable | 通知に載せる公開サイトURL |
| `SLACK_WEBHOOK_URL` | Secret | Slack Incoming Webhook |
| `DISCORD_WEBHOOK_URL` | Secret | Discord Webhook |
| `GENERIC_WEBHOOK_URL` | Secret | JSONを受け取る任意のHTTPSエンドポイント |
| `OPENAI_API_KEY` | Secret | 検証付き日本語要約を有効にする場合のみ |
| `OPENAI_MODEL` | Variable | 省略時は `gpt-5.4-mini` |
| `OPENAI_VERIFIER_MODEL` | Variable | 省略時は `gpt-4.1-mini`。生成モデルと同じIDは使用不可 |

`OPENAI_API_KEY` は通常運用には不要です。未設定でも収集・順位付け・原文要点・GitHub通知は動作します。設定時だけ、異なる2モデルによる日本語の生成・主張単位検証を追加します。実際の秘密情報はリポジトリへコミットしないでください。

ブラウザ通知はサイト内の「通知を受け取る」から許可できます。Web Pushサーバーを使わないため、ブラウザ通知は新しい朝刊をページで読み込んだ時点で表示されます。ページを閉じていても必ず届く通知には、GitHub IssueまたはWebhook配信を使ってください。

## 収集対象とランキング

ソース定義は `config/sources.json` で管理します。OpenAI、Anthropic、Google、Meta、Microsoft、AWS、NVIDIA、Hugging Face、World Labsなどの公式発表を最優先し、TechCrunch、Ars Technica、MIT Technology Review、The Verge、ITmedia、Publickey、arXivなどの直接フィードで補完します。Reuters、AP、Impress Watchを含むフィード未提供媒体は、複数言語のGoogle News発見フィード経由で候補へ加えます。

ランキングは以下を加点します。

- 一次情報・情報源の信頼度
- モデル公開、API変更、規制、買収・提携などの影響範囲
- 複数の独立ソースによる確認
- 公開からの経過時間

チュートリアル、広告記事、単独のプレプリントは相対的に減点し、同一ソースと同一カテゴリへの偏りも制限します。性能値や効果が発表元の自己評価である場合は、本文で明示します。

## データ

- `public/data/latest.json`: Web表示と通知に使う最新号
- `public/data/archive/YYYY-MM-DD.json`: 日別の配信号
- `public/data/source-health.json`: 直近の取得状況
- `data/news-archive.json`: 14日分の収集候補
- `data/source-state.json`: ETag、更新日時、連続失敗数などの取得状態

## 網羅性について

公開情報は、フィード未提供、地域制限、公開後の訂正、短時間での削除などがあるため「絶対に抜け漏れゼロ」は保証できません。SIGNAL 10は、43ソースの定期巡回、短いフィードから記事が消える前の2時間収集、複数言語の発見用フィード、取得失敗の可視化によって、実用上の見逃しを減らす設計です。

## ライセンス

MIT
