import Foundation
import Publish
import Plot

// MARK: - Tender Starter Showcase
//
// Converts optional Publish ItemMetadata into a validated tender record and
// renders the hub and detail pages with Plot. Source facts (frontmatter) and
// editorial analysis (Markdown body) are kept strictly separate in the
// renderer. No source value is ever interpolated through Node.raw.

/// The exact disclaimer shown on every card and detail page.
let tenderDisclaimer =
    "Planning aid only. Verify all requirements, deadlines, documents, and addenda at the linked official procurement source before acting or bidding."

/// Lifecycle states a tender record can carry. Raw values are stable identifiers
/// stored in frontmatter; labels are human-visible text rendered alongside colour.
enum TenderLifecycle: String {
    case current
    case closingSoon = "closing-soon"
    case closedDemo = "closed-demo"
    case withdrawn
    case superseded
    case sourceUnavailable = "source-unavailable"
    case addendaUnchecked = "addenda-unchecked"

    var label: String {
        switch self {
        case .current: return "Current"
        case .closingSoon: return "Closing soon"
        case .closedDemo: return "Closed — retained as a demonstration"
        case .withdrawn: return "Withdrawn"
        case .superseded: return "Superseded"
        case .sourceUnavailable: return "Source unavailable"
        case .addendaUnchecked: return "Addenda not recently checked"
        }
    }

    /// Whether this record belongs in the "Current examples" grid.
    var belongsInCurrentSelection: Bool {
        switch self {
        case .current, .closingSoon, .addendaUnchecked: return true
        case .closedDemo, .withdrawn, .superseded, .sourceUnavailable: return false
        }
    }
}

/// A validated tender record. Built from a Publish Item and its metadata.
/// The throwing initializer rejects missing fields, non-HTTPS URLs, unparsable
/// timestamps, or a closing date earlier than the first-added date.
struct TenderRecord {
    let item: Item<KinNoKiLabsSite>
    let tenderID: String
    let issuer: String
    let procurementSystem: String
    let category: String
    let deliveryRegion: String
    let publishedAt: Date
    let closingAt: Date
    let firstAddedAt: Date
    let checkedAt: Date
    let documentAccess: String
    let addendaURL: URL
    let addendaStatus: String
    let lifecycle: TenderLifecycle
    let noticeURL: URL
    let documentsURL: URL
    let featuredPack: Bool

    enum ValidationError: LocalizedError {
        case missingField(String)
        case invalidURL(String)
        case nonHTTPSURL(String, String)
        case invalidDate(String, String)
        case invalidLifecycle(String)
        case closingBeforeFirstAdded

        var errorDescription: String? {
            switch self {
            case .missingField(let key):
                return "Tender record is missing required field: \(key)"
            case .invalidURL(let key):
                return "Tender record has an invalid URL for: \(key)"
            case .nonHTTPSURL(let key, let value):
                return "Tender record URL for \(key) must be HTTPS: \(value)"
            case .invalidDate(let key, let value):
                return "Tender record has an unparseable date for \(key): \(value)"
            case .invalidLifecycle(let value):
                return "Tender record has an unknown lifecycle value: \(value)"
            case .closingBeforeFirstAdded:
                return "Tender closingAt must not be earlier than firstAddedAt"
            }
        }
    }

