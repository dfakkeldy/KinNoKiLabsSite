import Foundation
import Publish
import Plot

// MARK: - KinNoKi Theme ("metal on black" redesign)
//
// This theme is a Plot recreation of the design handoff prototype
// (dark-by-default, metallic gold identity, mobile-safe nav, honest
// product statuses). Two porting strategies are used deliberately:
//
//   • DSL for the *dynamic skeleton* — the shared header / mobile menu /
//     footer (which need the active-nav state and the JS/CSS class hooks
//     from site.js + styles.css) and the *data-driven* pages (posts,
//     app-item pages, prose/markdown pages). These vary per page.
//
//   • `Node.raw(...)` for the *copy-locked marketing bodies* — Home, Apps,
//     Echo detail, Services, About, Support. Their copy is final, so it
//     lives in the theme by design; article-like content stays in
//     Content/*.md. The markup carries semantic classes only (no inline
//     styles): layout, spacing, and type come from the shared components
//     in styles.css (.page, .page-head, .section, .band, cards…), so one
//     stylesheet keeps every page consistent.
//
// Behavior (theme toggle, OpenDyslexic, mobile menu, reveal-on-scroll)
// is wired by Resources/site.js against the classes emitted here.

extension Theme where Site == KinNoKiLabsSite {
    /// Custom theme with sticky navigation and the redesigned layout.
    static var kinNoKi: Self {
        Theme(htmlFactory: KinNoKiHTMLFactory())
    }
}

// MARK: - HTML Factory

private struct KinNoKiHTMLFactory: HTMLFactory {
    typealias Site = KinNoKiLabsSite

    func makeIndexHTML(for index: Index, context: PublishingContext<Site>) throws -> HTML {
        HTML(
            .lang(context.site.language),
            siteHead(for: index, context: context),
            .body(
                .class("page-home"),
                siteHeader(active: ""),
                homeMain(),
                siteFooter()
            )
        )
    }

    func makeSectionHTML(for section: Section<Site>, context: PublishingContext<Site>) throws -> HTML {
        switch section.id {
        case .apps:
            return HTML(
                .lang(context.site.language),
                siteHead(for: section, context: context, titleOverride: "Apps"),
                .body(.class("page-section"), siteHeader(active: navSection(for: section.path.string)), appsMain(), siteFooter())
            )
        case .posts:
            return HTML(
                .lang(context.site.language),
                siteHead(for: section, context: context, titleOverride: "Posts"),
                .body(.class("page-section"), siteHeader(active: navSection(for: section.path.string)), postsListMain(section), siteFooter())
            )
        case .tenders:
            let records = try section.items.map { try TenderRecord(item: $0) }
            return HTML(
                .lang(context.site.language),
                siteHead(for: section, context: context, titleOverride: "Tender Starter Showcase"),
                .body(
                    .class("page-section page-tenders"),
                    siteHeader(active: navSection(for: section.path.string)),
                    tenderShowcaseMain(records: records),
                    siteFooter()
                )
            )
        }
    }

    func makeItemHTML(for item: Item<Site>, context: PublishingContext<Site>) throws -> HTML {
        let isEcho = item.path.string == "apps/echo"
        let isTender = item.sectionID == .tenders
        return HTML(
            .lang(context.site.language),
            siteHead(for: item, context: context),
            .body(
                .class(isTender ? "page-item page-tender-detail" : "page-item"),
                siteHeader(active: navSection(for: item.path.string)),
                .if(item.sectionID == .apps,
                    isEcho ? echoDetailMain() : appItemMain(item),
                    else: isTender ? tenderDetailMain(record: try TenderRecord(item: item)) : postDetailMain(item)),
                siteFooter()
            )
        )
    }

    func makePageHTML(for page: Page, context: PublishingContext<Site>) throws -> HTML {
        let main: Node<HTML.BodyContext>
        let active = navSection(for: page.path.string)
        let isTaxSale = page.path.string == "taxsale"
        let isGIS = page.path.string == "gis"
        let isShakespeare = page.path.string == "shakespeare" || page.path.string.hasPrefix("shakespeare/")
        let toolsHead = page.path.string == "tools" || page.path.string.hasPrefix("tools/")
        switch page.path.string {
        case "games":             main = gamesMain(page: "hub")
        case "games/sudoku":      main = gamesMain(page: "sudoku")
        case "games/crossword":   main = gamesMain(page: "crossword")
        case "games/word-search": main = gamesMain(page: "word-search")
        case "games/kinnoki-stack":
            main = gamesMain(page: "kinnoki-stack")
        case "games/kinnoki-yard":
            main = gamesMain(page: "kinnoki-yard")
        case "games/kinnoki-charts":
            main = gamesMain(page: "kinnoki-charts")
        case "tools":                main = toolsMain(page: "hub")
        case "tools/qr-code":        main = toolsMain(page: "qr-code")
        case "tools/epub-reader":    main = toolsMain(page: "epub-reader")
        case "tools/dilution":       main = toolsMain(page: "dilution")
        case "tools/contrast":       main = toolsMain(page: "contrast")
        case "tools/word-count":     main = toolsMain(page: "word-count")
        case "tools/unit-converter": main = toolsMain(page: "unit-converter")
        case "tools/click-counter":   main = toolsMain(page: "click-counter")
        case "tools/passphrase":     main = toolsMain(page: "passphrase")
        case "services":          main = servicesMain()
        case "gis":               main = gisCaseStudyMain()
        case "shakespeare":       main = shakespeareCollectionMain()
        case "shakespeare/merchant-of-venice":
            main = shakespeareMerchantMain()
        case "shakespeare/a-midsummer-nights-dream":
            main = shakespeareMidsummerMain()
        case "learn":             main = learnMain()
        case "taxsale":           main = taxSaleHubMain()
        case "about":             main = aboutMain()
        case "support":           main = supportMain()
        default:                  main = proseMain(page)
        }
        return HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, toolsHead: toolsHead, shakespeareHead: isShakespeare),
            .body(
                .class(isTaxSale ? "page-page page-tax-sale" : isGIS ? "page-page page-gis" : isShakespeare ? "page-page page-shakespeare" : "page-page"),
                siteHeader(active: active),
                main,
                siteFooter()
            )
        )
    }

    func makeTagListHTML(for page: TagListPage, context: PublishingContext<Site>) throws -> HTML? {
        HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, titleOverride: "Tags"),
            .body(
                .class("page-tags"),
                siteHeader(active: ""),
                .main(
                    .class("site-main page page-narrow"),
                    .header(
                        .class("page-head"),
                        .p(.class("eyebrow"), .text("Tags")),
                        .h1(.class("page-title"), .text("Everything, tagged."))
                    ),
                    .div(.class("chip-row"), .forEach(page.tags.sorted()) { tag in
                        .a(.class("chip"), .href(context.site.path(for: tag)), .text(tag.string))
                    })
                ),
                siteFooter()
            )
        )
    }

    func makeTagDetailsHTML(for page: TagDetailsPage, context: PublishingContext<Site>) throws -> HTML? {
        let items = context.items(taggedWith: page.tag, sortedBy: \.date, order: .descending)
        return HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, titleOverride: page.tag.string),
            .body(
                .class("page-tag-detail"),
                siteHeader(active: ""),
                .main(
                    .class("site-main page page-narrow"),
                    .header(
                        .class("page-head"),
                        .p(.class("eyebrow"), .text("Tagged")),
                        .h1(.class("page-title"), .text(page.tag.string))
                    ),
                    .div(.class("post-list"), .forEach(items) { postCard($0) })
                ),
                siteFooter()
            )
        )
    }
}

// MARK: - Shared <head>

private func siteHead<L: Location>(
    for location: L,
    context: PublishingContext<KinNoKiLabsSite>,
    titleOverride: String? = nil,
    toolsHead: Bool = false,
    shakespeareHead: Bool = false,
    isNotFound: Bool = false
) -> Node<HTML.DocumentContext> {
    let site = context.site
    let isUnlisted = KinNoKiLabsSite.unlistedItemPaths.contains(location.path)
    let isIndex = location.path.string.isEmpty
    let baseTitle = titleOverride ?? location.title
    let pageTitle = isIndex ? site.name : "\(baseTitle) — \(site.name)"
    let description = location.description.isEmpty ? site.description : location.description
    let url = site.url(for: location.path)
    let imageURL = site.url(for: location.imagePath ?? Path("/logo.png"))

    // No-flash theme snippet — MUST run before the stylesheet so the first
    // paint already carries the stored (or default-dark) theme. Also marks
    // <html class="js"> so styles.css can hide reveal targets only when JS
    // is present (progressive enhancement).
    let noFlash = """
    document.documentElement.classList.add('js');\
    try{var t=localStorage.getItem('kinnoki-theme');\
    document.documentElement.setAttribute('data-theme',(t==='light'||t==='dark')?t:'dark');}\
    catch(e){document.documentElement.setAttribute('data-theme','dark');}
    """

    return .head(
        .meta(.charset(.utf8)),
        .meta(.name("viewport"), .content("width=device-width, initial-scale=1")),
        .element(named: "script", nodes: [.raw(noFlash)]),
        .element(named: "title", text: pageTitle),
        .meta(.name("description"), .content(description)),
        // The 404 page is served at whatever URL missed, so it has no canonical home.
        .if(!isNotFound,
            .link(.attribute(named: "rel", value: "canonical"), .attribute(named: "href", value: url.absoluteString))
        ),
        .if(isNotFound || isUnlisted,
            .meta(.name("robots"), .content("noindex"))
        ),
        .link(.attribute(named: "rel", value: "icon"), .attribute(named: "href", value: "/logo.png")),
        .if(toolsHead,
            .link(
                .attribute(named: "rel", value: "manifest"),
                .attribute(named: "href", value: "/tools/manifest.webmanifest")
            )
        ),
        .if(toolsHead,
            .meta(
                .name("theme-color"),
                .content("#000000")
            )
        ),
        .stylesheet(shakespeareHead ? "/styles.css?v=20261012-shakespeare-film" : "/styles.css"),
        .element(named: "script", nodes: [
            .attribute(named: "src", value: "/site.js?v=20260719"),
            // Non-empty value: Plot omits empty-valued attributes, and without
            // `defer` this head script would run before <body> exists.
            .attribute(named: "defer", value: "defer")
        ]),
        .meta(.attribute(named: "property", value: "og:site_name"), .attribute(named: "content", value: site.name)),
        .meta(.attribute(named: "property", value: "og:title"), .attribute(named: "content", value: pageTitle)),
        .meta(.attribute(named: "property", value: "og:description"), .attribute(named: "content", value: description)),
        .meta(.attribute(named: "property", value: "og:type"), .attribute(named: "content", value: "website")),
        .if(!isNotFound,
            .meta(.attribute(named: "property", value: "og:url"), .attribute(named: "content", value: url.absoluteString))
        ),
        .meta(.attribute(named: "property", value: "og:image"), .attribute(named: "content", value: imageURL.absoluteString)),
        .meta(.name("twitter:card"), .content("summary_large_image"))
    )
}

// MARK: - Shared header + mobile menu

/// One primary-navigation entry. `free` marks the no-cost destinations
/// (Learn, Games, Tools), which sit after a hairline divider so the studio's
/// paid work (Services) and its proof (Apps, About) read as one group.
private struct NavItem {
    let path: String
    let title: String
    var free = false
}

/// Primary navigation, in order. The brand mark links home, so there is no
/// separate Home item; Posts, Support, and Privacy live in the footer.
private let primaryNavigation: [NavItem] = [
    NavItem(path: "/services", title: "Services"),
    NavItem(path: "/apps", title: "Apps"),
    NavItem(path: "/about", title: "About"),
    NavItem(path: "/learn", title: "Learn", free: true),
    NavItem(path: "/games", title: "Games", free: true),
    NavItem(path: "/tools", title: "Tools", free: true),
]

