import Combine
import Foundation

enum DigestOrigin: String, Sendable {
    case live
    case cached
    case bundled

    var label: String {
        switch self {
        case .live: "最新版"
        case .cached: "保存版"
        case .bundled: "同梱版"
        }
    }
}

struct DigestSnapshot: Sendable {
    let digest: Digest
    let origin: DigestOrigin
}

struct NetworkResponse: Sendable {
    let data: Data
    let statusCode: Int
    let finalURL: URL?
}

typealias DigestDataLoader = @Sendable (URLRequest) async throws -> NetworkResponse

enum DigestRepositoryError: LocalizedError {
    case noLocalEdition
    case nonHTTPResponse
    case status(Int)
    case unexpectedHost

    var errorDescription: String? {
        switch self {
        case .noLocalEdition: "保存済みの朝刊がありません。"
        case .nonHTTPResponse: "ニュース配信元から不正な応答がありました。"
        case let .status(code): "ニュース配信元からエラー（\(code)）が返されました。"
        case .unexpectedHost: "想定外の配信元へ転送されたため更新を停止しました。"
        }
    }
}

actor DigestRepository {
    static let productionURL = URL(
        string: "https://raw.githubusercontent.com/Takuya-ops/signal10/main/public/data/latest.json"
    )!

    private let endpoint: URL
    private let cacheURL: URL
    private let bundledURL: URL?
    private let loader: DigestDataLoader

    init(
        endpoint: URL = DigestRepository.productionURL,
        cacheURL: URL? = nil,
        bundledURL: URL? = Bundle.main.url(forResource: "latest", withExtension: "json"),
        loader: DigestDataLoader? = nil
    ) {
        self.endpoint = endpoint
        let defaultCacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("SIGNAL10", isDirectory: true)
        self.cacheURL = cacheURL ?? defaultCacheDirectory.appendingPathComponent("latest.json")
        self.bundledURL = bundledURL
        self.loader = loader ?? { request in
            let configuration = URLSessionConfiguration.ephemeral
            configuration.httpCookieStorage = nil
            configuration.httpShouldSetCookies = false
            configuration.timeoutIntervalForRequest = 15
            configuration.timeoutIntervalForResource = 20
            let session = URLSession(configuration: configuration)
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw DigestRepositoryError.nonHTTPResponse
            }
            return NetworkResponse(data: data, statusCode: http.statusCode, finalURL: http.url)
        }
    }

    func loadLocal() throws -> DigestSnapshot {
        var candidates: [DigestSnapshot] = []

        if FileManager.default.fileExists(atPath: cacheURL.path) {
            if let digest = try? DigestCodec.decode(Data(contentsOf: cacheURL)) {
                candidates.append(DigestSnapshot(digest: digest, origin: .cached))
            }
        }
        if let bundledURL {
            if let digest = try? DigestCodec.decode(Data(contentsOf: bundledURL)) {
                candidates.append(DigestSnapshot(digest: digest, origin: .bundled))
            }
        }

        guard var newest = candidates.first else {
            throw DigestRepositoryError.noLocalEdition
        }
        for candidate in candidates.dropFirst() where candidate.digest.isNewer(than: newest.digest) {
            newest = candidate
        }
        return newest
    }

    func fetchRemote() async throws -> DigestSnapshot {
        var request = URLRequest(
            url: endpoint,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
            timeoutInterval: 15
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("SIGNAL10-iOS/1.0", forHTTPHeaderField: "User-Agent")
        let response = try await loader(request)

        if response.statusCode == 304 {
            return try loadLocal()
        }
        guard response.statusCode == 200 else {
            throw DigestRepositoryError.status(response.statusCode)
        }
        guard response.finalURL?.scheme?.lowercased() == "https",
              response.finalURL?.host?.lowercased() == "raw.githubusercontent.com" else {
            throw DigestRepositoryError.unexpectedHost
        }

        let digest = try DigestCodec.decode(response.data)
        if let local = try? loadLocal(),
           !digest.isNewer(than: local.digest),
           !digest.hasSameRevision(as: local.digest) {
            return local
        }
        try FileManager.default.createDirectory(
            at: cacheURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try response.data.write(to: cacheURL, options: .atomic)
        return DigestSnapshot(digest: digest, origin: .live)
    }
}

@MainActor
final class DigestStore: ObservableObject {
    @Published private(set) var digest: Digest?
    @Published private(set) var origin: DigestOrigin = .bundled
    @Published private(set) var isRefreshing = false
    @Published private(set) var errorMessage: String?

    private let repository: DigestRepository
    private var hasLoaded = false

    init(repository: DigestRepository = DigestRepository()) {
        self.repository = repository
    }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        hasLoaded = true

        do {
            let local = try await repository.loadLocal()
            digest = local.digest
            origin = local.origin
        } catch {
            errorMessage = error.localizedDescription
        }
        await refresh()
    }

    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let remote = try await repository.fetchRemote()
            if let current = digest {
                if remote.digest.isNewer(than: current) || remote.digest.hasSameRevision(as: current) {
                    digest = remote.digest
                    origin = remote.origin
                }
            } else {
                digest = remote.digest
                origin = remote.origin
            }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearError() {
        errorMessage = nil
    }
}
