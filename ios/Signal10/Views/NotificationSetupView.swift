import SwiftUI
import UIKit
import UserNotifications

struct NotificationSetupView: View {
    @ObservedObject var manager: NotificationManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    ZStack {
                        Circle().fill(SignalTheme.coral.opacity(0.18))
                        Image(systemName: manager.isScheduled ? "bell.badge.fill" : "bell")
                            .font(.system(size: 34, weight: .semibold))
                            .foregroundStyle(SignalTheme.ink)
                    }
                    .frame(width: 76, height: 76)
                    .accessibilityHidden(true)

                    Text("朝のSIGNALを\n受け取る")
                        .font(.system(.largeTitle, design: .serif))

                    Text("毎朝6:35（日本時間）に、生成AIニュース Top 10を確認する時刻をお知らせします。通知を開くと最新版を取得し、通信できない場合は保存済みの朝刊を表示します。")
                        .font(.body)
                        .foregroundStyle(SignalTheme.inkSoft)
                        .lineSpacing(6)

                    statusCard

                    if let error = manager.errorMessage {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
                .padding(22)
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    actionButton
                    Text("通知許可は、この画面で有効にした場合だけ要求します。端末外へ個人情報を送信しません。")
                        .font(.caption)
                        .foregroundStyle(SignalTheme.inkSoft)
                }
                .padding(.horizontal, 22)
                .padding(.top, 12)
                .padding(.bottom, 8)
                .background(.regularMaterial)
            }
            .background(SignalTheme.paper.ignoresSafeArea())
            .foregroundStyle(SignalTheme.ink)
            .navigationTitle("通知")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完了") { dismiss() }.fontWeight(.bold)
                }
            }
        }
        .task { await manager.refresh() }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var statusCard: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(manager.isScheduled ? SignalTheme.lime : SignalTheme.line)
                .frame(width: 10, height: 10)
            VStack(alignment: .leading, spacing: 3) {
                Text(manager.isScheduled ? "通知は設定済みです" : authorizationDescription)
                    .font(.headline)
                Text(manager.isScheduled ? "毎日 06:35 JST" : "初回起動時には表示しません")
                    .font(.caption)
                    .foregroundStyle(SignalTheme.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(SignalTheme.paperDeep, in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var actionButton: some View {
        if manager.authorizationStatus == .denied {
            Button("iOSの設定を開く") {
                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                UIApplication.shared.open(url)
            }
            .signalPrimaryButton()
        } else if manager.isScheduled {
            Button("通知を停止する", role: .destructive) {
                Task { await manager.disable() }
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .buttonStyle(.bordered)
        } else {
            Button("毎朝の通知を有効にする") {
                Task { await manager.enable() }
            }
            .signalPrimaryButton()
        }
    }

    private var authorizationDescription: String {
        switch manager.authorizationStatus {
        case .authorized, .provisional, .ephemeral: "通知を予約できます"
        case .denied: "通知がiOS設定でオフです"
        case .notDetermined: "通知はまだ許可されていません"
        @unknown default: "通知状態を確認できません"
        }
    }
}

private extension View {
    func signalPrimaryButton() -> some View {
        font(.headline)
            .foregroundStyle(SignalTheme.paper)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(SignalTheme.ink, in: RoundedRectangle(cornerRadius: 8))
    }
}