    init(item: Item<KinNoKiLabsSite>) throws {
        self.item = item
        let m = item.metadata

        guard let tenderID = m.tenderID, !tenderID.isEmpty else { throw ValidationError.missingField("tenderID") }
        guard let issuer = m.issuer, !issuer.isEmpty else { throw ValidationError.missingField("issuer") }
        guard let procurementSystem = m.procurementSystem, !procurementSystem.isEmpty else { throw ValidationError.missingField("procurementSystem") }
        guard let category = m.category, !category.isEmpty else { throw ValidationError.missingField("category") }
        guard let deliveryRegion = m.deliveryRegion, !deliveryRegion.isEmpty else { throw ValidationError.missingField("deliveryRegion") }
        guard let documentAccess = m.documentAccess, !documentAccess.isEmpty else { throw ValidationError.missingField("documentAccess") }
        guard let addendaStatus = m.addendaStatus, !addendaStatus.isEmpty else { throw ValidationError.missingField("addendaStatus") }
        guard let lifecycleRaw = m.lifecycle, !lifecycleRaw.isEmpty else { throw ValidationError.missingField("lifecycle") }
        guard let lifecycle = TenderLifecycle(rawValue: lifecycleRaw) else { throw ValidationError.invalidLifecycle(lifecycleRaw) }

        guard let publishedAtStr = m.publishedAt, !publishedAtStr.isEmpty else { throw ValidationError.missingField("publishedAt") }
        guard let closingAtStr = m.closingAt, !closingAtStr.isEmpty else { throw ValidationError.missingField("closingAt") }
        guard let firstAddedAtStr = m.firstAddedAt, !firstAddedAtStr.isEmpty else { throw ValidationError.missingField("firstAddedAt") }
        guard let checkedAtStr = m.checkedAt, !checkedAtStr.isEmpty else { throw ValidationError.missingField("checkedAt") }

        let iso8601 = ISO8601DateFormatter()
        iso8601.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime, .withTimeZone]
        iso8601.timeZone = TimeZone(identifier: "America/Halifax")

        func parseDate(_ str: String, key: String) throws -> Date {
            // ISO8601DateFormatter is strict; try with internet date-time first,
            // then a local fallback for offset-only or date-only values.
            if let d = iso8601.date(from: str) { return d }
            // Try a flexible parse for partial offsets.
            let fallback = ISO8601DateFormatter()
            fallback.formatOptions = [.withInternetDateTime]
            if let d = fallback.date(from: str) { return d }
            throw ValidationError.invalidDate(key, str)
        }

        let publishedAt = try parseDate(publishedAtStr, key: "publishedAt")
        let closingAt = try parseDate(closingAtStr, key: "closingAt")
        let firstAddedAt = try parseDate(firstAddedAtStr, key: "firstAddedAt")
        let checkedAt = try parseDate(checkedAtStr, key: "checkedAt")

        guard closingAt >= firstAddedAt else { throw ValidationError.closingBeforeFirstAdded }

        func validatedURL(_ str: String?, key: String) throws -> URL {
            guard let str, !str.isEmpty else { throw ValidationError.missingField(key) }
            guard let url = URL(string: str) else { throw ValidationError.invalidURL(key) }
            guard url.scheme == "https" else { throw ValidationError.nonHTTPSURL(key, str) }
            return url
        }

        let noticeURL = try validatedURL(m.noticeURL, key: "noticeURL")
        let documentsURL = try validatedURL(m.documentsURL, key: "documentsURL")
        let addendaURL = try validatedURL(m.addendaURL, key: "addendaURL")

        self.tenderID = tenderID
        self.issuer = issuer
        self.procurementSystem = procurementSystem
        self.category = category
        self.deliveryRegion = deliveryRegion
        self.publishedAt = publishedAt
        self.closingAt = closingAt
        self.firstAddedAt = firstAddedAt
        self.checkedAt = checkedAt
        self.documentAccess = documentAccess
        self.addendaURL = addendaURL
        self.addendaStatus = addendaStatus
        self.lifecycle = lifecycle
        self.noticeURL = noticeURL
        self.documentsURL = documentsURL
        self.featuredPack = m.featuredPack ?? false
    }
}

// MARK: - Rendering helpers

// Human-readable dates in Halifax time. The exact ISO value stays in each
// <time datetime>; the visible text drops the "00:00 -03:00" noise.
private let halifaxTimeZone = TimeZone(identifier: "America/Halifax")!

private func halifaxFormatter(_ pattern: String) -> DateFormatter {
    let f = DateFormatter()
    f.dateFormat = pattern
    f.timeZone = halifaxTimeZone
    f.locale = Locale(identifier: "en_US_POSIX")
    return f
}

private let dayFormatter = halifaxFormatter("MMMM d, yyyy")
private let dayTimeFormatter = halifaxFormatter("MMMM d, yyyy, h:mm a")

private func iso8601String(_ date: Date) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    f.timeZone = TimeZone(identifier: "America/Halifax")
    return f.string(from: date)
}

/// "July 24, 2026".
private func formattedDate(_ date: Date) -> String {
    dayFormatter.string(from: date)
}