/// The primary-nav item a page belongs to, decided in one place.
/// Proof-of-work pages sit under Services; app guides and help under Apps.
private func navSection(for path: String) -> String {
    let first = path.split(separator: "/").first.map(String.init) ?? ""
    switch first {
    case "services", "gis", "tenders":
        return "/services"
    case "apps", "support", "taxsale", "testflight", "nsmarksthespot-privacy":
        return "/apps"
    case _ where first.hasPrefix("echo-") || first.hasSuffix("-help"):
        return "/apps"
    case "about", "learn", "games", "tools":
        return "/" + first
    default:
        return ""
    }
}

private func siteHeader(active: String) -> Node<HTML.BodyContext> {
    .group(
        .header(
            .class("site-header"),
            .nav(
                .class("site-nav"),
                .attribute(named: "aria-label", value: "Primary"),
                brandLink(),
                .div(
                    .class("nav-actions"),
                    .ul(
                        .class("nav-links"),
                        .forEach(primaryNavigation) { navLink($0, active) }
                    ),
                    .div(
                        .class("nav-toggles"),
                        fontToggle("Aa"),
                        themeToggle()
                    ),
                    .button(
                        .class("nav-burger"),
                        .attribute(named: "type", value: "button"),
                        .attribute(named: "aria-label", value: "Open menu"),
                        .attribute(named: "aria-controls", value: "site-menu"),
                        .attribute(named: "aria-expanded", value: "false"),
                        iconMenu()
                    )
                )
            )
        ),
        mobileMenu(active: active)
    )
}

private func brandLink() -> Node<HTML.BodyContext> {
    .a(
        .class("nav-brand"),
        .href("/"),
        .attribute(named: "aria-label", value: "KinNoKi Labs home"),
        brandMarks(),
        .span(.text("KinNoKi Labs"))
    )
}

