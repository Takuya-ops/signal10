import SwiftUI

struct FeedView: View {
    @EnvironmentObject private var store: DigestStore
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var notifications = NotificationManager()
    @State private var selectedCategory: NewsCategory?
    @State private var selectedStory: Story?
    @State private var showsNotifications = false

    var body: some View {
        NavigationStack {
            Group {
                if let digest = store.digest {
                    feed(digest)
                } else if store.isRefreshing {
                    ProgressView("朝刊を読み込んでいます")
                        .tint(SignalTheme.ink)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ContentUnavailableView {
                        Label("朝刊を読み込めません", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(store.errorMessage ?? "通信環境を確認して、もう一度お試しください。")
                    } actions: {
                        Button("再読み込み") {
                            Task { await store.refresh() }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(SignalTheme.ink)
                    }
                }
            }
            .background(SignalTheme.paper.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(SignalTheme.paper.opacity(0.96), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    BrandMark()
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    ShareLink(
                        item: digestShareText,
                        subject: Text("SIGNAL 10"),
                        message: Text("今日の生成AIニュース Top 10")
                    ) {
                        Image(systemName: "square.and.arrow.up")
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("この朝刊を共有")

                    Button {
                        showsNotifications = true
                    } label: {
                        Image(systemName: notifications.isScheduled ? "bell.badge.fill" : "bell")
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(SignalTheme.coral, SignalTheme.ink)
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel(notifications.isScheduled ? "朝の通知は設定済み" : "朝の通知を設定")
                }
            }
        }
        .tint(SignalTheme.ink)
        .sheet(item: $selectedStory) { story in
            StoryDetailView(story: story)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showsNotifications) {
            NotificationSetupView(manager: notifications)
        }
        .task {
            await notifications.refresh()
            await store.loadIfNeeded()
        }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(300))
                guard !Task.isCancelled else { return }
                await store.refresh()
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task {
                    await notifications.refresh()
                    await store.refresh()
                }
            }
        }
    }

    private func feed(_ digest: Digest) -> some View {
        ScrollView {
            LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                HeroView(digest: digest)
                StatusStrip(
                    digest: digest,
                    origin: store.origin,
                    isRefreshing: store.isRefreshing,
                    refreshError: store.errorMessage
                )

                Section {
                    let stories = filteredStories(in: digest)
                    if stories.isEmpty {
                        ContentUnavailableView(
                            "該当するニュースはありません",
                            systemImage: "line.3.horizontal.decrease.circle",
                            description: Text("別のカテゴリを選んでください。")
                        )
                        .frame(minHeight: 280)
                    } else {
                        ForEach(stories) { story in
                            StoryCard(story: story) {
                                selectedStory = story
                            }
                        }
                    }
                } header: {
                    CategoryPicker(
                        digest: digest,
                        selection: $selectedCategory
                    )
                }

                FeedFooter(sourceCount: digest.checkedSources)
            }
        }
        .scrollIndicators(.hidden)
        .refreshable {
            await store.refresh()
        }
        .overlay(alignment: .top) {
            if store.isRefreshing {
                ProgressView()
                    .tint(SignalTheme.ink)
                    .padding(10)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.top, 8)
                    .accessibilityLabel("最新版を確認中")
            }
        }
    }

    private func filteredStories(in digest: Digest) -> [Story] {
        digest.orderedStories.filter { selectedCategory == nil || $0.category == selectedCategory }
    }

    private var digestShareText: String {
        guard let digest = store.digest else {
            return "SIGNAL 10｜生成AIニュース Top 10"
        }
        let stories = digest.orderedStories.map { story in
            "#\(story.rank) \(story.title)\n\(story.url.absoluteString)"
        }
        return (["SIGNAL 10｜\(SignalFormat.edition(digest.edition))"] + stories)
            .joined(separator: "\n\n")
    }
}

private struct BrandMark: View {
    var body: some View {
        HStack(spacing: 9) {
            Text("S10")
                .font(.system(.caption2, design: .monospaced).weight(.bold))
                .frame(width: 32, height: 32)
                .overlay(Circle().stroke(SignalTheme.ink, lineWidth: 1.2))
            Text("SIGNAL 10")
                .font(.system(.caption, design: .rounded).weight(.black))
                .tracking(1.1)
        }
        .foregroundStyle(SignalTheme.ink)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("SIGNAL 10")
    }
}

private struct HeroView: View {
    let digest: Digest
    @ScaledMetric(relativeTo: .largeTitle) private var titleSize = 50

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Circle()
                .fill(SignalTheme.blue)
                .frame(width: 190, height: 190)
                .offset(x: 105, y: -88)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                Text("\(SignalFormat.edition(digest.edition)) · 06:30 JST")
                    .font(.system(.caption2, design: .monospaced).weight(.bold))
                    .tracking(1.2)
                    .padding(.bottom, 22)

                Text("生成AIの「今日」を、")
                    .font(.system(size: titleSize, weight: .regular, design: .serif))
                    .minimumScaleFactor(0.72)

                Text("10本だけ。")
                    .font(.system(size: titleSize, weight: .regular, design: .serif))
                    .background(alignment: .bottom) {
                        Rectangle()
                            .fill(SignalTheme.lime)
                            .frame(height: max(7, titleSize * 0.13))
                            .offset(y: -2)
                    }
                    .padding(.bottom, 32)

