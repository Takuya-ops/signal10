# SIGNAL 10 for iOS

Web版と同じ公開ダイジェストを読む、iOS 17以降向けのネイティブSwiftUIアプリです。外部ライブラリやWebViewは使用していません。

## 実行

1. `Signal10.xcodeproj` をXcodeで開きます。
2. `Signal10` schemeと任意のiPhone Simulatorを選びます。
3. Runを押します。

実機で動かす場合は、Targetの **Signing & Capabilities** で自分のApple Developer Teamを選択してください。Bundle IDは必要に応じて変更できます。

## データと通知

- 最新号: `https://raw.githubusercontent.com/Takuya-ops/signal10/main/public/data/latest.json`
- 初回オフライン時: アプリ同梱の正常号
- 2回目以降のオフライン時: 最後に検証・保存できた正常号
- 通知: 利用者が明示的に有効化した場合のみ、毎朝6:35 JSTにローカル通知

ローカル通知はアプリが終了していても表示できますが、本文は「朝刊が公開された」という固定案内です。通知そのものへ当日の1位見出しを確実に入れるには、Apple Push Notification serviceと配信サーバーが別途必要です。

## テスト

```bash
xcodebuild test \
  -project Signal10.xcodeproj \
  -scheme Signal10 \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' \
  CODE_SIGNING_ALLOWED=NO
```

App Store/TestFlightへの提出にはApple Developer Program、署名、App Store Connect上のアプリ登録が必要です。リポジトリには証明書やAPIキーを保存しないでください。