/// Both logo variants are in the DOM; styles.css shows the one that suits
/// the active theme. The 128px WebP marks cover the 28-40px header and footer
/// sizes at 3x; the full 748px PNGs are only for the large hero tree.
private func brandMarks<Ctx>() -> Node<Ctx> {
    .raw(#"<img class="logo-on-dark" src="/images/brand/logo-mark-128.webp" width="128" height="128" alt=""><img class="logo-on-light" src="/images/brand/logo-mark-light-128.webp" width="128" height="128" alt="">"#)
}

private func navLink(_ item: NavItem, _ active: String) -> Node<HTML.ListContext> {
    let link: Node<HTML.BodyContext> = item.path == active
        ? .a(.href(item.path), .attribute(named: "aria-current", value: "page"), .text(item.title))
        : .a(.href(item.path), .text(item.title))
    return item.free ? .li(.class("nav-free"), link) : .li(link)
}

private func fontToggle(_ label: String) -> Node<HTML.BodyContext> {
    .button(
        .class("font-toggle"),
        .attribute(named: "type", value: "button"),
        .attribute(named: "title", value: "OpenDyslexic font"),
        .attribute(named: "aria-label", value: "Toggle OpenDyslexic font"),
        .attribute(named: "aria-pressed", value: "false"),
        .text(label)
    )
}

private func themeToggle() -> Node<HTML.BodyContext> {
    .button(
        .class("theme-toggle"),
        .attribute(named: "type", value: "button"),
        .attribute(named: "aria-label", value: "Toggle dark mode"),
        iconSun(),
        iconMoon()
    )
}

private func mobileMenu(active: String) -> Node<HTML.BodyContext> {
    .div(
        .class("mobile-menu"),
        .id("site-menu"),
        .attribute(named: "role", value: "dialog"),
        .attribute(named: "aria-modal", value: "true"),
        .attribute(named: "aria-label", value: "Menu"),
        .div(
            .class("mobile-menu-bar"),
            .a(
                .class("mobile-menu-brand"),
                .href("/"),
                .attribute(named: "aria-label", value: "KinNoKi Labs home"),
                brandMarks(),
                .span(.text("KinNoKi Labs"))
            ),
            .button(
                .class("menu-close"),
                .attribute(named: "type", value: "button"),
                .attribute(named: "aria-label", value: "Close menu"),
                iconClose()
            )
        ),
        // A bare <nav>: Tests/tools/routes.test.mjs locates this list by it.
        .nav(
            .forEach(primaryNavigation) { mobileLink($0, active) },
            .button(
                .class("font-toggle"),
                .attribute(named: "type", value: "button"),
                .attribute(named: "aria-label", value: "Toggle OpenDyslexic font"),
                .attribute(named: "aria-pressed", value: "false"),
                .text("Aa · OpenDyslexic")
            )
        ),
        .a(.class("btn btn-gold mobile-menu-cta"), .href("mailto:hello@kinnokilabs.com"), .text("hello@kinnokilabs.com"))
    )
}

private func mobileLink(_ item: NavItem, _ active: String) -> Node<HTML.BodyContext> {
    .a(
        .if(item.free, .class("nav-free")),
        .href(item.path),
        .if(item.path == active, .attribute(named: "aria-current", value: "page")),
        .text(item.title),
        iconChevronDim()
    )
}

// MARK: - Shared footer

/// The footer doubles as the site map: every public page is one click away.
private func footerColumn(_ heading: String, _ links: [(href: String, title: String)]) -> Node<HTML.BodyContext> {
    .div(
        .class("footer-col"),
        // A <p>, not a heading, so the footer stays out of each page's outline.
        .p(.class("footer-heading"), .text(heading)),
        .ul(
            .class("footer-list"),
            .forEach(links) { link in
                .li(.a(.href(link.href), .text(link.title)))
            }
        )
    )
}

private func siteFooter() -> Node<HTML.BodyContext> {
    .footer(
        .class("site-footer"),
        .div(
            .class("inner"),
            .nav(
                .class("footer-grid"),
                .attribute(named: "aria-label", value: "Footer"),
                .div(
                    .class("footer-brand"),
                    .a(
                        .class("footer-brand-link"),
                        .href("/"),
                        .attribute(named: "aria-label", value: "KinNoKi Labs home"),
                        brandMarks(),
                        .span(.text("KinNoKi Labs"))
                    ),
                    .p(.class("footer-tagline"), .text("Building Tools That Make Sense.")),
                    .a(.class("footer-email"), .href("mailto:hello@kinnokilabs.com"), .text("hello@kinnokilabs.com"))
                ),
                footerColumn("Work with me", [
                    ("/services", "Services"),
                    ("/gis/", "GIS case study"),
                    ("/tenders/", "Tender Starter Showcase"),
                ]),
                footerColumn("Apps", [
                    ("/apps/echo", "Echo"),
                    ("/apps/macromark/", "MacroMark"),
                    ("/apps/nsmarksthespot/", "NS Marks The Spot"),
                    ("/apps/visualtimer/", "Turn Timer"),
                    ("/support", "Support"),
                ]),
                footerColumn("Learn & play", [
                    ("/learn", "Learning audiobooks"),
                    ("/listen/", "Echo Listening Room"),
                    ("/fiction/", "Fiction Listening Room"),
                    ("/taxsale/", "Tax Sale Hub"),
                    ("/fishing/", "Fishing map"),
                    ("/gas/", "Gas Price Watch"),
                    ("/games", "Games"),
                    ("/tools", "Tools"),
                ]),
                footerColumn("Studio", [
                    ("/about", "About"),
                    ("/posts", "Posts"),
                    ("/privacy", "Privacy"),
                    ("/nsmarksthespot-privacy/", "NS Marks The Spot privacy"),
                    ("/echo-privacy/", "Echo app privacy"),
                ])
            ),
            .div(
                .class("footer-legal"),
                .raw(#"<p class="footer-copy"><span>© 2026 KinNoKi Labs</span><span class="sep" aria-hidden="true"> · </span><span>Cape Breton, Nova Scotia</span><span class="sep" aria-hidden="true"> · </span><span>Generated with <a href="https://github.com/johnsundell/publish" target="_blank" rel="noopener">Publish</a></span></p>"#),
                .div(
                    .class("footer-legal-links"),
                    .raw(#"<a href="https://github.com/dfakkeldy" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>GitHub</a>"#),
                    .button(
                        .class("font-toggle"),
                        .attribute(named: "type", value: "button"),
                        .attribute(named: "aria-label", value: "Toggle OpenDyslexic font"),
                        .attribute(named: "aria-pressed", value: "false"),
                        .text("Aa · OpenDyslexic")
                    )
                )
            )
        )
    )
}

// MARK: - 404 page

/// Cloudflare Pages serves a top-level `404.html` with HTTP 404 for any
/// unmatched route. Without one it treats the site as a single-page app and
/// answers every unknown path with the homepage and HTTP 200.
func makeNotFoundHTML(context: PublishingContext<KinNoKiLabsSite>) -> HTML {
    let page = Page(path: "404", content: Content(
        title: "Page not found",
        description: "That page isn't on kinnokilabs.com."
    ))
    return HTML(
        .lang(context.site.language),
        siteHead(for: page, context: context, isNotFound: true),
        .body(
            .class("page-page page-not-found"),
            siteHeader(active: ""),
            notFoundMain(),
            siteFooter()
        )
    )
}

private func notFoundMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main page page-narrow">
      <header class="page-head">
        <p class="eyebrow">404</p>
        <h1 class="page-title">That page isn't here.</h1>
        <p class="page-lede">The link may be old, or the address may have a typo. These are the main places to go from here.</p>
      </header>
      <div class="row-list">
        <a class="support-row" href="/">Home \(svgRowChevron)</a>
        <a class="support-row" href="/services">Services \(svgRowChevron)</a>
        <a class="support-row" href="/apps">Apps \(svgRowChevron)</a>
        <a class="support-row" href="/learn">Learn \(svgRowChevron)</a>
      </div>
      <p class="page-footnote">Looking for something specific? Email <a class="link-quiet" href="mailto:hello@kinnokilabs.com">hello@kinnokilabs.com</a>.</p>
    </main>
    """)
}

// MARK: - Data-driven pages (posts, app items, prose)

private func gamesMain(page: String) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main games-main"),
        .attribute(named: "data-game-page", value: page),
        .div(
            .class("games-live-region"),
            .attribute(named: "aria-live", value: "polite")
        ),
        .div(
            .class("games-app"),
            .attribute(named: "id", value: "games-app")
        ),
        .element(named: "noscript", nodes: [
            .p(
                .class("game-storage-notice"),
                .text("The Arcade Hall needs JavaScript. Everything runs and stays on your device.")
            )
        ]),
        .element(named: "script", nodes: [
            .attribute(named: "type", value: "module"),
            .attribute(named: "src", value: "/games/ui.js")
        ])
    )
}

private func toolsMain(page: String) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main tools-main"),
        .attribute(named: "data-tool-page", value: page),
        .div(
            .class("tools-live-region"),
            .attribute(named: "aria-live", value: "polite")
        ),
        .div(
            .class("tools-app"),
            .attribute(named: "id", value: "tools-app")
        ),
        .if(page == "hub",
            .p(
                .class("tool-privacy"),
                .text("Runs entirely in your browser. Nothing you enter leaves this device.")
            )
        ),
        .element(named: "noscript", nodes: [
            .p(
                .class("tool-privacy"),
                .text("These tools need JavaScript. Everything runs and stays on your device.")
            )
        ]),
        .element(named: "script", nodes: [
            .attribute(named: "type", value: "module"),
            .attribute(named: "src", value: "/tools/ui.js")
        ])
    )
}

private func taxSaleHubMain() -> Node<HTML.BodyContext> {
    .main(
        .class("tax-sale-main"),
        .raw(
            #"""
            <section class="tax-hero" aria-labelledby="tax-hero-title">
              <div class="tax-wrap tax-hero-grid">
                <div class="tax-hero-copy">
                  <p class="tax-kicker">KinNoKi Labs · Nova Scotia field desk</p>
                  <h1 id="tax-hero-title">Nova Scotia<br><em>tax sales, mapped.</em></h1>
                  <p class="tax-lede">Posted municipal sale dates, a live parcel map, and a free illustrated guide to how the whole process works.</p>
                  <div class="tax-actions">
                    <a class="tax-button tax-button-solid" href="/apps/nsmarksthespot/map/">Open the live map <span aria-hidden="true">↗</span></a>
                    <a class="tax-button tax-button-line" href="#dates">See posted dates <span aria-hidden="true">↓</span></a>
                  </div>
                  <p class="tax-refreshed">Dates checked October 23, 2026 on each municipality’s page</p>
                </div>

                <aside class="tax-desk" aria-label="Next posted tax sale">
                  <div class="tax-desk-label"><span>Next posted sale</span><span>NS / 2026</span></div>
                  <div class="tax-desk-date">
                    <span class="tax-desk-day">23</span>
                    <div><strong>November</strong><small>Victoria County · public auction, 11:00 a.m.</small></div>
                  </div>
                  <div class="tax-desk-rule"></div>
                  <p><strong>Dec 8</strong> CBRM · public auction, Sydney</p>
                  <p><strong>30+ days</strong> before each sale, its property list goes up</p>
                  <small>The map adds each sale’s parcels once the municipality publishes its list.</small>
                </aside>
              </div>
            </section>

            <section class="tax-section tax-dates-section" id="dates" aria-labelledby="tax-dates-heading">
              <div class="tax-wrap">
                <div class="tax-section-intro reveal">
                  <div>
                    <p class="tax-kicker">Posted dates</p>
                    <h2 id="tax-dates-heading">What’s<br><em>coming up.</em></h2>
                  </div>
                  <p>These are the upcoming sales posted on the municipal pages checked October 23; other municipalities may post theirs later. Each property list goes up at least 30 days before its sale and can shrink right up to the day, so open the municipal page again before you go.</p>
                </div>

                <div class="tax-date-list">
                  <article class="tax-date-card reveal">
                    <div class="tax-date-calendar" aria-hidden="true"><span>NOV</span><strong>23</strong><small>2026</small></div>
                    <div class="tax-date-copy">
                      <p class="tax-status">Posted · Public auction</p>
                      <h3>Municipality of the County of Victoria</h3>
                      <p><strong>Monday, November 23 at 11:00 a.m.</strong><br>St. Mark’s Masonic Lodge, 24 Queen Street, Baddeck</p>
                      <p class="tax-date-detail">Register in advance · the room closes when the sale begins · property list on the county’s tax-sale notice page</p>
                    </div>
                    <div class="tax-date-actions">
                      <a href="https://victoriacounty.com/residents/property-taxation-services/tax-sales/">Official Victoria County page <span aria-hidden="true">↗</span></a>
                      <a href="https://victoriacounty.com/property-tax-sale-notice/">Property list page <span aria-hidden="true">↗</span></a>
                    </div>
                  </article>
                  <article class="tax-date-card reveal">
                    <div class="tax-date-calendar" aria-hidden="true"><span>DEC</span><strong>8</strong><small>2026</small></div>
                    <div class="tax-date-copy">
                      <p class="tax-status">Posted · Public auction</p>
                      <h3>Cape Breton Regional Municipality</h3>
                      <p><strong>Tuesday, December 8; registration opens at 10:00 a.m.</strong><br>Centre 200 Main Concourse, 481 George Street, Sydney</p>
                      <p class="tax-date-detail">In-person registration with photo ID · minimum bid plus a $200 fee at the sale · balance within three business days</p>
                    </div>
                    <div class="tax-date-actions">
                      <a href="https://cbrm.ns.ca/business/property-sales-management/tax-sales/">Official CBRM page <span aria-hidden="true">↗</span></a>
                    </div>
                  </article>
                </div>

                <div class="tax-notice reveal" role="note">
                  <strong>Lists change until the sale.</strong>
                  <p>Owners can pay before the sale, and municipalities revise or withdraw listings. Check the current list, terms, time and place with the municipality before you go.</p>
                </div>

                <h3 class="tax-past-heading" id="tax-past-heading">Recent sale dates · results on each municipality’s page</h3>
                <div class="tax-date-list tax-past-list" aria-labelledby="tax-past-heading">
                  <article class="tax-date-card tax-date-past reveal">
                    <div class="tax-date-calendar" aria-hidden="true"><span>SEP</span><strong>15</strong><small>2026</small></div>
                    <div class="tax-date-copy">
                      <p class="tax-status">Sale date passed · Results with the municipality</p>
                      <h3>Halifax Regional Municipality</h3>
                      <p><strong>Advertised for Tuesday, September 15; tenders closed at 10:00 a.m.</strong><br>Online or Alderney Customer Service Centre, 40 Alderney Drive, Dartmouth</p>
                      <p class="tax-date-detail">Last notice snapshot September 3: 19 advertised rows · 20 PIDs</p>
                    </div>
                    <div class="tax-date-actions">
                      <a href="https://www.halifax.ca/home-property/property-taxes/tax-sale">Official Halifax page <span aria-hidden="true">↗</span></a>
                    </div>
                  </article>
                  <article class="tax-date-card tax-date-past reveal">
                    <div class="tax-date-calendar" aria-hidden="true"><span>SEP</span><strong>14</strong><small>2026</small></div>
                    <div class="tax-date-copy">
                      <p class="tax-status">Sale date passed · Results with the municipality</p>
                      <h3>Municipality of the County of Victoria</h3>
                      <p><strong>Advertised for Monday, September 14; tenders closed at 12:00 noon</strong><br>Municipal Administration Building, 495 Chebucto Street, Baddeck</p>
                      <p class="tax-date-detail">Last notice snapshot September 3: 5 advertised rows</p>
                    </div>
                    <div class="tax-date-actions">
                      <a href="https://victoriacounty.com/residents/property-taxation-services/tax-sales/">Official Victoria County page <span aria-hidden="true">↗</span></a>
                    </div>
                  </article>
                  <article class="tax-date-card tax-date-past reveal">
                    <div class="tax-date-calendar" aria-hidden="true"><span>AUG</span><strong>31</strong><small>2026</small></div>
                    <div class="tax-date-copy">
                      <p class="tax-status">Sale date passed · Results with the municipality</p>
                      <h3>Municipality of the County of Annapolis</h3>
                      <p><strong>Advertised for Monday, August 31; tenders closed at 1:00 p.m.</strong><br>752 St George Street, Annapolis Royal</p>
                      <p class="tax-date-detail">Last notice snapshot July 23: 1 advertised row · 0 withdrawn rows</p>
                    </div>
                    <div class="tax-date-actions">
                      <a href="https://annapoliscounty.ca/tax-finance/tax-sale">Official Annapolis page <span aria-hidden="true">↗</span></a>
                    </div>
                  </article>
                  <article class="tax-date-card tax-date-past reveal">
                    <div class="tax-date-calendar" aria-hidden="true"><span>AUG</span><strong>20</strong><small>2026</small></div>
                    <div class="tax-date-copy">
                      <p class="tax-status">Sale date passed · Results with the municipality</p>
                      <h3>Town of Middleton</h3>
                      <p><strong>Advertised for Thursday, August 20 at 10:00 a.m.</strong><br>Town Hall Council Chambers, 131 Commercial Street, Middleton</p>
                      <p class="tax-date-detail">Last notice snapshot August 18: 2 advertised rows · 0 withdrawn rows</p>
                    </div>
                    <div class="tax-date-actions">
                      <a href="https://www.discovermiddleton.ca/property-tax-sale-information">Official Middleton page <span aria-hidden="true">↗</span></a>
                    </div>
                  </article>
                  <article class="tax-date-card tax-date-past reveal">
                    <div class="tax-date-calendar" aria-hidden="true"><span>AUG</span><strong>11</strong><small>2026</small></div>
                    <div class="tax-date-copy">
                      <p class="tax-status">Sale date passed · Results with the municipality</p>
                      <h3>Municipality of the County of Inverness</h3>
                      <p><strong>Advertised for Tuesday, August 11 at 9:30 a.m.</strong><br>St. Peter’s Parish Hall, 260 Main Street, Port Hood</p>
                      <p class="tax-date-detail">Last notice snapshot August 10: 27 advertised rows · 18 withdrawn rows</p>
                    </div>
                    <div class="tax-date-actions">
                      <a href="https://invernesscounty.ca/services/finance-taxation/tax-sales/">Official Inverness page <span aria-hidden="true">↗</span></a>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section class="tax-section tax-map-section" aria-labelledby="tax-map-heading">
              <div class="tax-wrap tax-split">
                <div class="reveal">
                  <p class="tax-kicker">Explore</p>
                  <h2 id="tax-map-heading">From notice row<br>to <em>parcel context.</em></h2>
                </div>
                <div class="tax-split-copy reveal">
                  <p class="tax-large-copy">Search an eight-digit PID, Nova Scotia civic address, or postal community, open a mapped tax-sale parcel, and compare it with roads, water, aerial imagery, Crown land, and municipal context.</p>
                  <ul class="tax-facts">
                    <li><span>Mapped</span><strong>Dated municipal notices and past results, with links to each source</strong></li>
                    <li><span>Search</span><strong>PID, civic address, postal community, or visible parcel</strong></li>
                    <li><span>Privacy</span><strong>No owner names; no location upload</strong></li>
                    <li><span>Boundaries</span><strong>Approximate context; a surveyor locates the line</strong></li>
                  </ul>
                  <a class="tax-text-link" href="/apps/nsmarksthespot/map/">Explore the current map <span aria-hidden="true">→</span></a>
                </div>
              </div>
            </section>

            <section class="tax-section tax-guide-section" id="guide" aria-labelledby="tax-guide-heading">
              <div class="tax-wrap">
                <div class="tax-guide-feature reveal">
                  <img class="tax-book-cover" src="/taxsale/cover.png" alt="Cover of Beyond the Tax-Sale Packet by Dan Fakkeldy" width="1600" height="2560" loading="lazy" decoding="async">
                  <div class="tax-guide-copy">
                    <p class="tax-kicker">Free guide · PDF, EPUB and audiobook</p>
                    <h2 id="tax-guide-heading"><em>Beyond the<br>Tax-Sale Packet</em></h2>
                    <p class="tax-large-copy">How Nova Scotia tax sales work, from the first unpaid bill to the deed. Learn to read a notice, build a dated research file, and take each question to the person who can answer it. Now in a plain-language illustrated edition with 31 diagrams and charts.</p>
                    <div class="tax-actions tax-guide-actions">
                      <a class="tax-button tax-button-solid" href="/taxsale/beyond-the-tax-sale-packet-illustrated.pdf" download>Download the illustrated PDF <span aria-hidden="true">↓</span></a>
                      <a class="tax-button tax-button-line" href="/listen/?book=beyond-the-tax-sale-packet">Listen in the Listening Room <span aria-hidden="true">→</span></a>
                    </div>
            <p class="tax-guide-meta">Illustrated PDF · 149 pages · 13 chapters · 39 figures · free</p>
                  </div>
                </div>

                <div class="tax-format-grid" aria-label="Guide formats">
                  <article class="tax-format-card reveal">
                    <p class="tax-format-number">01</p>
                    <p class="tax-status tax-status-active">New · October 2026</p>
                    <h3>Illustrated PDF</h3>
            <p>The plain-language edition: 31 diagrams and charts, a footer on every page that explains its abbreviations, and the official sources for each chapter. Print it or read it on screen.</p>
                    <a href="/taxsale/beyond-the-tax-sale-packet-illustrated.pdf" download>Download the PDF <span aria-hidden="true">↓</span></a>
                  </article>
                  <article class="tax-format-card reveal">
                    <p class="tax-format-number">02</p>
                    <p class="tax-status tax-status-active">Available now</p>
                    <h3>EPUB ebook</h3>
            <p>The illustrated edition for e-readers, with pop-up definitions. The first-edition EPUB, which matches the audiobook word for word, stays available.</p>
                    <a href="/taxsale/beyond-the-tax-sale-packet-illustrated.epub" download>Download the illustrated EPUB <span aria-hidden="true">↓</span></a>
                    <a href="/taxsale/beyond-the-tax-sale-packet.epub" download>First-edition EPUB <span aria-hidden="true">↓</span></a>
                    <a href="/tools/epub-reader/">Open the on-device reader <span aria-hidden="true">→</span></a>
                  </article>
                  <article class="tax-format-card reveal">
                    <p class="tax-format-number">03</p>
                    <p class="tax-status tax-status-active">Available now</p>
                    <h3>Audiobook</h3>
            <p>The first edition, narrated in full (4 hours 13 minutes), with synced text and figures in the Listening Room. Its wording is the first edition’s, so it differs from the illustrated text.</p>
                    <a href="/listen/?book=beyond-the-tax-sale-packet">Open the Listening Room <span aria-hidden="true">→</span></a>
                  </article>
                </div>
                <a class="tax-text-link tax-development-link" href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/docs/nova-scotia-tax-sale-book">Open the public research record and sources <span aria-hidden="true">↗</span></a>
              </div>
            </section>

            <section class="tax-section tax-sources-section" aria-labelledby="tax-sources-heading">
              <div class="tax-wrap tax-split">
                <div class="reveal">
                  <p class="tax-kicker">Official starting points</p>
                  <h2 id="tax-sources-heading">Keep the source<br><em>one click away.</em></h2>
                </div>
                <div class="tax-source-list reveal">
                  <a href="https://nslegislature.ca/sites/default/files/legc/statutes/municipal%20government.pdf"><span>Provincial law</span><strong>Nova Scotia Municipal Government Act</strong><b aria-hidden="true">↗</b></a>
                  <a href="https://victoriacounty.com/residents/property-taxation-services/tax-sales/"><span>Next sale · November 23</span><strong>Victoria County tax-sales page</strong><b aria-hidden="true">↗</b></a>
                  <a href="https://cbrm.ns.ca/business/property-sales-management/tax-sales/"><span>Next sale · December 8</span><strong>CBRM tax-sales page</strong><b aria-hidden="true">↗</b></a>
                  <a href="https://www.novascotia.ca/sign-property-online"><span>Land records</span><strong>Nova Scotia Property Online</strong><b aria-hidden="true">↗</b></a>
                </div>
              </div>
            </section>

            <section class="tax-boundary" aria-labelledby="tax-boundary-heading">
              <div class="tax-wrap tax-boundary-grid reveal">
                <p class="tax-kicker">Where answers come from</p>
                <h2 id="tax-boundary-heading">The map shows you <em>where.</em><br>The records tell you <em>whether.</em></h2>
                <div>
                  <p>Use the map and the guide to find a parcel, read its notice and list the questions that matter.</p>
                  <p>Access, title, boundaries, condition, value and permits are answered by the land registry, the municipality and the right professional: a lawyer, surveyor, planner, inspector or insurer. Confirm live details with the municipality before acting.</p>
                </div>
              </div>
            </section>

            <section class="tax-final" aria-labelledby="tax-final-heading">
              <div class="tax-wrap reveal">
                <p class="tax-kicker">kinnokilabs.com/taxsale</p>
                <h2 id="tax-final-heading">Start with the notice.<br><em>Keep the questions.</em></h2>
                <div class="tax-actions tax-final-actions">
                  <a class="tax-button tax-button-solid" href="/apps/nsmarksthespot/map/">Open the live map <span aria-hidden="true">↗</span></a>
                  <a class="tax-button tax-button-line" href="#dates">Review posted dates <span aria-hidden="true">↑</span></a>
                </div>
                <p class="tax-fine-print">A public guide to a public process. For a decision about a specific property, ask a qualified professional.</p>
              </div>
            </section>
            """#
        )
    )
}

private func postsListMain(_ section: Section<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main page page-narrow"),
        .header(
            .class("page-head"),
            .p(.class("eyebrow"), .text("Posts")),
            .h1(.class("page-title"), .text("Studio notes."))
        ),
        .div(.class("post-list"), .forEach(section.items.sorted { $0.date > $1.date }) { postCard($0) })
    )
}

private func postCard(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .a(
        .class("post-card"),
        .href(item.path.absoluteString),
        .p(.class("post-kicker"), .text(kicker(for: item))),
        .h2(.text(item.title)),
        .unwrap(item.description.isEmpty ? nil : item.description) {
            .p(.class("post-card-desc"), .text($0))
        }
    )
}

private func postDetailMain(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main article-page"),
        .a(.class("back-link"), .href("/posts"), iconArrowBack(), .text("All posts")),
        .p(.class("eyebrow"), .text(kicker(for: item))),
        .article(.class("prose prose-post"), item.body.node),
        .a(.class("back-link post-end"), .href("/posts"), iconArrowBack(), .text("All posts"))
    )
}

private func appItemMain(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main article-page"),
        .a(.class("back-link"), .href("/apps"), iconArrowBack(), .text("All apps")),
        .div(
            .class("app-hero"),
            appHeroIcon(item),
            .div(
                .class("app-hero-copy"),
                .h1(.class("app-hero-title"), .text(item.title)),
                .unwrap(item.metadata.tagline) {
                    .p(.class("app-hero-tagline"), .text($0))
                },
                .div(
                    .class("app-hero-meta"),
                    .unwrap(item.metadata.status) { .span(.class("status-chip"), .text($0)) },
                    .unwrap(item.metadata.platforms) { .span(.class("platforms"), .text($0)) }
                )
            )
        ),
        .article(.class("prose"), item.body.node),
        .if(
            item.path.string == "apps/nsmarksthespot",
            .aside(
                .class("app-case-study-callout"),
                .p(.class("eyebrow"), .text("Built from field experience")),
                .p(.text("NS Marks The Spot continues a mapping practice that began with forestry field maps, aerial mosaics, and spatial screening work.")),
                .a(.class("row-link"), .href("/gis/"), .text("Read the GIS case study →"))
            )
        )
    )
}

private func appHeroIcon(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    if let imagePath = item.imagePath {
        return .img(
            .class("app-hero-icon"),
            .src(imagePath.absoluteString),
            .alt(item.metadata.iconAlt ?? "\(item.title) app icon")
        )
    }
    return .span(.class("app-hero-icon app-monogram"), .attribute(named: "aria-hidden", value: "true"), .text(String(item.title.prefix(1))))
}

/// Where a guide page sits, so it can link back up. Help pages return to
/// Support (which lists them); Echo's guides return to Echo.
private let pageParents: [String: (href: String, title: String)] = [
    "echo-help": ("/support", "Support"),
    "macromark-help": ("/support", "Support"),
    "nsmarksthespot-help": ("/support", "Support"),
    "visualtimer-help": ("/support", "Support"),
    "echo-manual": ("/apps/echo", "Echo"),
    "echo-learn": ("/apps/echo", "Echo"),
    "echo-focus": ("/apps/echo", "Echo"),
    "echo-beta": ("/apps/echo", "Echo"),
    "echo-devlog": ("/apps/echo", "Echo"),
    "testflight": ("/apps", "All apps"),
]

private func proseMain(_ page: Page) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main article-page"),
        .unwrap(pageParents[page.path.string]) { parent in
            .a(.class("back-link"), .href(parent.href), iconArrowBack(), .text(parent.title))
        },
        .article(.class("prose"), page.body.node)
    )
}

// MARK: - Helpers

private func kicker(for item: Item<KinNoKiLabsSite>) -> String {
    let tag = item.tags.first.map { $0.string.capitalized } ?? "Studio"
    return "\(formattedDate(item.date)) · \(tag)"
}

private func formattedDate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "MMMM d, yyyy"
    return formatter.string(from: date)
}

// MARK: - Chrome icons (inline Lucide SVGs)

private func iconSun<Ctx>() -> Node<Ctx> {
    .raw(#"<svg class="icon-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>"#)
}

private func iconMoon<Ctx>() -> Node<Ctx> {
    .raw(#"<svg class="icon-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>"#)
}

private func iconMenu<Ctx>() -> Node<Ctx> {
    .raw(#"<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"></path><path d="M4 6h16"></path><path d="M4 18h16"></path></svg>"#)
}

private func iconClose<Ctx>() -> Node<Ctx> {
    .raw(#"<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>"#)
}

private func iconChevronDim<Ctx>() -> Node<Ctx> {
    .raw(#"<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron-dim" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>"#)
}

/// Shared with TenderShowcase.swift for its back link.
func iconArrowBack<Ctx>() -> Node<Ctx> {
    .raw(#"<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg>"#)
}

// MARK: - Marketing bodies (copy-locked; layout comes from styles.css classes)

// MARK: - Inline icons shared by the marketing bodies (Lucide, stroke = currentColor)

private let svgCheck = #"<svg class="icon-tick" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>"#
private let svgChevron = #"<svg class="icon-tick" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>"#
private let svgArrow = #"<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>"#
private let svgMail = #"<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>"#
private let svgRowChevron = #"<svg class="row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>"#
private let svgGitHub = #"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>"#

private func homeMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main">
      <section class="hero">
        <div class="hero-backdrop" aria-hidden="true">
          <div class="glow"></div>
          <img class="tree logo-on-dark" src="/images/brand/logo-mark.png" alt="">
          <img class="tree logo-on-light" src="/images/brand/logo-mark-light.png" alt="">
          <div class="fade"></div>
        </div>
        <div class="hero-copy">
          <p class="eyebrow">Independent technical studio · Nova Scotia</p>
          <h1>Building Tools<br><span class="hero-metal">That Make Sense.</span></h1>
          <p class="hero-sub">I solve messy technical and operational problems — from spreadsheets, documents, websites, and disconnected tools to automation and custom software when it earns its place.</p>
          <div class="hero-ctas">
            <a class="btn btn-gold" href="/services">Work with me</a>
            <a class="btn btn-gray" href="/apps">Explore the apps</a>
          </div>
          <ul class="proof-strip">
            <li><span>4 apps</span></li>
            <li><a class="link-quiet" href="https://apps.apple.com/ca/app/macromark/id6785081218" target="_blank" rel="noopener">MacroMark 1.0 on the App Store</a></li>
            <li><a class="link-quiet" href="https://github.com/dfakkeldy" target="_blank" rel="noopener">Source is public on GitHub; licences vary</a></li>
            <li><span>Built around real workflows</span></li>
          </ul>
        </div>
      </section>

      <section class="section section-first reveal">
        <div class="bento-tint split-services band home-services">
          <div>
            <p class="eyebrow">Services</p>
            <h2 class="band-title">I untangle the technical mess behind the work.</h2>
            <p class="band-lede">When spreadsheets, forms, job folders, websites, and software stop lining up, I map what is really happening and make the smallest useful fix.</p>
            <div class="band-actions band-actions-row">
              <a class="btn btn-gold" href="/services">See services</a>
              <a class="row-link" href="mailto:hello@kinnokilabs.com">\(svgMail)hello@kinnokilabs.com</a>
            </div>
          </div>
          <ul class="chevron-list offer-lines">
            <li>\(svgChevron)Technical workflow diagnostic — one problem, clearly mapped</li>
            <li>\(svgChevron)Systems cleanup, integrations &amp; automation</li>
            <li>\(svgChevron)Knowledge bases, dashboards &amp; right-sized software</li>
          </ul>
        </div>
      </section>

      <section class="section reveal">
        <p class="eyebrow">Flagship app</p>
        <div class="bento bento-gold split-flagship">
          <div class="flagship-copy">
            <img class="flagship-icon" src="/images/apps/echo.png" alt="Echo app icon — an infinity symbol in silver and gold">
            <h2 class="flagship-title">Echo</h2>
            <p class="flagship-tagline">For Every Mind — turn listening into learning.</p>
            <p class="flagship-desc">The audiobook player that helps you remember what you heard. Built for minds that learn in stolen, interrupted minutes.</p>
            <ul class="tick-list">
              <li>\(svgCheck)<p><strong>Word-perfect read-along.</strong> <span>True karaoke, tuned on-device to the real audio.</span></p></li>
              <li>\(svgCheck)<p><strong>One-tap flashcards.</strong> <span>Spaced repetition (FSRS / FSRS-4.5) with the narrator's audio attached.</span></p></li>
              <li>\(svgCheck)<p><strong>Smart Rewind.</strong> <span>Interruptions stop costing you context.</span></p></li>
            </ul>
            <div class="pill-row">
              <span class="badge-pill">iPhone &amp; iPad</span>
              <span class="badge-pill">Apple Watch</span>
              <span class="badge-pill">Mac</span>
            </div>
            <div class="flagship-actions">
              <a class="btn btn-gold btn-md" href="/apps/echo">Meet Echo</a>
              <a class="link-quiet" href="/echo-beta">Join the TestFlight beta</a>
              <a class="link-quiet" href="/learn">Sample learning audiobooks</a>
            </div>
          </div>
          <div class="flagship-visual">
            <div class="flagship-glow" aria-hidden="true"></div>
            <div class="flagship-phone">
              <div class="flagship-phone-frame">
                <img src="/images/screenshots/echo/merchant-player.webp" width="1206" height="2622" loading="lazy" decoding="async" alt="Echo Now Playing screen for The Merchant of Venice — The Novel, with teal colours drawn from its square audiobook cover">
              </div>
            </div>
            <div class="flagship-edge" aria-hidden="true"></div>
          </div>
        </div>
      </section>

      <section class="section reveal">
        <p class="eyebrow">Also in the lab</p>
        <div class="card-grid">
          <a class="app-card" href="/apps/macromark/">
            <img class="app-icon" src="/images/apps/macromark.png" alt="MacroMark app icon">
            <h3>MacroMark</h3>
            <p>Apple Watch voice capture for people whose notes live in Markdown.</p>
            <div class="app-card-meta">
              <span class="status-chip">App Store — 1.0</span>
              <span class="platforms">Watch · iPhone</span>
            </div>
          </a>
          <a class="app-card" href="/apps/nsmarksthespot/">
            <img class="app-icon" src="/images/apps/nsmarksthespot.svg" alt="NS Marks The Spot app icon">
            <h3>NS Marks The Spot</h3>
            <p>Nova Scotia parcels, dated tax-sale notices, and Fletcher’s 1880s sheets on one source-linked browser map.</p>
            <div class="app-card-meta">
              <span class="status-chip">Live map</span>
              <span class="platforms">Browser · iPhone</span>
            </div>
          </a>
          <a class="app-card" href="/apps/visualtimer/">
            <img class="app-icon" src="/images/apps/turntimer.png" alt="Turn Timer app icon: a clock inside a ring of coloured countdown segments">
            <h3>Turn Timer</h3>
            <p>Visual rounds for countdowns, turns, routines, and reusable sequences.</p>
            <div class="app-card-meta">
              <span class="status-chip">TestFlight</span>
              <span class="platforms">iPhone · Browser</span>
            </div>
          </a>
        </div>
        <div class="section-foot">
          <a class="row-link" href="/apps">All apps and where each one stands \(svgArrow)</a>
        </div>
      </section>

      <section class="closing reveal">
        <p class="closing-quote">Built in Cape Breton, Nova Scotia — bid rooms and field maps before that. <span>The tools exist because the work demanded them.</span></p>
        <a class="row-link row-link-gold" href="/about">About the studio \(svgArrow)</a>
      </section>
    </main>
    """)
}

private func appsMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main page">
      <header class="page-head">
        <p class="eyebrow">Apps</p>
        <h1 class="page-title">Four apps, honestly labelled.</h1>
        <p class="page-lede">MacroMark 1.0 is <a class="link-quiet" href="https://apps.apple.com/ca/app/macromark/id6785081218" target="_blank" rel="noopener">live on the App Store</a> and free. Echo and Turn Timer are public TestFlight betas; the NS Marks The Spot browser map is live, with the native iPhone app in internal TestFlight builds. Source is public on GitHub; licences vary.</p>
      </header>

      <a class="reveal echo-row" href="/apps/echo">
        <img class="echo-row-icon" src="/images/apps/echo.png" alt="Echo app icon">
        <div class="echo-row-body">
          <div class="echo-row-title">
            <h2>Echo: Audiobook Study Player</h2>
            <span class="status-chip">TestFlight beta — open</span>
          </div>
          <p>An audiobook player built for studying, not just listening. Word-perfect read-along, one-tap flashcards, Smart Rewind, and a Watch remote you design.</p>
          <span class="platforms">iPhone &amp; iPad · Apple Watch · Mac · GPL-3.0</span>
        </div>
        <svg class="echo-row-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
      </a>

      <div class="reveal app-list">
        <a class="app-card" href="/apps/macromark/">
          <img class="app-icon" src="/images/apps/macromark.png" alt="MacroMark app icon">
          <h3>MacroMark</h3>
          <p class="app-card-lead">Tap your Watch complication, speak, lower your wrist — the note lands in today's Markdown file, ready for Obsidian or Logseq.</p>
          <p class="app-card-note">Verbal Macros turn speech into structure: say "Task" and get <code>- [ ]</code></p>
          <div class="app-card-meta">
            <span class="status-chip">App Store — 1.0</span>
            <span class="platforms">Watch · iPhone</span>
          </div>
        </a>
        <a class="app-card" href="/apps/nsmarksthespot/">
          <img class="app-icon" src="/images/apps/nsmarksthespot.svg" alt="NS Marks The Spot app icon">
          <h3>NS Marks The Spot</h3>
          <p>The live product is the browser map — parcel search by PID, civic address, or postal community, dated municipal tax-sale notices on live parcel geometry, provincial reference layers, and Fletcher’s 1880s sheets as an optional overlay, with optional live location. The native iPhone app is a separate offline companion in internal TestFlight builds, not on the App Store.</p>
          <div class="app-card-meta">
            <span class="status-chip">Live browser map</span>
            <span class="platforms">Browser · iPhone</span>
          </div>
        </a>
        <a class="app-card" href="/apps/visualtimer/">
          <img class="app-icon" src="/images/apps/turntimer.png" alt="Turn Timer app icon: a clock inside a ring of coloured countdown segments">
          <h3>Turn Timer</h3>
          <p>An Apple-native visual sequence timer — one-tap visual countdowns plus reusable sequences. It also runs in your browser, with nothing to install.</p>
          <div class="app-card-meta">
            <span class="status-chip">TestFlight</span>
            <span class="platforms">iPhone · Browser</span>
          </div>
        </a>
      </div>
      <p class="page-footnote">Cards lead to each app's public home. Source for everything is on <a class="link-quiet" href="https://github.com/dfakkeldy" target="_blank" rel="noopener">GitHub</a>. For the field experience behind NS Marks The Spot, read the <a class="link-quiet" href="/gis/">GIS case study</a>.</p>
    </main>
    """)
}

private func servicesMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main page">
      <section class="services-hero-grid">
        <div class="page-head page-head-flush">
          <p class="eyebrow">Technical problem-solving</p>
          <h1 class="page-title">When the tools stop lining up, I make the work make sense.</h1>
          <p class="page-lede">The problem may look like a spreadsheet nobody trusts, a website that no longer fits, repeated data entry, scattered job files, or several tools that do not talk to one another.</p>
          <p class="page-lede">I'm Dan Fakkeldy. I trace how the work actually moves, fix the smallest valuable bottleneck first, and leave behind something your team can understand and operate.</p>
        </div>
        <div class="system-map" aria-label="Examples of disconnected business information brought into one working system">
          <p class="system-map-label">What’s tangled?</p>
          <div class="system-map-nodes">
            <span class="system-map-node">Spreadsheets &amp; data</span>
            <span class="system-map-node">Documents &amp; job files</span>
            <span class="system-map-node">Email &amp; forms</span>
            <span class="system-map-node">Websites &amp; tools</span>
          </div>
          <div class="system-map-connector" aria-hidden="true"></div>
          <div class="system-map-result">
            <span>One useful outcome</span>
            <strong>A system people can understand</strong>
          </div>
        </div>
      </section>

      <div class="reveal offer-grid">
        <div class="offer-card">
          <div class="offer-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg></div>
          <h2>Technical Workflow Diagnostic</h2>
          <p>A fixed engagement around one concrete problem. I trace the people, documents, data, and tools involved, find the costly handoff, and explain the options in plain language.</p>
          <p class="offer-note"><strong>The recommendation can be no build.</strong> Cleanup, a better spreadsheet, or a clearer source of truth may solve the problem before custom software is justified.</p>
        </div>
        <div class="offer-card">
          <div class="offer-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg></div>
          <h2>Systems Cleanup &amp; Automation</h2>
          <p>Improve what you already use: organize files, repair a spreadsheet or website, connect forms to the right records, reduce duplicate entry, or automate a repeated handoff.</p>
          <p class="offer-note"><strong>One visible improvement at a time.</strong> The business keeps running, and the people doing the work can review what changed.</p>
        </div>
        <div class="offer-card">
          <div class="offer-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg></div>
          <h2>Practical Tools &amp; Knowledge Systems</h2>
          <p>When cleanup is not enough, I can build a focused browser tool, dashboard, searchable company knowledge base, mobile companion, or custom software around the actual job.</p>
          <p class="offer-note"><strong>The platform follows the work.</strong> New software earns its place by solving a defined problem, staying reviewable, and leaving your business in control.</p>
        </div>
      </div>

      <section class="reveal page-block scope-chips">
        <p class="eyebrow">Problems I take on</p>
        <div class="chip-row">
          <span class="chip">Spreadsheet &amp; data cleanup</span>
          <span class="chip">Document &amp; file systems</span>
          <span class="chip">Forms, reporting &amp; handoffs</span>
          <span class="chip">Websites &amp; browser tools</span>
          <span class="chip">Integrations &amp; automation</span>
          <span class="chip">Dashboards &amp; knowledge bases</span>
          <span class="chip">Mobile or custom software</span>
          <span class="chip chip-optional">Apple release support — when that is the actual problem</span>
        </div>
      </section>

      <section class="reveal page-block">
        <div class="section-head">
          <p class="eyebrow">Why it pays</p>
          <h2 class="section-title">Less friction in the system means more room for the work.</h2>
        </div>
        <div class="check-list">
          <div class="row">\(svgCheck)<p><strong>Faster answers</strong> <span>— the current file, number, or decision is easier to find and trust.</span></p></div>
          <div class="row">\(svgCheck)<p><strong>Fewer missed handoffs</strong> <span>— forms, files, due dates, and follow-up stay connected.</span></p></div>
          <div class="row">\(svgCheck)<p><strong>Less owner bottleneck</strong> <span>— repeated decisions stop living only in one person's memory.</span></p></div>
          <div class="row">\(svgCheck)<p><strong>Less duplicate entry</strong> <span>— the same information stops being copied between disconnected tools.</span></p></div>
          <div class="row">\(svgCheck)<p><strong>Clearer delegation</strong> <span>— people can see the expected process and the source behind it.</span></p></div>
          <div class="row">\(svgCheck)<p><strong>Less rework</strong> <span>— the next task starts from reviewed knowledge instead of a blank page.</span></p></div>
        </div>
      </section>

      <div class="proof-grid">
        <section class="reveal tender-proof-callout">
          <div>
            <p class="eyebrow">GIS proof of work</p>
            <h2>Thirteen years from field maps to mapping products.</h2>
            <p>See how imperfect records, imagery, field observations, and public data became useful maps — with uncertainty and proof boundaries kept visible.</p>
          </div>
          <a class="btn btn-outline" href="/gis/">Explore the GIS case study</a>
        </section>

        <section class="reveal tender-proof-callout">
          <div>
            <p class="eyebrow">Proof of work</p>
            <h2>See a public tender turned into a practical starting workflow.</h2>
            <p>The Tender Starter Showcase demonstrates source-linked review, visible questions, and reusable bid-preparation structure without pretending to replace the official notice.</p>
          </div>
          <a class="btn btn-outline" href="/tenders/">Explore the Tender Starter Showcase</a>
        </section>
      </div>

      <section class="reveal bento-tint split-services band">
        <div>
          <h2 class="band-title">How engagements start</h2>
          <ol class="step-list">
            <li class="step"><span class="num">01</span><p><strong>Show me the problem.</strong> <span>Start with the workarounds, files, screens, and repeated frustrations — not a software shopping list.</span></p></li>
            <li class="step"><span class="num">02</span><p><strong>Map the real system.</strong> <span>I trace how the work moves and identify the smallest useful improvement.</span></p></li>
            <li class="step"><span class="num">03</span><p><strong>Implement and hand it back.</strong> <span>Fixed scope where possible, documented clearly, with human review for decisions that carry real cost.</span></p></li>
          </ol>
        </div>
        <div class="band-actions band-actions-panel">
          <p class="band-prompt">Have a technical mess you keep working around?</p>
          <a class="btn btn-gold" href="mailto:hello@kinnokilabs.com">hello@kinnokilabs.com</a>
          <p class="band-note">You do not need to know what kind of software you need. Plain email; no call required.</p>
        </div>
      </section>
    </main>
    """)
}