/// "August 13, 2026, 2:00 PM Atlantic time", or just the day when the
/// source gives midnight (a publication date rather than a deadline).
private func formattedDateTime(_ date: Date) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = halifaxTimeZone
    let parts = calendar.dateComponents([.hour, .minute], from: date)
    if parts.hour == 0 && parts.minute == 0 { return formattedDate(date) }
    return dayTimeFormatter.string(from: date) + " Atlantic time"
}

private func timeNode(_ date: Date, _ text: String) -> Node<HTML.BodyContext> {
    .time(.datetime(iso8601String(date)), .text(text))
}

/// The facts card ends with the shared disclaimer, so a fact row does not
/// need to repeat its own "check the source" reminder. The frontmatter keeps it.
private let trailingSourceReminders = [
    " Verify at the official source before acting.",
    " Recheck the official source before acting.",
]

private func withoutSourceReminder(_ text: String) -> String {
    for reminder in trailingSourceReminders where text.hasSuffix(reminder) {
        return String(text.dropLast(reminder.count))
    }
    return text
}

/// Frontmatter prose may carry an ISO day ("at review time on 2026-07-24").
/// The page shows every date in one long form ("July 24, 2026"), which also
/// keeps a phone from breaking the date at its hyphen. The frontmatter keeps
/// the ISO value.
private let isoDayPattern = try! NSRegularExpression(pattern: #"\b(\d{4})-(\d{2})-(\d{2})\b"#)
private let isoDayParser = halifaxFormatter("yyyy-MM-dd")

private func withLongFormDays(_ text: String) -> String {
    let source = text as NSString
    var result = ""
    var cursor = 0
    for match in isoDayPattern.matches(in: text, range: NSRange(location: 0, length: source.length)) {
        let iso = source.substring(with: match.range)
        guard let date = isoDayParser.date(from: iso) else { continue }
        result += source.substring(with: NSRange(location: cursor, length: match.range.location - cursor))
        result += formattedDate(date)
        cursor = match.range.location + match.range.length
    }
    result += source.substring(from: cursor)
    return result
}

/// A long fact row as the page shows it: no trailing reminder, long-form days.
private func displayFact(_ text: String) -> String {
    withLongFormDays(withoutSourceReminder(text))
}

private let tenderRequestHref =
    "mailto:hello@kinnokilabs.com"
    + "?subject=Free%20Custom%20Tender%20Preview%20Request"
    + "&body=Public%20tender%20URL%20or%20ID%3A%0A"
    + "Company%20or%20work%20type%3A%0A"
    + "Contact%20name%20and%20preferred%20reply%3A%0A"
    + "Why%20this%20may%20fit%3A%0A"

private func disclaimerNode() -> Node<HTML.BodyContext> {
    .p(.class("tender-disclaimer"), .text(tenderDisclaimer))
}

private func factGrid(for record: TenderRecord) -> Node<HTML.BodyContext> {
    .dl(
        .class("tender-fact-grid"),
        .div(.dt(.text("Tender ID")), .dd(.text(record.tenderID))),
        .div(.dt(.text("Issuer")), .dd(.text(record.issuer))),
        .div(.dt(.text("Procurement system")), .dd(.text(record.procurementSystem))),
        .div(.dt(.text("Category")), .dd(.text(record.category))),
        // Shown only when it adds something beyond the issuer.
        .if(record.deliveryRegion != record.issuer,
            .div(.dt(.text("Delivery region")), .dd(.text(record.deliveryRegion)))),
        .div(.dt(.text("Published")), .dd(timeNode(record.publishedAt, formattedDateTime(record.publishedAt)))),
        .div(.dt(.text("Closing")), .dd(timeNode(record.closingAt, formattedDateTime(record.closingAt)))),
        .div(.class("tender-fact-long"), .dt(.text("Document access")), .dd(.text(displayFact(record.documentAccess)))),
        .div(.class("tender-fact-long"), .dt(.text("Addenda status")), .dd(.text(displayFact(record.addendaStatus))))
    )
}

/// One link per distinct official URL. The portal notice often also hosts
/// the documents or the addenda; then a single link names what it holds,
/// so no two links on the card lead to the same page.
private func officialLinks(for record: TenderRecord) -> Node<HTML.BodyContext> {
    let notice = record.noticeURL.absoluteString
    let documents = record.documentsURL.absoluteString
    let addenda = record.addendaURL.absoluteString
    var noticeHolds: [String] = []
    if documents == notice { noticeHolds.append("documents") }
    if addenda == notice { noticeHolds.append("addenda") }
    let noticeLabel: String
    switch noticeHolds.count {
    case 0: noticeLabel = "Official notice"
    case 1: noticeLabel = "Official notice and \(noticeHolds[0])"
    default: noticeLabel = "Official notice, documents and addenda"
    }
    var links: [(href: String, label: String)] = [(notice, noticeLabel)]
    if documents != notice { links.append((documents, "Official documents")) }
    if addenda != notice && addenda != documents { links.append((addenda, "Addenda")) }
    return .ul(
        .class("tender-official-links"),
        .forEach(links) { link in
            .li(.a(.href(link.href), .text(link.label)))
        }
    )
}

// MARK: - Hub page

func tenderShowcaseMain(records: [TenderRecord]) -> Node<HTML.BodyContext> {
    let current = records.filter { $0.lifecycle.belongsInCurrentSelection }
    let archived = records.filter { !$0.lifecycle.belongsInCurrentSelection }

    return .main(
        .class("tender-main"),
        // 1. Hero
        .section(
            .class("tender-hero reveal"),
            .p(.class("eyebrow"), .text("Proof of work")),
            .h1(.text("Tender Starter Showcase")),
            .p(
                .class("tender-intro"),
                .text("Each example takes a real Nova Scotia public tender and turns it into a source-linked starting brief, with the questions to verify first.")
            )
        ),
        // 2. Current examples (hidden while none are open; the worked examples lead)
        .if(
            !current.isEmpty,
            .section(
                .class("tender-current reveal"),
                .h2(.text("Current examples")),
                .p(.class("tender-source-note"), .text("Each entry exposes its lifecycle state and the date it was last checked. Recheck the official source before acting.")),
                .div(
                    .class("tender-current-grid"),
                    .forEach(current) { card in
                        .a(
                            .class("tender-card"),
                            .href(card.item.path.absoluteString),
                            .div(
                                .class("tender-state"),
                                .span(.class("tender-state-label"), .text(card.lifecycle.label)),
                                .span(
                                    .class("tender-checked"),
                                    .text("Facts checked "),
                                    timeNode(card.checkedAt, formattedDate(card.checkedAt))
                                )
                            ),
                            .h3(.text(displayTenderTitle(card.item.title))),
                            .dl(
                                .class("tender-meta"),
                                .div(.dt(.text("Issuer")), .dd(.text(card.issuer))),
                                .div(.dt(.text("Category")), .dd(.text(card.category))),
                                .div(.dt(.text("Closes")), .dd(timeNode(card.closingAt, formattedDate(card.closingAt))))
                            ),
                            .if(card.featuredPack, .span(.class("tender-featured-tag"), .text("Featured pack example"))),
                            .span(.class("card-cue"), .text("Read the brief"), iconArrowForward())
                        )
                    }
                )
            )
        ),
        // 3. Worked examples: closed tenders kept as demonstrations
        .section(
            .class("tender-archive reveal"),
            .h2(.text("Worked examples")),
            .if(
                current.isEmpty && !archived.isEmpty,
                .p(.class("tender-source-note"), .text("These are closed worked examples, kept up to show the workflow."))
            ),
            .if(
                archived.isEmpty,
                .p(.class("tender-empty"), .text("No worked examples yet. When a current example closes or is withdrawn, it will be kept here as a demonstration.")),
                else: .div(
                    .class("tender-archive-grid"),
                    .forEach(archived) { card in
                        // No per-card state pill: the note above says every
                        // worked example is closed.
                        .a(
                            .class("tender-card tender-card-archive"),
                            .href(card.item.path.absoluteString),
                            .h3(.text(displayTenderTitle(card.item.title))),
                            .dl(
                                .class("tender-meta"),
                                .div(.dt(.text("Issuer")), .dd(.text(card.issuer))),
                                .div(.dt(.text("Category")), .dd(.text(card.category))),
                                .div(.dt(.text("Closed")), .dd(timeNode(card.closingAt, formattedDate(card.closingAt))))
                            ),
                            .span(.class("card-cue"), .text("Read the brief"), iconArrowForward())
                        )
                    }
                )
            )
        ),
        // 4. What a visitor can take away: the free preview leads (the one
        // gold action on the page), the pack follows as the self-serve option.
        .div(
            .class("tender-offers"),
            // Free-preview invitation
            .section(
                .class("tender-preview reveal"),
                .h2(.text("Free custom tender preview")),
                .p(.class("tender-offer-lead"), .text("Send a public tender URL or ID, your company or work type, contact details, and a short fit explanation. You will receive a free one-page starting brief showing the same source-linked review workflow — no account, no upload, no obligation.")),
                .p(.class("tender-source-note"), .text("I take a limited number of requests each month. For a deeper fit analysis, the paid Tender-to-Bid Diagnostic expands the starting brief into a compliance check, question map, and document checklist for one specific opportunity.")),
                .a(
                    .class("btn btn-gold tender-request"),
                    .href(tenderRequestHref),
                    .text("Request a free custom preview")
                )
            ),
            // Featured demonstration
            .section(
                .class("tender-feature reveal"),
                .h2(.text("Demonstration pack")),
                // The list names the three files, so the lead does not.
                .p(.class("tender-offer-lead"), .text("Download the original KinNoKi Tender Starter pack: three files for running the same source-linked review yourself.")),
                .ul(
                    .class("tender-pack-list"),
                    .li(.text("tender-starter-guide.pdf — tagged, accessible PDF")),
                    .li(.text("tender-review-workbook.xlsx — eight review-tracking sheets")),
                    .li(.text("official-sources.txt — plain-text index of authoritative sources"))
                ),
                .p(.class("tender-source-note"), .text("Original summaries and templates only; no official tender documents are redistributed.")),
                .a(
                    .class("btn btn-outline tender-download"),
                    .href("/tenders/tender-starter-example.zip"),
                    .attribute(named: "download"),
                    .text("Download the pack (ZIP)")
                )
            )
        ),
        disclaimerNode()
    )
}

// MARK: - Detail page

/// Source titles join parts with " - "; a no-break space before the hyphen
/// keeps a wrapped line from starting with a bare dash. Display only: the
/// frontmatter title and the page <title> keep the source text.
func displayTenderTitle(_ title: String) -> String {
    title.replacingOccurrences(of: " - ", with: "\u{00A0}- ")
}

/// Procurement titles can run past 100 characters; those get a smaller H1.
private let longTenderTitleLength = 70

func tenderDetailMain(record: TenderRecord) -> Node<HTML.BodyContext> {
    .main(
        .class(record.item.title.count > longTenderTitleLength ? "tender-detail tender-detail-long-title" : "tender-detail"),
        // The parent is named one way, top and bottom: "All worked examples".
        .a(.class("back-link"), .href("/tenders/"), iconArrowBack(), .text("All worked examples")),
        .p(.class("eyebrow"), .text("Tender Starter Showcase")),
        .h1(.text(displayTenderTitle(record.item.title))),
        .div(
            .class("tender-state"),
            .span(.class("tender-state-label"), .text(record.lifecycle.label)),
            .span(
                .class("tender-checked"),
                .text("Facts checked "),
                timeNode(record.checkedAt, formattedDate(record.checkedAt))
            )
        ),
        // Source facts (from frontmatter). The official links and the
        // "verify at source" disclaimer close the card: the advice sits
        // with the facts it qualifies, said once.
        .section(
            .class("tender-source-facts reveal"),
            .h2(.text("Source facts")),
            factGrid(for: record),
            officialLinks(for: record),
            disclaimerNode()
        ),
        // Editorial analysis (from Markdown body — the five H2 sections)
        .div(.class("tender-analysis prose"), record.item.body.node),
        // Closing step: one action (the free preview this brief
        // demonstrates; the official notice is already in the facts card)
        // and the way back to the other examples.
        .section(
            .class("tender-next"),
            .h2(.text("Next step")),
            .p(.text("Want a brief like this for an open tender? Send its public URL or ID for a free one-page preview.")),
            .div(
                .class("tender-actions"),
                .a(.class("btn btn-gold tender-request"), .href(tenderRequestHref), .text("Request a free custom preview"))
            ),
            .a(.class("back-link"), .href("/tenders/"), iconArrowBack(), .text("All worked examples"))
        )
    )
}

// MARK: - Path helper
// Publish Path.absoluteString provides the "/"-prefixed route directly.
