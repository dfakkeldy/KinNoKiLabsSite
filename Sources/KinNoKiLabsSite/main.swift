import Foundation
import Publish
import Plot

// This type acts as the configuration for your website.
struct KinNoKiLabsSite: Website {
    enum SectionID: String, WebsiteSectionID {
        // Add the sections that you want your website to contain here:
        case posts
        case apps
        case tenders
    }

    struct ItemMetadata: WebsiteItemMetadata {
        // App-page fields (posts omit all of these).
        var accent: String?     // hex color, e.g. "#d4af37"
        var tagline: String?
        var platforms: String?  // comma-separated, e.g. "iPhone, Apple Watch, Mac"
        var featured: Bool?     // homepage flagship slot
        var iconAlt: String?    // only when the generic "<title> app icon" alt isn't enough
        var status: String?     // rendered as a .status-chip on the app's item page (e.g. "TestFlight beta — open")
        // Tender showcase fields (apps and posts omit all of these).
        var tenderID: String?
        var issuer: String?
        var procurementSystem: String?
        var category: String?
        var deliveryRegion: String?
        var publishedAt: String?       // ISO 8601 with offset
        var closingAt: String?         // ISO 8601 with offset
        var firstAddedAt: String?      // ISO 8601 with offset
        var checkedAt: String?         // ISO 8601 with offset
        var documentAccess: String?
        var addendaURL: String?
        var addendaStatus: String?
        var lifecycle: String?         // TenderLifecycle raw value
        var noticeURL: String?
        var documentsURL: String?
        var featuredPack: Bool?
    }

    // Update these properties to configure your website:
    var url = URL(string: "https://kinnokilabs.com")!
    var name = "KinNoKi Labs"
    var description = "KinNoKi Labs solves messy technical and operational problems with practical systems, automation, and custom software."
    var language: Language { .english }
    var imagePath: Path? { nil }

    /// Item pages that stay reachable for old links but are kept out of the
    /// sitemap and RSS feed and marked `noindex`. Routey was discontinued on
    /// 2026-10-07; the July 5 post still links its page.
    static let unlistedItemPaths: Set<Path> = ["apps/routey"]

    /// Hand-authored static apps under Resources/ that Publish's sitemap
    /// generator cannot see. Each path must have an `index.html` in Output/.
    static let staticSitemapPaths: [Path] = [
        "listen/",
        "apps/nsmarksthespot/map/",
    ]
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

/// Appends `<url>` entries for static Resources routes to the generated
/// sitemap. They carry no `<lastmod>`, which keeps generation deterministic.
private func appendStaticSitemapEntries(_ paths: [Path]) -> PublishingStep<KinNoKiLabsSite> {
    .step(named: "Append static routes to site map") { context in
        let file = try context.outputFile(at: "sitemap.xml")
        let xml = try file.readAsString()
        let entries = try paths.map { path -> String in
            _ = try context.outputFile(at: Path(path.string + "index.html"))
            return "<url><loc>\(context.site.url(for: path).absoluteString)</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>"
        }.joined()
        guard let close = xml.range(of: "</urlset>", options: .backwards) else {
            throw PublishingError(stepName: "Append static routes to site map", infoMessage: "sitemap.xml has no closing </urlset>")
        }
        try file.write(xml.replacingCharacters(in: close, with: entries + "</urlset>"))
    }
}

private func generateNotFoundPage() -> PublishingStep<KinNoKiLabsSite> {
    .step(named: "Generate 404 page") { context in
        let html = makeNotFoundHTML(context: context)
        try context.createOutputFile(at: "404.html").write(html.render())
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
        including: Set([KinNoKiLabsSite.SectionID.apps, .posts]),
        itemPredicate: Predicate { !KinNoKiLabsSite.unlistedItemPaths.contains($0.path) },
        date: rssDate
    ),
    .generateSiteMap(excluding: KinNoKiLabsSite.unlistedItemPaths),
    appendStaticSitemapEntries(KinNoKiLabsSite.staticSitemapPaths),
    generateNotFoundPage()
])