                HStack(alignment: .top, spacing: 12) {
                    Circle()
                        .fill(SignalTheme.coral)
                        .frame(width: 9, height: 9)
                        .shadow(color: SignalTheme.coral.opacity(0.28), radius: 0, x: 0, y: 0)
                        .padding(.top, 3)
                    VStack(alignment: .leading, spacing: 5) {
                        Text("\(digest.successfulSources)/\(digest.checkedSources) SOURCES CONNECTED")
                            .font(.system(.caption2, design: .monospaced).weight(.bold))
                            .tracking(0.9)
                        Text("公式発表・報道・研究を横断")
                            .font(.caption)
                            .foregroundStyle(SignalTheme.inkSoft)
                    }
                }

                Divider()
                    .overlay(SignalTheme.line)
                    .padding(.vertical, 24)

                Text(digest.editorialNote)
                    .font(.body)
                    .foregroundStyle(SignalTheme.inkSoft)
                    .lineSpacing(6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 20)
        .padding(.top, 34)
        .padding(.bottom, 30)
        .clipped()
        .foregroundStyle(SignalTheme.ink)
    }
}

private struct StatusStrip: View {
    let digest: Digest
    let origin: DigestOrigin
    let isRefreshing: Bool
    let refreshError: String?

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 14) {
                Text(editionLabel)
                    .font(.system(.caption2, design: .monospaced).weight(.black))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(editionColor)

                status("\(digest.successfulSources)/\(digest.checkedSources)件の情報源に接続")
                divider
                status("\(digest.candidateCount)件から10本を選定")
                divider
                status("重複トピックを統合")
                divider
                status("最終更新 \(SignalFormat.shortTime(digest.generatedAt))")

                if origin != .live {
                    Text("\(origin.label)を表示中")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(SignalTheme.paperDeep, in: Capsule())
                }
                if let refreshError {
                    Label("更新を確認できません・表示中の号を保持", systemImage: "wifi.exclamationmark")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(SignalTheme.lime.opacity(0.72), in: Capsule())
                        .accessibilityHint(refreshError)
                }
                if isRefreshing {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
        }
        .scrollIndicators(.hidden)
        .overlay(alignment: .top) { Divider().overlay(SignalTheme.line) }
        .overlay(alignment: .bottom) { Divider().overlay(SignalTheme.line) }
        .accessibilityElement(children: .combine)
    }

    private func status(_ value: String) -> some View {
        Text(value)
            .font(.caption.weight(.semibold))
            .fixedSize()
    }

    private var editionLabel: String {
        if digest.status == .degraded { return "PARTIAL EDITION" }
        if origin == .live && refreshError == nil { return "LIVE EDITION" }
        return "LAST GOOD EDITION"
    }

    private var editionColor: Color {
        editionLabel == "LIVE EDITION" ? SignalTheme.coral : SignalTheme.lime
    }

    private var divider: some View {
        Circle().fill(SignalTheme.inkSoft.opacity(0.45)).frame(width: 4, height: 4)
    }
}

private struct CategoryPicker: View {
    let digest: Digest
    @Binding var selection: NewsCategory?
    @Environment(\.accessibilityDifferentiateWithoutColor) private var differentiateWithoutColor

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6) {
                categoryButton(title: "すべて", count: digest.stories.count, category: nil)
                ForEach(NewsCategory.allCases) { category in
                    categoryButton(
                        title: category.rawValue,
                        count: digest.stories.filter { $0.category == category }.count,
                        category: category
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .scrollIndicators(.hidden)
        .background(SignalTheme.paper.opacity(0.97))
        .overlay(alignment: .bottom) { Divider().overlay(SignalTheme.line) }
    }

    private func categoryButton(title: String, count: Int, category: NewsCategory?) -> some View {
        let selected = selection == category
        return Button {
            selection = category
        } label: {
            HStack(spacing: 5) {
                if selected && differentiateWithoutColor {
                    Image(systemName: "checkmark")
                }
                Text(title)
                Text("\(count)")
                    .font(.caption2.monospacedDigit())
                    .opacity(0.65)
            }
            .font(.caption.weight(.bold))
            .foregroundStyle(selected ? SignalTheme.paper : SignalTheme.inkSoft)
            .padding(.horizontal, 13)
            .frame(minHeight: 44)
            .background(selected ? SignalTheme.ink : Color.clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title)、\(count)件\(selected ? "、選択中" : "")")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct FeedFooter: View {
    let sourceCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("HOW IT WORKS")
                .font(.system(.caption2, design: .monospaced).weight(.bold))
                .tracking(1.4)
                .foregroundStyle(SignalTheme.coral)
            Text("多く集めて、\n少なく届ける。")
                .font(.system(.largeTitle, design: .serif))
            Text("\(sourceCount)の公開情報源を定期巡回し、同じ出来事をまとめ、公式性・影響範囲・報道の広がり・新しさから上位10件を選びます。")
                .font(.body)
                .foregroundStyle(SignalTheme.paper.opacity(0.72))
                .lineSpacing(6)
            Text("すべての公開情報を完全に網羅することは保証できません。取得失敗を記録し、主要な公式情報源を優先して補完します。")
                .font(.caption)
                .foregroundStyle(SignalTheme.paper.opacity(0.58))
                .padding(.top, 16)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 54)
        .background(SignalTheme.ink)
        .foregroundStyle(SignalTheme.paper)
    }
}
