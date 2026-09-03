import XCTest
@testable import Signal10

final class DigestValidationTests: XCTestCase {
    func testCheckedInEditionDecodesAndContainsStrictTopTen() throws {
        let digest = try DigestCodec.decode(fixtureData())

        XCTAssertEqual(digest.stories.count, 10)
        XCTAssertEqual(digest.orderedStories.map(\.rank), Array(1...10))
        XCTAssertTrue(digest.stories.allSatisfy { $0.points.count == 3 })
        XCTAssertFalse(try XCTUnwrap(digest.orderedStories.first?.title).isEmpty)
    }

    func testDuplicateRankIsRejected() throws {
        var digest = try DigestCodec.decode(fixtureData())
        digest.stories[1].rank = digest.stories[0].rank

        XCTAssertThrowsError(try digest.validate()) { error in
            XCTAssertEqual(error as? DigestValidationError, .ranks)
        }
    }

    func testInsecureURLIsRejected() throws {
        var digest = try DigestCodec.decode(fixtureData())
        digest.stories[0].url = try XCTUnwrap(URL(string: "http://example.com/story"))

        XCTAssertThrowsError(try digest.validate()) { error in
            XCTAssertEqual(error as? DigestValidationError, .url)
        }
    }

    func testWebContractEventEvidenceLimitsAreAccepted() throws {
        var digest = try DigestCodec.decode(fixtureData())
        digest.stories[0].eventUrls = try (0..<50).map { index in
            try XCTUnwrap(URL(string: "https://example.com/evidence/\(index)"))
        }
        digest.stories[0].eventTitles = (0..<30).map { "関連見出し \($0)" }

        XCTAssertNoThrow(try digest.validate())

        digest.stories[0].eventUrls?.append(
            try XCTUnwrap(URL(string: "https://example.com/evidence/overflow"))
        )
        XCTAssertThrowsError(try digest.validate()) { error in
            XCTAssertEqual(error as? DigestValidationError, .url)
        }
    }

    func testSourceHealthFieldsFollowTheWebContract() throws {
        let original = try DigestCodec.decode(fixtureData())

        var incompleteCoreHealth = original
        incompleteCoreHealth.coreFreshSources = nil
        XCTAssertThrowsError(try incompleteCoreHealth.validate()) { error in
            XCTAssertEqual(error as? DigestValidationError, .bounds)
        }

        var impossibleFreshCount = original
        impossibleFreshCount.freshSources = original.successfulSources + 1
        XCTAssertThrowsError(try impossibleFreshCount.validate()) { error in
            XCTAssertEqual(error as? DigestValidationError, .bounds)
        }
    }

    func testOversizedPayloadIsRejectedBeforeDecode() {
        let oversized = Data(repeating: 0x20, count: DigestCodec.maximumPayloadBytes + 1)

        XCTAssertThrowsError(try DigestCodec.decode(oversized)) { error in
            XCTAssertEqual(error as? DigestValidationError, .payloadTooLarge)
        }
    }

    func testRepositoryPersistsOnlyValidatedRemoteEdition() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let cacheURL = directory.appendingPathComponent("latest.json")
        defer { try? FileManager.default.removeItem(at: directory) }
        let data = try fixtureData()
        let remoteURL = DigestRepository.productionURL
        let online = DigestRepository(cacheURL: cacheURL, bundledURL: nil) { _ in
            NetworkResponse(data: data, statusCode: 200, finalURL: remoteURL)
        }

        let downloaded = try await online.fetchRemote()
        XCTAssertEqual(downloaded.origin, .live)
        XCTAssertTrue(FileManager.default.fileExists(atPath: cacheURL.path))

        let offline = DigestRepository(cacheURL: cacheURL, bundledURL: nil) { _ in
            throw URLError(.notConnectedToInternet)
        }
        let cached = try await offline.loadLocal()
        XCTAssertEqual(cached.origin, .cached)
        XCTAssertEqual(cached.digest.generatedAt, downloaded.digest.generatedAt)
    }

    func testOlderEditionCannotReplaceNewerEdition() throws {
        let current = try DigestCodec.decode(fixtureData())
        var older = current
        older.generatedAt = "2026-09-03T09:00:00+09:00"

        XCTAssertFalse(older.isNewer(than: current))
        XCTAssertTrue(current.isNewer(than: older))
    }

    func testOlderRemoteCannotOverwriteNewerCache() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let cacheURL = directory.appendingPathComponent("latest.json")
        defer { try? FileManager.default.removeItem(at: directory) }

        let currentData = try fixtureData()
        let current = try DigestCodec.decode(currentData)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try currentData.write(to: cacheURL, options: .atomic)

        var older = current
        older.generatedAt = "2026-09-03T09:00:00+09:00"
        let olderData = try JSONEncoder().encode(older)
        let repository = DigestRepository(cacheURL: cacheURL, bundledURL: nil) { _ in
            NetworkResponse(data: olderData, statusCode: 200, finalURL: DigestRepository.productionURL)
        }

        let fetched = try await repository.fetchRemote()
        let persisted = try DigestCodec.decode(Data(contentsOf: cacheURL))
        XCTAssertEqual(fetched.origin, .cached)
        XCTAssertEqual(fetched.digest.generatedAt, current.generatedAt)
        XCTAssertEqual(persisted.generatedAt, current.generatedAt)
    }

    func testNewerBundledEditionWinsOverStaleCache() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let cacheURL = directory.appendingPathComponent("cache.json")
        let bundledURL = directory.appendingPathComponent("bundled.json")
        defer { try? FileManager.default.removeItem(at: directory) }

        let currentData = try fixtureData()
        var stale = try DigestCodec.decode(currentData)
        stale.generatedAt = "2026-09-03T09:00:00+09:00"
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try JSONEncoder().encode(stale).write(to: cacheURL, options: .atomic)
        try currentData.write(to: bundledURL, options: .atomic)

        let repository = DigestRepository(cacheURL: cacheURL, bundledURL: bundledURL) { _ in
            throw URLError(.notConnectedToInternet)
        }
        let local = try await repository.loadLocal()

        XCTAssertEqual(local.origin, .bundled)
        XCTAssertEqual(local.digest.generatedAt, try DigestCodec.decode(currentData).generatedAt)
    }

    func testDailyNotificationRunsAfterMorningEdition() {
        let schedule = DailyNotificationSchedule.dateComponents

        XCTAssertEqual(schedule.timeZone, TimeZone(identifier: "Asia/Tokyo"))
        XCTAssertEqual(schedule.hour, 6)
        XCTAssertEqual(schedule.minute, 35)
        XCTAssertEqual(DailyNotificationSchedule.identifier, "signal10.morning-edition")
    }

    private func fixtureData() throws -> Data {
        let repositoryRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        return try Data(contentsOf: repositoryRoot.appendingPathComponent("public/data/latest.json"))
    }
}