private func gisCaseStudyMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="gis-main" aria-labelledby="gis-title">
      <header class="gis-hero">
        <div class="gis-hero-copy">
          <p class="eyebrow">GIS case study · 2013–2026</p>
          <h1 id="gis-title">From field maps to<br><em>mapping products.</em></h1>
          <p class="gis-lead">More than a decade turning field observations, forestry records, imagery, public data, and rural infrastructure questions into maps people can actually use.</p>
          <blockquote>The work is not making a pretty map. It is turning imperfect real-world information into a useful, understandable decision tool.</blockquote>
        </div>
        <aside class="gis-scope-note">
          <span>What you are seeing</span>
          <strong>Five public-safe views</strong>
          <p>Original client work stays private. Reconstructed examples use invented geometry; the two documentary crops were checked for identifying detail and visible-layer rights.</p>
        </aside>
      </header>

      <nav class="gis-timeline-nav" aria-label="Case study timeline">
        <ol>
          <li><a href="#gis-2013"><span>2013</span>Field status</a></li>
          <li><a href="#gis-2015"><span>2015</span>Aerial mosaic</a></li>
          <li><a href="#gis-2023-visibility"><span>2023</span>Visibility screen</a></li>
          <li><a href="#gis-2023-field"><span>2023</span>Field review</a></li>
          <li><a href="#gis-2026"><span>2026</span>Mapping product</a></li>
        </ol>
      </nav>

      <section class="gis-transect" aria-label="Thirteen years of practical GIS work">
        <article class="gis-stop reveal" id="gis-2013">
          <div class="gis-marker" aria-hidden="true"><span>2013</span></div>
          <figure class="gis-figure">
            <img src="/images/gis/field-classification-2013.webp" width="1440" height="900" fetchpriority="high" decoding="async" alt="Generalized map reconstruction with invented land shapes coloured yellow, blue, pink, green, and grey for different field and paperwork states.">
            <figcaption><span>Public-safe reconstruction</span> Invented geometry; no basemap, names, areas, or client location.</figcaption>
          </figure>
          <div class="gis-stop-copy">
            <p class="gis-era">ArcMap 10.1 · Forestry operations</p>
            <h2>Field status, made legible</h2>
            <div class="gis-brief">
              <div><h3>Problem</h3><p>A forestry job held areas in several paperwork states. The map needed to distinguish confirmed, new, and unresolved information without pretending uncertain records were settled.</p></div>
              <div><h3>Inputs</h3><p>Working GIS layers, property-reference information, previous mail-outs, and field notes that still needed checking.</p></div>
              <div><h3>Method</h3><p>Revised colour categories in ArcMap and carried uncertainty into the legend instead of smoothing it away.</p></div>
              <div><h3>Output</h3><p>A field and office reference map with a deliberately visible “needs review” state.</p></div>
            </div>
            <div class="gis-boundary">
              <p><strong>It supported:</strong> reconciling the map and paperwork before follow-up.</p>
              <p><strong>It did not establish:</strong> survey boundaries, title, Crown status, or present-day conditions.</p>
            </div>
          </div>
        </article>

        <article class="gis-stop gis-stop-reverse reveal" id="gis-2015">
          <div class="gis-marker" aria-hidden="true"><span>2015</span></div>
          <figure class="gis-figure gis-figure-wide">
            <img src="/images/gis/aerial-mosaic-2015.webp" width="1440" height="500" loading="lazy" decoding="async" alt="Winter aerial mosaic of snow-covered forest with a dark winding stream, stitched from frames Dan captured on a flight, with the first-pass seams left in.">
            <figcaption><span>Creator-captured imagery</span> Cropped to the imaged band of the original mosaic; structures and location context removed.</figcaption>
          </figure>
          <div class="gis-stop-copy">
            <p class="gis-era">Field capture · Raster stitching</p>
            <h2>A first aerial mosaic</h2>
            <div class="gis-brief">
              <div><h3>Problem</h3><p>See a whole flown area rather than a folder of disconnected frames.</p></div>
              <div><h3>Inputs</h3><p>Camera images captured by Dan during a flight over the work area.</p></div>
              <div><h3>Method</h3><p>Stitched overlapping frames into one continuous, zoomable PDF while keeping the imperfect first-pass seams visible.</p></div>
              <div><h3>Output</h3><p>A continuous winter mosaic that made terrain and image coverage easier to review.</p></div>
            </div>
            <div class="gis-boundary">
              <p><strong>It supported:</strong> reviewing coverage, stitch quality, and broad terrain relationships.</p>
              <p><strong>It did not establish:</strong> survey-grade position, orthophoto accuracy, or current conditions.</p>
            </div>
          </div>
        </article>

        <article class="gis-stop reveal" id="gis-2023-visibility">
          <div class="gis-marker" aria-hidden="true"><span>2023</span></div>
          <figure class="gis-figure gis-figure-dark">
            <img src="/images/gis/visibility-analysis-2023.webp" width="1440" height="900" loading="lazy" decoding="async" alt="Generalized dark regional shape containing a regular point grid classified green, yellow, orange, and red for relative modelled visibility.">
            <figcaption><span>Public-safe reconstruction</span> Invented geography and classes; utilities, addresses, basemap, and exact results removed.</figcaption>
          </figure>
          <div class="gis-stop-copy">
            <p class="gis-era">QGIS 3.30 · Scripted spatial analysis</p>
            <h2>A regional question, screened spatially</h2>
            <div class="gis-brief">
              <div><h3>Problem</h3><p>Compare where a hypothetical 200-metre turbine might be visible from fewer or more buildings across a large candidate area.</p></div>
              <div><h3>Inputs</h3><p>A regular candidate-point grid, land-screening geometry, and modelled building-visibility counts.</p></div>
              <div><h3>Method</h3><p>QGIS plus an adjustable scripted analysis developed iteratively from the plain-language question.</p></div>
              <div><h3>Output</h3><p>A classified regional screening map that made relative patterns visible.</p></div>
            </div>
            <div class="gis-boundary">
              <p><strong>It supported:</strong> comparing parameters and focusing further research.</p>
              <p><strong>It did not establish:</strong> wind resource, siting approval, grid access, land rights, environmental suitability, or project viability.</p>
            </div>
          </div>
        </article>

        <article class="gis-stop gis-stop-reverse reveal" id="gis-2023-field">
          <div class="gis-marker" aria-hidden="true"><span>2023</span></div>
          <figure class="gis-figure">
            <img src="/images/gis/planting-review-2023.webp" width="1440" height="900" loading="lazy" decoding="async" alt="Generalized planting review reconstruction with invented green treatment blocks, white field access line, and green or red observation points.">
            <figcaption><span>Public-safe reconstruction</span> Invented treatment blocks and sample points; landowner, counts, outcome, imagery, and location removed.</figcaption>
          </figure>
          <div class="gis-stop-copy">
            <p class="gis-era">QGIS 3.32 · Field verification</p>
            <h2>Field observations, returned as a decision map</h2>
            <div class="gis-brief">
              <div><h3>Problem</h3><p>Turn a planting inspection and its tally into a clear account of what was observed and where follow-up might be needed.</p></div>
              <div><h3>Inputs</h3><p>Field plot observations, tree-condition counts, photographs, and a treatment boundary.</p></div>
              <div><h3>Method</h3><p>Reviewed how the tally should be interpreted, connected observations back to the map, and kept the field evidence alongside the summary.</p></div>
              <div><h3>Output</h3><p>A plot map and companion tally for review and follow-up.</p></div>
            </div>
            <div class="gis-boundary">
              <p><strong>It supported:</strong> reviewing a historical, sample-based field outcome and locating areas to revisit.</p>
              <p><strong>It did not establish:</strong> a whole-site inventory, a current condition, or a result independent of the agreed tally method.</p>
            </div>
          </div>
        </article>

        <article class="gis-stop reveal" id="gis-2026">
          <div class="gis-marker" aria-hidden="true"><span>2026</span></div>
          <figure class="gis-figure gis-product-figure">
            <img src="/images/gis/ns-marks-product-2026.webp" width="1440" height="900" loading="lazy" decoding="async" alt="The NS Marks The Spot browser map over Cape Breton, with its PID and address search and map layers panel, and the licence footer showing OpenStreetMap and Nova Scotia open data credits.">
            <figcaption><span>Public map, October 2026</span> Cape Breton in the browser map: PID and address search, map layers panel, and the source and licence credits.</figcaption>
          </figure>
          <div class="gis-stop-copy">
            <p class="gis-era">Native + browser mapping · Product engineering</p>
            <h2>The map became a product</h2>
            <div class="gis-brief">
              <div><h3>Problem</h3><p>Historical scans, public records, and field position arrive in different formats — often with weak connectivity, privacy constraints, and source-specific licence terms.</p></div>
              <div><h3>Inputs</h3><p>Official and public sources, user-owned images and GeoPDFs, and the local context a researcher brings to the map.</p></div>
              <div><h3>Method</h3><p>Offline-first native tiles; browser georeferencing with embedded GeoPDF frames or manual control points; local-file handling, source receipts, and licence gates.</p></div>
              <div><h3>Output</h3><p><a href="/apps/nsmarksthespot/">NS Marks The Spot</a> as an iPhone companion and an <a href="/apps/nsmarksthespot/map/">open browser map</a>.</p></div>
            </div>
            <div class="gis-boundary">
              <p><strong>It supports:</strong> source-linked research, field orientation, and better questions about historical geography.</p>
              <p><strong>It does not establish:</strong> survey position, title, access, present road or trail condition, tax-sale status, or legal advice.</p>
            </div>
            <p class="gis-rights-note">Capture from the exact public <a href="https://github.com/dfakkeldy/ns-marks-the-spot" target="_blank" rel="noopener">NS Marks The Spot source</a>. The visible background retains <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributor attribution</a>; the listed USGS GeoPDF is represented only by metadata and an extent outline.</p>
          </div>
        </article>
      </section>

      <section class="gis-practice reveal" aria-labelledby="gis-practice-title">
        <p class="eyebrow">The practice behind the pictures</p>
        <h2 id="gis-practice-title">A map earns trust at its edges.</h2>
        <div class="gis-practice-grid">
          <div><span>01</span><h3>Start with the decision</h3><p>Choose data, scale, and output from what someone needs to understand or do next.</p></div>
          <div><span>02</span><h3>Carry uncertainty</h3><p>Unknown, unresolved, and source-limited information stays visible instead of being polished into certainty.</p></div>
          <div><span>03</span><h3>Protect the source</h3><p>Private artifacts stay private; public layers keep their attribution and licence conditions.</p></div>
          <div><span>04</span><h3>State the boundary</h3><p>Every useful map also says what it cannot prove and which official source must be checked.</p></div>
        </div>
      </section>

      <aside class="gis-disclaimer reveal" aria-label="GIS case study limitation">
        <strong>Portfolio, not authority.</strong>
        <p>These examples demonstrate mapping practice and product development. They are not proof of title, boundary, access, value, permissions, condition, service, regulatory approval, or current source status. Verify high-stakes decisions with the relevant official source and qualified professional.</p>
      </aside>

      <section class="gis-cta reveal">
        <div>
          <p class="eyebrow">Have a map-shaped problem?</p>
          <h2>Bring the messy source material.</h2>
          <p>Start with the field notes, old PDF, public dataset, or repeated question. The first job is to work out what the evidence can honestly support.</p>
        </div>
        <div class="gis-cta-actions">
          <a class="btn btn-gold" href="mailto:hello@kinnokilabs.com?subject=GIS%20project%20question">Discuss a GIS problem</a>
          <a class="row-link" href="/services">See all services</a>
          <a class="row-link" href="/apps">Explore the apps</a>
        </div>
      </section>
    </main>
    """)
}

private func aboutMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main page">
      <header class="page-head">
        <p class="eyebrow">About</p>
        <h1 class="page-title">A solo studio with dirt on its boots.</h1>
        <p class="page-lede">I'm Dan Fakkeldy. <strong>KinNoKi Labs</strong> is my one-person studio, solving messy technical and operational problems from Cape Breton, Nova Scotia — across documents, data, websites, automation, and custom software.</p>
        <p class="page-lede">The Apple apps are visible proof of that work, not the boundary of it. The same approach runs through everything: understand the real work, find the painful handoff, and make the smallest useful improvement.</p>
      </header>

      <div class="reveal about-grid">
        <div class="about-card">
          <h2>Problem-first</h2>
          <p>Understand the real work and the painful handoff before choosing a tool or platform.</p>
        </div>
        <div class="about-card">
          <h2>Broad technical range</h2>
          <p>Repair what exists, connect the right pieces, and build something new only when the problem justifies it.</p>
        </div>
        <div class="about-card">
          <h2>Reviewable systems</h2>
          <p>Small systems that show where every answer came from — not black boxes — especially when decisions carry real cost.</p>
        </div>
        <div class="about-card">
          <h2>Open source</h2>
          <p>I share what I learn. The apps and several supporting tools are public on <a class="link-quiet" href="https://github.com/dfakkeldy" target="_blank" rel="noopener">GitHub</a>.</p>
        </div>
      </div>

      <section class="reveal page-block story">
        <p class="eyebrow">Background</p>
        <p class="story-lead">Before KinNoKi Labs, I spent years in bid rooms — estimates, tender paperwork, and the documents that follow a job around. Several of these apps started on a rural mail route.</p>
        <p class="story-body">That mix keeps the work honest. I know what it costs to quote work against a deadline with the numbers scattered across old jobs, and I know what a tool has to survive to earn its place on a busy day: spotty connectivity, repeated paperwork, and no patience for software that gets in the way.</p>
      </section>

      <section class="reveal contact-band">
        <p class="contact-band-text">Want to work together, or just say hello?</p>
        <div class="contact-band-actions">
          <a class="row-link" href="/services">See services \(svgArrow)</a>
          <a class="btn btn-gold" href="mailto:hello@kinnokilabs.com">hello@kinnokilabs.com</a>
        </div>
      </section>
    </main>
    """)
}

