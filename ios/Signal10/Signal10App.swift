import SwiftUI

@main
struct Signal10App: App {
    @StateObject private var store = DigestStore()

    var body: some Scene {
        WindowGroup {
            FeedView()
                .environmentObject(store)
                .preferredColorScheme(.light)
        }
    }
}
