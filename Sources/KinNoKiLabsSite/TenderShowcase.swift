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

private let dateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd 'at' HH:mm xxx"
    f.timeZone = TimeZone(identifier: "America/Halifax")
    f.locale = Locale(identifier: "en_CA")
    return f
}()

private func iso8601String(_ date: Date) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    f.timeZone = TimeZone(identifier: "America/Halifax")
    return f.string(from: date)
}

private func formattedDate(_ date: Date) -> String {
    dateFormatter.string(from: date)
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
        .div(.dt(.text("Delivery region")), .dd(.text(record.deliveryRegion))),
        .div(.dt(.text("Published")), .dd(.text(formattedDate(record.publishedAt)))),
        .div(
            .dt(.text("Closing")),
            .dd(
                .time(
                    .datetime(iso8601String(record.closingAt)),
                    .text(formattedDate(record.closingAt))
                )
            )
        ),
        .div(.dt(.text("Document access")), .dd(.text(record.documentAccess))),
        .div(.dt(.text("Addenda status")), .dd(.text(record.addendaStatus)))
    )
}

private func officialLinks(for record: TenderRecord) -> Node<HTML.BodyContext> {
    .ul(
        .class("tender-official-links"),
        .li(.a(.href(record.noticeURL.absoluteString), .text("Official notice"))),
        .li(.a(.href(record.documentsURL.absoluteString), .text("Official documents"))),
        .li(.a(.href(record.addendaURL.absoluteString), .text("Addenda")))
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
                .text("A manually curated showcase of current Nova Scotia public tender opportunities, each turned into a source-linked starting brief with visible questions and a reusable review workflow. This is a planning aid, not a live tender directory.")
            )
        ),
        // 2. Current examples
        .section(
            .class("tender-current reveal"),
            .h2(.text("Current examples")),
            .p(.class("tender-source-note"), .text("Each entry exposes its lifecycle state and the date it was last checked. Recheck the official source before acting.")),
            .if(
                current.isEmpty,
                .p(.class("tender-empty"), .text("No current examples at this time. Check back later.")),
                else: .div(
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
                                    .text("Checked "),
                                    .time(.datetime(iso8601String(card.checkedAt)), .text(formattedDate(card.checkedAt)))
                                )
                            ),
                            .h3(.text(card.item.title)),
                            .dl(
                                .class("tender-meta"),
                                .div(.dt(.text("Issuer")), .dd(.text(card.issuer))),
                                .div(.dt(.text("Category")), .dd(.text(card.category))),
                                .div(.dt(.text("Closes")), .dd(.text(formattedDate(card.closingAt))))
                            ),
                            .if(card.featuredPack, .span(.class("tender-featured-tag"), .text("Featured pack example")))
                        )
                    }
                )
            )
        ),
        // 3. Featured demonstration
        .section(
            .class("tender-feature reveal"),
            .h2(.text("Demonstration pack")),
            .p(.text("Download the original KinNoKi Tender Starter pack — a tagged accessible PDF guide, an editable review workbook, and a plain-text official-source index. It contains original summaries and templates only; no official tender documents are redistributed.")),
            .ul(
                .class("tender-pack-list"),
                .li(.text("tender-starter-guide.pdf — tagged, PDF/UA-compliant accessibility")),
                .li(.text("tender-review-workbook.xlsx — eight review-tracking sheets")),
                .li(.text("official-sources.txt — plain-text index of authoritative sources"))
            ),
            .a(
                .class("btn btn-outline tender-download"),
                .href("/tenders/tender-starter-example.zip"),
                .attribute(named: "download", value: ""),
                .text("Download the example pack (ZIP)")
            )
        ),
        // 4. Free-preview invitation
        .section(
            .class("tender-preview reveal"),
            .h2(.text("Free custom tender preview")),
            .p(.text("Send a public tender URL or ID, your company or work type, contact details, and a short fit explanation. You will receive a free one-page starting brief showing the same source-linked review workflow — no account, no upload, no obligation.")),
            .p(.class("tender-source-note"), .text("For a deeper fit analysis, the paid Tender-to-Bid Diagnostic expands the starting brief into a compliance check, question map, and document checklist for one specific opportunity.")),
            .a(
                .class("btn btn-gold tender-request"),
                .href(tenderRequestHref),
                .text("Request a free custom preview")
            )
        ),
        // 5. Archived demonstrations
        .section(
            .class("tender-archive reveal"),
            .h2(.text("Archived demonstrations")),
            .if(
                archived.isEmpty,
                .p(.class("tender-empty"), .text("No archived demonstrations yet. When a current example closes or is withdrawn, it will be retained here as a demonstration.")),
                else: .div(
                    .class("tender-archive-grid"),
                    .forEach(archived) { card in
                        .a(
                            .class("tender-card tender-card-archive"),
                            .href(card.item.path.absoluteString),
                            .div(.class("tender-state"), .span(.class("tender-state-label"), .text(card.lifecycle.label))),
                            .h3(.text(card.item.title)),
                            .dl(.class("tender-meta"), .div(.dt(.text("Issuer")), .dd(.text(card.issuer))))
                        )
                    }
                )
            )
        ),
        disclaimerNode()
    )
}

// MARK: - Detail page

func tenderDetailMain(record: TenderRecord) -> Node<HTML.BodyContext> {
    .main(
        .class("tender-detail"),
        .a(.class("tender-back"), .href("/tenders/"), .text("← Back to Tender Starter Showcase")),
        .p(.class("eyebrow"), .text("Tender Starter Showcase")),
        .h1(.text(record.item.title)),
        .div(
            .class("tender-state"),
            .span(.class("tender-state-label"), .text(record.lifecycle.label)),
            .span(
                .class("tender-checked"),
                .text("Checked "),
                .time(.datetime(iso8601String(record.checkedAt)), .text(formattedDate(record.checkedAt)))
            )
        ),
        // Source facts (from frontmatter)
        .section(
            .class("tender-source-facts reveal"),
            .h2(.text("Source facts")),
            factGrid(for: record),
            officialLinks(for: record)
        ),
        // Editorial analysis (from Markdown body — the five H2 sections)
        .div(.class("tender-analysis prose"), record.item.body.node),
        disclaimerNode()
    )
}

// MARK: - Path helper
// Publish Path.absoluteString provides the "/"-prefixed route directly.
