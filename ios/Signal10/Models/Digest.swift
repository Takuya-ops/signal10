import Foundation

enum DigestStatus: String, Codable, Sendable {
    case live
    case sample
    case degraded
}

enum NewsCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case model = "モデル"
    case product = "プロダクト"
    case developer = "開発者向け"
    case business = "ビジネス"
    case policy = "政策・社会"
    case research = "研究"
    case safety = "安全性"

    var id: String { rawValue }

    var code: String {
        switch self {
        case .model: "MODEL"
        case .product: "PRODUCT"
        case .developer: "DEVELOPER"
        case .business: "BUSINESS"
        case .policy: "POLICY"
        case .research: "RESEARCH"
        case .safety: "SAFETY"
        }
    }
}

enum SourceType: String, Codable, Sendable {
    case official
    case media
    case research
}

enum ImpactLabel: String, Codable, Sendable {
    case extraLarge = "特大"
    case large = "大"
    case medium = "中"
}

enum VerificationLevel: String, Codable, Sendable {
    case official = "公式発表"
    case multipleSources = "複数ソース"
    case trustedReport = "信頼できる報道"
}

struct RelatedSource: Codable, Hashable, Identifiable, Sendable {
    var name: String
    var url: URL

    var id: String { url.absoluteString }
}

struct Story: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var rank: Int
    var title: String
    var originalTitle: String
    var summary: String
    var points: [String]
    var whyItMatters: String
    var source: String
    var sourceType: SourceType
    var category: NewsCategory
    var publishedAt: String
    var url: URL
    var impactScore: Int
    var impactLabel: ImpactLabel
    var verification: VerificationLevel
    var relatedSources: [RelatedSource]
    var eventUrls: [URL]?
    var eventTitles: [String]?
}

struct Digest: Codable, Hashable, Sendable {
    var edition: String
    var generatedAt: String
    var periodStart: String
    var status: DigestStatus
    var checkedSources: Int
    var successfulSources: Int
    var freshSources: Int?
    var coreSources: Int?
    var coreSuccessfulSources: Int?
    var coreFreshSources: Int?
    var candidateCount: Int
    var editorialNote: String
    var repositoryUrl: URL?
    var stories: [Story]

    var orderedStories: [Story] {
        stories.sorted { $0.rank < $1.rank }
    }

    func isNewer(than other: Digest) -> Bool {
        let thisEdition = SignalFormat.date(from: edition) ?? .distantPast
        let otherEdition = SignalFormat.date(from: other.edition) ?? .distantPast
        if thisEdition != otherEdition {
            return thisEdition > otherEdition
        }
        let thisGenerated = SignalFormat.date(from: generatedAt) ?? .distantPast
        let otherGenerated = SignalFormat.date(from: other.generatedAt) ?? .distantPast
        return thisGenerated > otherGenerated
    }

    func hasSameRevision(as other: Digest) -> Bool {
        edition == other.edition && generatedAt == other.generatedAt
    }

