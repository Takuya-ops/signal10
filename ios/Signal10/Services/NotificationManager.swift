import Combine
import Foundation
import UserNotifications

struct DailyNotificationSchedule: Equatable, Sendable {
    static let identifier = "signal10.morning-edition"
    static let hour = 6
    static let minute = 35

    static var dateComponents: DateComponents {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = SignalFormat.tokyo
        components.hour = hour
        components.minute = minute
        return components
    }
}

@MainActor
final class NotificationManager: ObservableObject {
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var isScheduled = false
    @Published private(set) var errorMessage: String?

    private let center = UNUserNotificationCenter.current()

    func refresh() async {
        let settings = await center.notificationSettings()
        authorizationStatus = settings.authorizationStatus
        let pending = await center.pendingNotificationRequests()
        isScheduled = pending.contains { $0.identifier == DailyNotificationSchedule.identifier }
    }

    func enable() async {
        do {
            let granted: Bool
            if authorizationStatus == .notDetermined {
                granted = try await center.requestAuthorization(options: [.alert, .sound])
            } else {
                granted = authorizationStatus == .authorized || authorizationStatus == .provisional
            }
            guard granted else {
                await refresh()
                return
            }

            center.removePendingNotificationRequests(withIdentifiers: [DailyNotificationSchedule.identifier])
            let content = UNMutableNotificationContent()
            content.title = "SIGNAL 10"
            content.body = "今日の生成AIニュース Top 10を確認しましょう。"
            content.sound = .default
            content.threadIdentifier = "signal10.morning"
            let trigger = UNCalendarNotificationTrigger(
                dateMatching: DailyNotificationSchedule.dateComponents,
                repeats: true
            )
            try await center.add(UNNotificationRequest(
                identifier: DailyNotificationSchedule.identifier,
                content: content,
                trigger: trigger
            ))
            errorMessage = nil
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
            await refresh()
        }
    }

    func disable() async {
        center.removePendingNotificationRequests(withIdentifiers: [DailyNotificationSchedule.identifier])
        errorMessage = nil
        await refresh()
    }
}
