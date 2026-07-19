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
    case missingDate(environmentKey: String)

    var errorDescription: String? {
        switch self {
        case .missingDate(let environmentKey):
            return "Missing or invalid \(environmentKey). Use 'make generate' or 'make preview' so generated dates come from Git history."
        }
    }
}

private func deterministicDate(environmentKey: String) throws -> Date {
    let value = ProcessInfo.processInfo.environment[environmentKey]
    guard let value,
          let interval = TimeInterval(value),
          interval.isFinite,
          interval > 0 else {
        throw GenerationConfigurationError.missingDate(environmentKey: environmentKey)
    }
    return Date(timeIntervalSince1970: interval)
}

private func applyDeterministicSectionDates(
    _ dates: [KinNoKiLabsSite.SectionID: Date]
) -> PublishingStep<KinNoKiLabsSite> {
    .step(named: "Apply deterministic section dates") { context in
        try context.mutateAllSections { section in
            guard let date = dates[section.id] else {
                throw GenerationConfigurationError.missingDate(
                    environmentKey: "the \(section.id.rawValue) section date"
                )
            }
            section.lastModified = date
        }
    }
}

let site = KinNoKiLabsSite()
let rssDate = try deterministicDate(environmentKey: "KINNOKI_RSS_DATE_EPOCH")
let sectionDates = try Dictionary(uniqueKeysWithValues: KinNoKiLabsSite.SectionID.allCases.map { id in
    let environmentKey = "KINNOKI_\(id.rawValue.uppercased())_SECTION_DATE_EPOCH"
    return (id, try deterministicDate(environmentKey: environmentKey))
})
try site.publish(using: [
    .optional(.copyResources()),
    .addMarkdownFiles(),
    applyDeterministicSectionDates(sectionDates),
    .sortItems(by: \.date, order: .descending),
    .generateHTML(withTheme: .kinNoKi),
    .generateRSSFeed(
        including: Set(KinNoKiLabsSite.SectionID.allCases),
        date: rssDate
    ),
    .generateSiteMap()
])