private func supportMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main page page-narrow">
      <header class="page-head">
        <p class="eyebrow">Support</p>
        <h1 class="page-title">Stuck on something?</h1>
        <p class="page-lede">Pick the app you need help with, or email for anything else.</p>
      </header>
      <div class="row-list">
        <a class="support-row" href="/echo-help"><img class="app-icon support-row-icon" src="/images/apps/echo.png" alt="" width="36" height="36"><span>Echo</span>\(svgRowChevron)</a>
        <a class="support-row" href="/macromark-help"><img class="app-icon support-row-icon" src="/images/apps/macromark.png" alt="" width="36" height="36"><span>MacroMark</span>\(svgRowChevron)</a>
        <a class="support-row" href="/nsmarksthespot-help"><img class="app-icon support-row-icon" src="/images/apps/nsmarksthespot.svg" alt="" width="36" height="36"><span>NS Marks The Spot</span>\(svgRowChevron)</a>
        <a class="support-row" href="/visualtimer-help"><img class="app-icon support-row-icon" src="/images/apps/turntimer.png" alt="" width="36" height="36"><span>Turn Timer</span>\(svgRowChevron)</a>
      </div>
      <p class="page-footnote">For general inquiries, business opportunities, or feedback: <a class="link-quiet" href="mailto:hello@kinnokilabs.com">hello@kinnokilabs.com</a>.</p>
    </main>
    """)
}

private func learnMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main learn-main">
      <section class="learn-hero">
        <div class="learn-hero-copy">
          <p class="eyebrow">Learning audiobooks</p>
          <h1>Learn something by listening.</h1>
          <p class="learn-hero-sub">I make focused, AI-assisted learning audiobooks and test them in Echo, my audiobook study app.</p>
          <div class="learn-ctas">
            <a class="btn btn-gold" href="mailto:learn@kinnokilabs.com">Send a topic</a>
            <a class="btn btn-gray" href="/listen/">Listen in your browser</a>
            <a class="btn btn-gray" href="/echo-beta">Try Echo</a>
          </div>
        </div>
        <aside class="learn-intake-card" aria-label="Topic request summary">
          <p class="learn-card-label">Request a topic</p>
          <p>Send a topic you genuinely want to learn. If it is a good fit, I will make a short custom audiobook and invite you to test it in Echo.</p>
          <a class="row-link" href="mailto:learn@kinnokilabs.com">learn@kinnokilabs.com</a>
        </aside>
      </section>

      <section class="reveal learn-section">
        <div class="contact-band">
          <div class="contact-band-copy">
            <p class="learn-card-label">Echo Listening Room</p>
            <p class="contact-band-lede">Stream a sample learning audiobook right here, with the same read-along captions Echo uses. No install, no signup.</p>
          </div>
          <a class="btn btn-gold" href="/listen/">Open the Listening Room</a>
        </div>
      </section>

      <section class="reveal learn-section">
        <div class="learn-section-heading">
          <p class="eyebrow">Sample books</p>
          <h2>Examples from the public library.</h2>
          <p>These are examples, not a polished commercial catalog. The public repo holds the EPUB files, readable Markdown, covers, and notes about how each book was made.</p>
        </div>

        <div class="learn-book-grid">
          <article class="learn-book-card">
            <img class="learn-book-cover" src="/learn/covers/echo-from-the-inside.png" alt="Cover of Echo, From the Inside" width="1600" height="2560" loading="lazy" decoding="async">
            <div>
              <p class="learn-book-runtime">17 chapters · about 5.4 hours</p>
              <h3>Echo, From the Inside</h3>
              <p>A gentle tour of how a real iOS app is put together, taught through Echo's public source.</p>
            </div>
            <div class="learn-book-links">
              <a href="/listen/?book=echo-from-the-inside">Listen</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/books/echo-from-the-inside" target="_blank" rel="noopener">Book folder</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/raw/main/books/echo-from-the-inside/echo-from-the-inside.epub">EPUB</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/blob/main/books/echo-from-the-inside/echo-from-the-inside.md" target="_blank" rel="noopener">Read</a>
            </div>
          </article>

          <article class="learn-book-card">
            <img class="learn-book-cover" src="/learn/covers/why-it-feels-right.png" alt="Cover of Why It Feels Right" width="1600" height="2560" loading="lazy" decoding="async">
            <div>
              <p class="learn-book-runtime">18 chapters · about 5.0 hours</p>
              <h3>Why It Feels Right</h3>
              <p>A plain-language guide to Apple design vocabulary and why some interfaces quietly feel better than others.</p>
            </div>
            <div class="learn-book-links">
              <a href="/listen/?book=why-it-feels-right">Listen</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/books/why-it-feels-right" target="_blank" rel="noopener">Book folder</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/raw/main/books/why-it-feels-right/why-it-feels-right.epub">EPUB</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/blob/main/books/why-it-feels-right/why-it-feels-right.md" target="_blank" rel="noopener">Read</a>
            </div>
          </article>

          <article class="learn-book-card">
            <img class="learn-book-cover" src="/learn/covers/findable.png" alt="Cover of Findable" width="1600" height="2560" loading="lazy" decoding="async">
            <div>
              <p class="learn-book-runtime">8 chapters · about 3.0 hours</p>
              <h3>Findable</h3>
              <p>An honest beginner guide to getting a small app discovered without pretending marketing is magic.</p>
            </div>
            <div class="learn-book-links">
              <a href="/listen/?book=findable">Listen</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/books/findable" target="_blank" rel="noopener">Book folder</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/raw/main/books/findable/findable.epub">EPUB</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/blob/main/books/findable/findable.md" target="_blank" rel="noopener">Read</a>
            </div>
          </article>
          <article class="learn-book-card">
            <img class="learn-book-cover" src="/learn/covers/rodents-in-the-walls.png" alt="Cover of Rodents in the Walls" width="1600" height="2560" loading="lazy" decoding="async">
            <div>
              <p class="learn-book-runtime">9 chapters · about 2.0 hours</p>
              <h3>Rodents in the Walls</h3>
              <p>A Western Cape Breton guide to identifying, excluding, repairing after, and safely cleaning up around squirrels and other rodents.</p>
            </div>
            <div class="learn-book-links">
              <a href="/listen/?book=rodents-in-the-walls">Listen</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/books/rodents-in-the-walls" target="_blank" rel="noopener">Book folder</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/raw/main/books/rodents-in-the-walls/rodents-in-the-walls.epub">EPUB</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/blob/main/books/rodents-in-the-walls/rodents-in-the-walls.md" target="_blank" rel="noopener">Read</a>
            </div>
          </article>

          <article class="learn-book-card">
            <img class="learn-book-cover" src="/learn/covers/chicken-predators.png" alt="Cover of Chicken Predators" width="1600" height="2560" loading="lazy" decoding="async">
            <div>
              <p class="learn-book-runtime">16 chapters · about 3.1 hours</p>
              <h3>Chicken Predators</h3>
              <p>A Cape Breton field guide to identifying what is taking your chickens, protecting the flock, and understanding the legal boundaries around wildlife.</p>
            </div>
            <div class="learn-book-links">
              <a href="/listen/?book=chicken-predators">Listen</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/books/chicken-predators" target="_blank" rel="noopener">Book folder</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/raw/main/books/chicken-predators/chicken-predators.epub">EPUB</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/blob/main/books/chicken-predators/chicken-predators.md" target="_blank" rel="noopener">Read</a>
            </div>
          </article>
          <a class="learn-library-tile" href="https://github.com/dfakkeldy/explainer-audiobooks" target="_blank" rel="noopener">Browse the public Explainer Audiobooks library \(svgArrow)</a>
        </div>
      </section>

      <section class="reveal learn-section learn-request-grid">
        <div>
          <p class="eyebrow">Request a topic</p>
          <h2>Tell me what you want to learn.</h2>
          <p>Send me a topic, with as much detail as you want. If it's a good fit, I'll make a short custom audiobook and give you early access to Echo so you can test it.</p>
          <a class="btn btn-gold" href="mailto:learn@kinnokilabs.com">learn@kinnokilabs.com</a>
        </div>
        <div class="learn-request-list">
          <p>I take a limited number of requests each month.</p>
          <p>Useful feedback gets first pick for the next custom book.</p>
          <p>Please don't send private workplace, customer, medical, legal, or financial details.</p>
        </div>
      </section>

      <section class="reveal learn-section learn-notes">
        <div class="learn-note">
          <p class="learn-card-label">Optional library sharing</p>
          <p>With your permission, public-safe books may be added to the learning audiobook library so other people can use them too. That is optional; a private request can stay private.</p>
        </div>
        <div class="learn-note">
          <p class="learn-card-label">Honesty note</p>
          <p>The books are AI-assisted, researched, and spot-checked, but they are not expert-reviewed professional advice. Treat them as a friendly starting point and check primary sources for anything important.</p>
        </div>
      </section>
    </main>
    """)
}

