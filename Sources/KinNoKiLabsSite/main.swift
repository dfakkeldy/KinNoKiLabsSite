import Foundation
import Publish
import Plot

// This type acts as the configuration for your website.
struct KinNoKiLabsSite: Website {
    enum SectionID: String, WebsiteSectionID {
        // Add the sections that you want your website to contain here:
        case posts
        case apps
    }

    struct ItemMetadata: WebsiteItemMetadata {
        // App-page fields (posts omit all of these).
        var accent: String?     // hex color, e.g. "#d4af37"
        var tagline: String?
        var platforms: String?  // comma-separated, e.g. "iPhone, Apple Watch, Mac"
        var featured: Bool?     // homepage flagship slot
        var iconAlt: String?    // only when the generic "<title> app icon" alt isn't enough
        var status: String?     // rendered as a .status-chip on the app's item page (e.g. "TestFlight beta — open")
    }

    // Update these properties to configure your website:
    var url = URL(string: "https://kinnokilabs.com")!
    var name = "KinNoKi Labs"
    var description = "We build focused Apple-platform apps and practical software systems for messy real-world work."
    var language: Language { .english }
    var imagePath: Path? { nil }
}

private enum GenerationConfigurationError: LocalizedError {
    case missingRSSDate

    var errorDescription: String? {
        switch self {
        case .missingRSSDate:
            return "Use 'make generate' or 'make preview' so generated dates come from Git history."
        }
    }
}

private func deterministicRSSDate() throws -> Date {
    let value = ProcessInfo.processInfo.environment["KINNOKI_RSS_DATE_EPOCH"]
    guard let value,
          let interval = TimeInterval(value),
          interval.isFinite,
          interval > 0 else {
        throw GenerationConfigurationError.missingRSSDate
    }
    return Date(timeIntervalSince1970: interval)
}

let site = KinNoKiLabsSite()
try site.publish(using: [
    .optional(.copyResources()),
    .addMarkdownFiles(),
    .sortItems(by: \.date, order: .descending),
    .generateHTML(withTheme: .kinNoKi),
    .generateRSSFeed(
        including: Set(KinNoKiLabsSite.SectionID.allCases),
        date: try deterministicRSSDate()
    ),
    .generateSiteMap()
])
