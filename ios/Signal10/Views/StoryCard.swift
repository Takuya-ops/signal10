import SwiftUI

struct StoryCard: View {
    let story: Story
    let action: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .bottomTrailing) {
                if story.rank <= 3 {
                    Circle()
                        .fill(accent.opacity(0.82))
                        .frame(width: story.rank == 1 ? 210 : 150)
                        .offset(x: 88, y: 86)
                        .accessibilityHidden(true)
                }

                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 10) {
                        RankBadge(rank: story.rank)
                        Text(story.category.code)
                            .font(.system(.caption2, design: .monospaced).weight(.bold))
                            .tracking(1.1)
                        Spacer()
                        Text("IMPACT \(story.impactLabel.rawValue)")
                            .font(.system(.caption2, design: .monospaced).weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(SignalTheme.impactColor(story.impactLabel), in: Capsule())
                            .overlay(Capsule().stroke(SignalTheme.ink, lineWidth: 1))
                    }

                    Spacer(minLength: story.rank == 1 ? 58 : 34)

                    HStack(spacing: 8) {
                        Text(sourceInitials)
                            .font(.system(.caption2, design: .monospaced).weight(.bold))
                            .frame(width: 26, height: 26)
                            .overlay(Circle().stroke(SignalTheme.ink, lineWidth: 1))
                        Text(story.source.uppercased())
                        Text("/").foregroundStyle(SignalTheme.line)
                        Text(SignalFormat.shortDate(story.publishedAt))
                    }
                    .font(.system(.caption2, design: .monospaced).weight(.semibold))
                    .foregroundStyle(SignalTheme.inkSoft)

                    Text(story.title)
                        .font(titleFont)
                        .lineSpacing(2)
                        .padding(.top, 14)
                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : (story.rank == 1 ? 4 : 3))

                    Text(story.summary)
                        .font(.subheadline)
                        .foregroundStyle(SignalTheme.inkSoft)
                        .lineSpacing(5)
                        .padding(.top, 14)
                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : (story.rank == 1 ? 5 : 3))

                    HStack {
                        Label(story.verification.rawValue, systemImage: "checkmark.seal")
                        Spacer()
                        Text("内容を読む  ↗")
                            .foregroundStyle(SignalTheme.ink)
                            .overlay(alignment: .bottom) {
                                Rectangle().frame(height: 1).offset(y: 4)
                            }
                    }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(SignalTheme.inkSoft)
                    .padding(.top, 26)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.vertical, story.rank == 1 ? 28 : 24)
            }
            .frame(maxWidth: .infinity, minHeight: story.rank == 1 ? 430 : 300, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(SignalTheme.ink)
        .overlay(alignment: .bottom) { Divider().overlay(SignalTheme.line) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("ダブルタップしてニュースの詳細を表示")
        .accessibilityAddTraits(.isButton)
    }

    private var accent: Color {
        switch story.rank {
        case 1: SignalTheme.coral
        case 2: SignalTheme.blue
        default: SignalTheme.lime
        }
    }

    private var titleFont: Font {
        story.rank == 1
            ? .system(.largeTitle, design: .serif)
            : .system(.title2, design: .serif)
    }

    private var sourceInitials: String {
        story.source
            .split(whereSeparator: { $0 == " " || $0 == "・" })
            .compactMap(\.first)
            .prefix(2)
            .map(String.init)
            .joined()
            .uppercased()
    }

    private var accessibilityLabel: String {
        "第\(story.rank)位、重要度\(story.impactLabel.rawValue)、\(story.category.rawValue)。\(story.title)。\(story.source)、\(SignalFormat.shortDate(story.publishedAt))。\(story.verification.rawValue)で確認。"
    }
}

struct RankBadge: View {
    let rank: Int
    @ScaledMetric(relativeTo: .caption) private var badgeSize = 44

    var body: some View {
        Text(String(format: "%02d", rank))
            .font(.system(.caption, design: .monospaced).weight(.bold))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .frame(width: min(badgeSize, 64), height: min(badgeSize, 64))
            .overlay(Circle().stroke(SignalTheme.ink, lineWidth: 1.1))
            .accessibilityLabel("第\(rank)位")
    }
}