private func echoDetailMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main">
      <section class="band-dark echo-hero">
        <div class="glow-top"></div>
        <div class="echo-hero-inner">
          <a class="echo-back" href="/apps"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg>All apps</a>
          <img class="echo-hero-icon" src="/images/apps/echo.png" alt="Echo app icon — an infinity symbol in silver and gold">
          <h1 class="echo-hero-title">Echo</h1>
          <p class="echo-hero-tagline">For Every Mind — turn listening into learning.</p>
          <p class="echo-hero-lede">The audiobook player that helps you remember what you heard — word-perfect read-along, one-tap flashcards, and a study system built on the real science of memory.</p>
          <div class="echo-hero-pills">
            <span class="echo-pill">iPhone &amp; iPad</span>
            <span class="echo-pill">Apple Watch</span>
            <span class="echo-pill">Mac</span>
            <span class="echo-pill echo-pill-gold">Open source · GPL-3.0</span>
          </div>
          <div class="echo-hero-actions">
            <a class="btn btn-gold" href="https://testflight.apple.com/join/Zu9rzg59">Join the TestFlight beta</a>
            <a class="echo-source-link" href="https://github.com/dfakkeldy/Echo" target="_blank" rel="noopener">\(svgGitHub)View source</a>
          </div>
        </div>
      </section>

      <section class="reveal echo-gallery">
        <div class="screens-grid">
          <figure class="screen-figure">
            <div class="screen-frame"><img src="/images/screenshots/echo/merchant-player.webp" width="1206" height="2622" loading="lazy" decoding="async" alt="Echo Now Playing screen for The Merchant of Venice — The Novel, with its square audiobook cover and teal playback controls"></div>
            <figcaption class="screen-caption"><strong>Colours from your cover.</strong> <em>The Merchant of Venice — The Novel</em> gives the player its teal palette.</figcaption>
          </figure>
          <figure class="screen-figure">
            <div class="screen-frame"><img src="/images/screenshots/echo/merchant-chapters.webp" width="1206" height="2622" loading="lazy" decoding="async" alt="Echo chapter list for The Merchant of Venice — The Novel"></div>
            <figcaption class="screen-caption"><strong>Find your chapter.</strong> Browse <em>The Merchant of Venice — The Novel</em> one chapter at a time.</figcaption>
          </figure>
          <figure class="screen-figure">
            <div class="screen-frame"><img src="/images/screenshots/echo/merchant-reader.webp" width="1206" height="2622" loading="lazy" decoding="async" alt="Echo reader showing the modern-English Merchant of Venice Novel, with the paused audiobook and its square Venice-arches cover"></div>
            <figcaption class="screen-caption"><strong>Read in modern English.</strong> The Novel's text, with audiobook controls close at hand.</figcaption>
          </figure>
        </div>
        <div class="watch-row">
          <figure class="screen-figure watch-figure">
            <div class="screen-frame watch-frame"><img src="/images/screenshots/echo/merchant-watch-playback.webp" width="416" height="496" loading="lazy" decoding="async" alt="Echo Apple Watch playback controls for The Merchant of Venice — The Novel, with its square audiobook cover"></div>
            <figcaption class="screen-caption"><strong>Playback controls on Apple Watch.</strong> The Novel's square audiobook cover stays in view.</figcaption>
          </figure>
          <figure class="screen-figure watch-figure">
            <div class="screen-frame watch-frame"><img src="/images/screenshots/echo/merchant-watch-volume.webp" width="416" height="496" loading="lazy" decoding="async" alt="Echo Apple Watch volume controls for The Merchant of Venice — The Novel, with teal accents"></div>
            <figcaption class="screen-caption"><strong>Volume and chapter controls.</strong> The Novel on Apple Watch.</figcaption>
          </figure>
        </div>
      </section>

      <section class="reveal echo-section">
        <div class="story">
        <p class="eyebrow">Why Echo exists</p>
        <p class="story-lead">A lot of real listening happens in stolen, interrupted minutes: in and out of the car, an aux cable, an Apple Watch, a chapter cut short. No app would loop a single chapter until it stuck, stay ready on a watch after a long pause, or remember <em>why</em> a bookmark was made three stops ago.</p>
        <p class="story-body">So I built one: an app that treats audiobooks the way students treat textbooks. And if you're just here to listen? You never have to make a single flashcard.</p>
        </div>
      </section>

      <section class="reveal echo-section">
        <div class="section-head">
          <p class="eyebrow">Read-along is where most apps stop</p>
          <h2 class="section-title">Sync gets you to the page. Echo gets it into your head.</h2>
        </div>
        <ol class="ladder">
          <li class="ladder-row ladder-row-muted"><span class="ladder-num">01</span><p><strong>Chapter sync — table stakes.</strong> <span>Match your audiobook to your ebook chapter by chapter. A growing crowd of apps does this; Echo does too.</span></p></li>
          <li class="ladder-row"><span class="ladder-num">02</span><p><strong>Word-perfect read-along.</strong> <span>Echo follows the narrator word by word — true karaoke, aligned on-device to the real audio (WhisperKit + CoreML), not snapped to the nearest chapter.</span></p></li>
          <li class="ladder-row ladder-row-gold"><span class="ladder-num">03</span><p><strong>Turn it into memory.</strong> <span>One tap makes any passage a spaced-repetition flashcard with its audio snippet attached — reviewed on iPhone, Watch, and Mac until you own it.</span></p></li>
        </ol>
      </section>

      <section class="reveal echo-section">
        <div class="section-head">
          <p class="eyebrow">What Echo does</p>
          <h2 class="section-title">A serious study system, out of the way until you want it.</h2>
          <p class="section-lede">Everything below is in the current TestFlight beta unless marked — Echo is in open development toward 1.0.</p>
        </div>
        <div class="feature-grid">
          <div class="feature-card"><h3>Smart Rewind</h3><p>Hit play and Echo has already rewound — a little after a short pause, more after hours. Interruptions stop costing you context.</p></div>
          <div class="feature-card"><h3>Chapter Looping</h3><p>Repeat one chapter until you own it — the feature Echo was born for. Or loop the exact passage between two bookmarks.</p></div>
          <div class="feature-card"><h3>Built-in Spaced Repetition</h3><p>An Anki-style flashcard system with FSRS / FSRS-4.5 scheduling and the narrator's audio on the cards — daily review, hands-free on Apple Watch.</p></div>
          <div class="feature-card"><h3>Synced EPUB Reader</h3><p>Text scrolls with the narration. Tap a paragraph to jump the audio; search the book and leap to the spoken moment.</p></div>
          <div class="feature-card"><h3>Voice &amp; Photo Bookmarks</h3><p>Hold a button and speak your thought, or attach a photo of where you are — memos play back inline when the narration returns there.</p></div>
          <div class="feature-card"><h3>A Watch Remote You Design</h3><p>Up to 25 buttons across 5 pages, Digital Crown scrubbing, plus a Pomodoro focus timer on your wrist.</p></div>
          <div class="feature-card"><h3>Pitch-Corrected Speed</h3><p>Narrators sound human at 1.25× — zero pitch distortion, and every book remembers its own speed.</p></div>
          <div class="feature-card"><h3>Dyslexia-Friendly by Design</h3><p>Lexend and OpenDyslexic built in, Dynamic Type, VoiceOver labels. Designed for interrupted, neurodivergent attention first.</p></div>
          <div class="feature-card"><h3>Mark Now, Card Later</h3><p>One tap marks a passage without stopping the narration; the Card Inbox turns marks into flashcards when you have the bandwidth.</p></div>
          <div class="feature-card"><h3>Second-Brain Export</h3><p>One tap exports a book's bookmarks, notes, memos, photos, and flashcards as clean Markdown — straight into Obsidian, Logseq, or Notion.</p></div>
          <div class="feature-card"><h3>On-Device AI Narration</h3><p>Natural narration for text-only EPUBs, generated entirely on your device — no cloud, no API calls. Books never recorded can still be heard.</p></div>
          <div class="feature-card"><h3>Insights That Are Real</h3><p>Listening time, streaks, chapter coverage, retention curves — honest numbers from your actual listening, never from a server.</p></div>
        </div>
      </section>

      <section class="reveal echo-section echo-section-tight">
        <div class="principles-grid">
          <div class="principle-card"><h3>Radically private</h3><p>Core playback and reading need no Echo account. Optional connected services have separate data handling. <a href="/echo-privacy/">Read the Echo privacy policy.</a></p></div>
          <div class="principle-card"><h3>Open source</h3><p>GPL-3.0, public on GitHub — the whole app.</p></div>
          <div class="principle-card"><h3>No locked files</h3><p>Built around DRM-free files you own and can see.</p></div>
          <div class="principle-card"><h3>For Every Mind</h3><p>Designed for interrupted, neurodivergent attention first.</p></div>
          <div class="principle-card"><h3>Echo Pro, once</h3><p>Optional power features as a one-time unlock. No subscription.</p></div>
        </div>
      </section>

      <section class="reveal echo-section echo-section-last">
        <div class="band-dark echo-cta">
          <div class="glow-bottom"></div>
          <div class="echo-cta-inner">
            <h2 class="echo-cta-title">Echo is in open beta right now.</h2>
            <p class="echo-cta-lede">TestFlight builds for iPhone, iPad, Apple Watch, and Mac — guides, test plans, and a devlog included.</p>
            <div class="echo-cta-actions">
              <a class="btn btn-gold" href="https://testflight.apple.com/join/Zu9rzg59">Join the TestFlight beta</a>
              <a class="echo-source-link" href="/listen/">Listen in your browser</a>
            </div>
            <div class="echo-cta-links">
              <a class="echo-cta-link" href="/echo-manual">User manual</a>
              <a class="echo-cta-link" href="/echo-learn">Learning guide</a>
              <a class="echo-cta-link" href="/echo-focus">Focus Field Guide</a>
              <a class="echo-cta-link" href="/echo-beta">Beta guide</a>
              <a class="echo-cta-link" href="/echo-devlog">Devlog</a>
              <a class="echo-cta-link" href="/echo-help">Help &amp; support</a>
              <a class="echo-cta-link" href="/learn">Sample learning audiobooks</a>
            </div>
          </div>
        </div>
      </section>
    </main>
    """)
}
