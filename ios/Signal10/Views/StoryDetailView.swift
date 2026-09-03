import SwiftUI

struct StoryDetailView: View {
    let story: Story
    @Environment(\.dismiss) private var dismiss
    @AccessibilityFocusState private var titleFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    RankBadge(rank: story.rank)
                        .padding(.bottom, 24)

                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 7) {
                            detailChips
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            detailChips
                        }
                    }

                    Text(story.title)
                        .font(.system(.largeTitle, design: .serif))
                        .lineSpacing(4)
                        .padding(.top, 24)
                        .accessibilityFocused($titleFocused)

                    Text(story.originalTitle)
                        .font(.system(.caption, design: .monospaced).weight(.semibold))
                        .foregroundStyle(SignalTheme.inkSoft)
                        .padding(.top, 16)

                    Text(story.summary)
                        .font(.system(.title3, design: .serif))
                        .lineSpacing(8)
                        .padding(.vertical, 34)

                    SectionHeading(kicker: "WHAT HAPPENED", title: "ニュースの内容")
                    VStack(spacing: 0) {
                        ForEach(Array(story.points.enumerated()), id: \.offset) { index, point in
                            HStack(alignment: .top, spacing: 14) {
                                Text(String(format: "%02d", index + 1))
                                    .font(.system(.caption, design: .monospaced).weight(.bold))
                                    .foregroundStyle(SignalTheme.coral)
                                    .padding(.top, 2)
                                Text(point)
                                    .font(.body)
                                    .lineSpacing(6)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(.vertical, 18)
                            if index < story.points.count - 1 {
                                Divider().overlay(SignalTheme.line)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("WHY IT MATTERS")
                            .font(.system(.caption2, design: .monospaced).weight(.black))
                            .tracking(1.2)
                        Text("なぜ重要か")
                            .font(.title3.bold())
                        Text(story.whyItMatters)
                            .font(.body)
                            .lineSpacing(6)
                    }
                    .padding(20)
                    .background(SignalTheme.lime.opacity(0.72), in: RoundedRectangle(cornerRadius: 2))
                    .padding(.vertical, 34)

                    if !story.relatedSources.isEmpty {
                        SectionHeading(kicker: "CROSS CHECK", title: "関連ソース")
                        FlowLinks(sources: story.relatedSources)
                            .padding(.top, 16)
                            .padding(.bottom, 34)
                    }

                    Link(destination: story.url) {
                        HStack {
                            Text("\(story.source)で原文を読む")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                        }
                        .font(.headline)
                        .foregroundStyle(SignalTheme.paper)
                        .padding(.horizontal, 18)
                        .frame(minHeight: 54)
                        .background(SignalTheme.ink, in: RoundedRectangle(cornerRadius: 4))
                    }
                    .accessibilityHint("外部ブラウザで原文を開きます")

                    Text("公開日: \(SignalFormat.shortDate(story.publishedAt))（日本時間）")
                        .font(.caption)
                        .foregroundStyle(SignalTheme.inkSoft)
                        .padding(.top, 14)
                        .padding(.bottom, 40)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
            }
            .scrollIndicators(.hidden)
            .background(SignalTheme.paper.ignoresSafeArea())
            .foregroundStyle(SignalTheme.ink)
            .toolbarBackground(SignalTheme.paper.opacity(0.96), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("閉じる") { dismiss() }
                        .font(.subheadline.bold())
                }
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(
                        item: story.url,
                        subject: Text(story.title),
                        message: Text(story.summary)
                    ) {
                        Image(systemName: "square.and.arrow.up")
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("ニュースを共有")
                }
            }
        }
        .onAppear { titleFocused = true }
    }

    @ViewBuilder
    private var detailChips: some View {
        DetailChip(text: story.category.rawValue)
        DetailChip(text: story.verification.rawValue)
        DetailChip(text: "重要度 \(story.impactScore)/100")
    }
}

private struct DetailChip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(.caption2, design: .monospaced).weight(.bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .overlay(Capsule().stroke(SignalTheme.line, lineWidth: 1))
            .fixedSize(horizontal: true, vertical: true)
    }
}

private struct SectionHeading: View {
    let kicker: String
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(kicker)
                .font(.system(.caption2, design: .monospaced).weight(.black))
                .tracking(1.3)
            Text(title).font(.title2.bold())
        }
    }
}

private struct FlowLinks: View {
    let sources: [RelatedSource]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(sources) { source in
                Link(destination: source.url) {
                    HStack {
                        Text(source.name)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                    }
                    .font(.subheadline.bold())
                    .padding(.horizontal, 14)
                    .frame(minHeight: 44)
                    .overlay(RoundedRectangle(cornerRadius: 22).stroke(SignalTheme.line, lineWidth: 1))
                }
                .accessibilityHint("外部ブラウザで関連ソースを開きます")
            }
        }
    }
}