    func validate() throws {
        guard stories.count == 10 else { throw DigestValidationError.storyCount }
        guard Set(stories.map(\.rank)) == Set(1...10) else { throw DigestValidationError.ranks }
        guard Set(stories.map(\.id)).count == stories.count else { throw DigestValidationError.duplicateID }
        guard Set(stories.map { $0.url.absoluteString }).count == stories.count else {
            throw DigestValidationError.duplicateURL
        }
        guard SignalFormat.date(from: edition) != nil,
              SignalFormat.date(from: generatedAt) != nil,
              SignalFormat.date(from: periodStart) != nil else {
            throw DigestValidationError.date
        }
        guard (1...500).contains(checkedSources),
              (0...checkedSources).contains(successfulSources),
              (10...100_000).contains(candidateCount),
              !editorialNote.isEmpty,
              editorialNote.count <= 600 else {
            throw DigestValidationError.bounds
        }
        if let freshSources, !(0...successfulSources).contains(freshSources) {
            throw DigestValidationError.bounds
        }
        switch (coreSources, coreSuccessfulSources, coreFreshSources) {
        case (nil, nil, nil):
            break
        case let (.some(core), .some(successful), .some(fresh)):
            guard (1...checkedSources).contains(core),
                  (0...core).contains(successful),
                  (0...successful).contains(fresh) else {
                throw DigestValidationError.bounds
            }
        default:
            throw DigestValidationError.bounds
        }
        if let repositoryUrl,
           (!repositoryUrl.isSignalSafeHTTPS || repositoryUrl.absoluteString.count > 2_048) {
            throw DigestValidationError.url
        }

        for story in stories {
            guard !story.id.isEmpty, story.id.count <= 160,
                  !story.title.isEmpty, story.title.count <= 180,
                  !story.originalTitle.isEmpty, story.originalTitle.count <= 500,
                  !story.summary.isEmpty, story.summary.count <= 1_200,
                  !story.whyItMatters.isEmpty, story.whyItMatters.count <= 1_000,
                  !story.source.isEmpty, story.source.count <= 160,
                  story.points.count == 3,
                  story.points.allSatisfy({ !$0.isEmpty && $0.count <= 500 }),
                  (0...100).contains(story.impactScore),
                  SignalFormat.date(from: story.publishedAt) != nil else {
                throw DigestValidationError.bounds
            }
            guard story.url.isSignalSafeHTTPS, story.url.absoluteString.count <= 2_048,
                  story.relatedSources.count <= 5,
                  story.relatedSources.allSatisfy({
                      !$0.name.isEmpty && $0.name.count <= 160 &&
                          $0.url.isSignalSafeHTTPS && $0.url.absoluteString.count <= 2_048
                  }),
                  (story.eventUrls ?? []).count <= 50,
                  (story.eventUrls ?? []).allSatisfy({
                      $0.isSignalSafeHTTPS && $0.absoluteString.count <= 2_048
                  }),
                  (story.eventTitles ?? []).count <= 30,
                  (story.eventTitles ?? []).allSatisfy({ $0.count <= 500 }) else {
                throw DigestValidationError.url
            }
        }
    }
}

enum DigestValidationError: LocalizedError, Equatable {
    case payloadTooLarge
    case storyCount
    case ranks
    case duplicateID
    case duplicateURL
    case date
    case bounds
    case url

    var errorDescription: String? {
        switch self {
        case .payloadTooLarge: "ニュースデータが大きすぎます。"
        case .storyCount: "ニュースが10件そろっていません。"
        case .ranks: "ランキングが正しくありません。"
        case .duplicateID: "同じニュースIDが含まれています。"
        case .duplicateURL: "同じニュースURLが含まれています。"
        case .date: "更新日時を確認できません。"
        case .bounds: "ニュースデータの形式が正しくありません。"
        case .url: "安全でないリンクが含まれています。"
        }
    }
}

enum DigestCodec {
    static let maximumPayloadBytes = 1_000_000

    static func decode(_ data: Data) throws -> Digest {
        guard data.count <= maximumPayloadBytes else {
            throw DigestValidationError.payloadTooLarge
        }
        let digest = try JSONDecoder().decode(Digest.self, from: data)
        try digest.validate()
        return digest
    }
}

private extension URL {
    var isSignalSafeHTTPS: Bool {
        guard scheme?.lowercased() == "https",
              user == nil,
              password == nil,
              port == nil || port == 443,
              let host = host?.lowercased(),
              !host.isEmpty,
              host != "localhost",
              !host.hasSuffix(".local") else {
            return false
        }

        if host == "::1" || host == "0:0:0:0:0:0:0:1" || host.hasPrefix("fc") ||
            host.hasPrefix("fd") || host.hasPrefix("fe8") || host.hasPrefix("fe9") ||
            host.hasPrefix("fea") || host.hasPrefix("feb") {
            return false
        }

        let octets = host.split(separator: ".").compactMap { Int($0) }
        if octets.count == 4, octets.allSatisfy({ (0...255).contains($0) }) {
            let first = octets[0]
            let second = octets[1]
            if first == 0 || first == 10 || first == 127 || first >= 224 ||
                (first == 169 && second == 254) ||
                (first == 172 && (16...31).contains(second)) ||
                (first == 192 && second == 168) {
                return false
            }
        }
        return true
    }
}
