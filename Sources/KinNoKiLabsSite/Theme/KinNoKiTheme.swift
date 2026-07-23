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
//     Echo detail, Services, About, Support. Their layout and copy are
//     final ("prototype wins"), so they are emitted with the prototype's
//     own inline styles for pixel-fidelity, using the production class
//     hooks (.btn, .app-card, .reveal, .eyebrow, .bento…) so hover /
//     reveal / theming still work. Marketing copy therefore lives in the
//     theme by design; article-like content stays in Content/*.md.
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
                siteHeader(active: "/"),
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
                .body(.class("page-section"), siteHeader(active: "/apps"), appsMain(), siteFooter())
            )
        case .posts:
            return HTML(
                .lang(context.site.language),
                siteHead(for: section, context: context, titleOverride: "Posts"),
                .body(.class("page-section"), siteHeader(active: "/posts"), postsListMain(section), siteFooter())
            )
        }
    }

    func makeItemHTML(for item: Item<Site>, context: PublishingContext<Site>) throws -> HTML {
        let isEcho = item.path.string == "apps/echo"
        let active = item.sectionID == .posts ? "/posts" : "/apps"
        return HTML(
            .lang(context.site.language),
            siteHead(for: item, context: context),
            .body(
                .class("page-item"),
                siteHeader(active: active),
                .if(item.sectionID == .apps,
                    isEcho ? echoDetailMain() : appItemMain(item),
                    else: postDetailMain(item)),
                siteFooter()
            )
        )
    }

    func makePageHTML(for page: Page, context: PublishingContext<Site>) throws -> HTML {
        let main: Node<HTML.BodyContext>
        let active: String
        let isTaxSale = page.path.string == "taxsale"
        let toolsHead = page.path.string == "tools" || page.path.string.hasPrefix("tools/")
        switch page.path.string {
        case "games":             main = gamesMain(page: "hub");         active = "/games"
        case "games/sudoku":      main = gamesMain(page: "sudoku");      active = "/games"
        case "games/crossword":   main = gamesMain(page: "crossword");   active = "/games"
        case "games/word-search": main = gamesMain(page: "word-search"); active = "/games"
        case "games/kinnoki-stack":
            main = gamesMain(page: "kinnoki-stack")
            active = "/games"
        case "games/kinnoki-yard":
            main = gamesMain(page: "kinnoki-yard")
            active = "/games"
        case "games/kinnoki-charts":
            main = gamesMain(page: "kinnoki-charts")
            active = "/games"
        case "tools":                main = toolsMain(page: "hub");            active = "/tools"
        case "tools/qr-code":        main = toolsMain(page: "qr-code");        active = "/tools"
        case "tools/epub-reader":    main = toolsMain(page: "epub-reader");    active = "/tools"
        case "tools/dilution":       main = toolsMain(page: "dilution");       active = "/tools"
        case "tools/contrast":       main = toolsMain(page: "contrast");       active = "/tools"
        case "tools/word-count":     main = toolsMain(page: "word-count");     active = "/tools"
        case "tools/unit-converter": main = toolsMain(page: "unit-converter"); active = "/tools"
        case "tools/passphrase":     main = toolsMain(page: "passphrase");     active = "/tools"
        case "services":          main = servicesMain();                  active = "/services"
        case "learn":             main = learnMain();                     active = ""
        case "taxsale":           main = taxSaleHubMain();                active = ""
        case "about":             main = aboutMain();                     active = "/about"
        case "support":           main = supportMain();                   active = ""
        default:                  main = proseMain(page);                  active = ""
        }
        return HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, toolsHead: toolsHead),
            .body(.class(isTaxSale ? "page-page page-tax-sale" : "page-page"), siteHeader(active: active), main, siteFooter())
        )
    }

    func makeTagListHTML(for page: TagListPage, context: PublishingContext<Site>) throws -> HTML? {
        HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, titleOverride: "Tags"),
            .body(
                .class("page-tags"),
                siteHeader(active: "/posts"),
                .main(
                    .class("site-main article-page"),
                    .p(.class("eyebrow"), .text("Tags")),
                    .h1(.style("font-weight:650;font-size:clamp(30px,4vw,42px);letter-spacing:-0.025em;margin:0 0 24px;"), .text("Everything, tagged.")),
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
                siteHeader(active: "/posts"),
                .main(
                    .class("site-main article-page"),
                    .p(.class("eyebrow"), .text("Tagged")),
                    .h1(.style("font-weight:650;font-size:clamp(30px,4vw,42px);letter-spacing:-0.025em;margin:0 0 28px;"), .text(page.tag.string)),
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
    toolsHead: Bool = false
) -> Node<HTML.DocumentContext> {
    let site = context.site
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
        .link(.attribute(named: "rel", value: "canonical"), .attribute(named: "href", value: url.absoluteString)),
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
        .stylesheet("/styles.css"),
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
        .meta(.attribute(named: "property", value: "og:url"), .attribute(named: "content", value: url.absoluteString)),
        .meta(.attribute(named: "property", value: "og:image"), .attribute(named: "content", value: imageURL.absoluteString)),
        .meta(.name("twitter:card"), .content("summary_large_image"))
    )
}

// MARK: - Shared header + mobile menu

private func siteHeader(active: String) -> Node<HTML.BodyContext> {
    .group(
        .header(
            .class("site-header"),
            .nav(
                .class("site-nav"),
                brandLink(),
                .div(
                    .style("display:flex;align-items:center;gap:18px;"),
                    .ul(
                        .class("nav-links"),
                        navLink("/", "Home", active),
                        navLink("/games", "Games", active),
                        navLink("/tools", "Tools", active),
                        navLink("/services", "Services", active),
                        navLink("/apps", "Apps", active),
                        navLink("/posts", "Posts", active),
                        navLink("/about", "About", active)
                    ),
                    .div(
                        .style("display:flex;align-items:center;gap:8px;"),
                        fontToggle("Aa"),
                        themeToggle()
                    ),
                    .button(
                        .class("nav-burger"),
                        .attribute(named: "type", value: "button"),
                        .attribute(named: "aria-label", value: "Open menu"),
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
        .img(.class("logo-on-dark"), .src("/images/brand/logo-mark.png"), .alt("")),
        .img(.class("logo-on-light"), .src("/images/brand/logo-mark-light.png"), .alt("")),
        .span(.text("KinNoKi Labs"))
    )
}

private func navLink(_ path: String, _ title: String, _ active: String) -> Node<HTML.ListContext> {
    if path == active {
        return .li(.a(.href(path), .attribute(named: "aria-current", value: "page"), .text(title)))
    }
    return .li(.a(.href(path), .text(title)))
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
        .div(
            .style("display:flex;align-items:center;justify-content:space-between;height:64px;padding:0 16px 0 clamp(16px,4vw,32px);"),
            .div(
                .style("display:flex;align-items:center;gap:11px;"),
                .img(.class("logo-on-dark"), .src("/images/brand/logo-mark.png"), .alt(""), .attribute(named: "style", value: "height:34px;width:34px;object-fit:contain;")),
                .img(.class("logo-on-light"), .src("/images/brand/logo-mark-light.png"), .alt(""), .attribute(named: "style", value: "height:34px;width:34px;object-fit:contain;")),
                .span(.style("font-weight:600;font-size:16.5px;letter-spacing:-0.01em;"), .text("KinNoKi Labs"))
            ),
            .button(
                .class("menu-close"),
                .attribute(named: "type", value: "button"),
                .attribute(named: "aria-label", value: "Close menu"),
                .style("height:44px;width:44px;display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:var(--text);cursor:pointer;"),
                iconClose()
            )
        ),
        .nav(
            mobileLink("/", "Home", active),
            mobileLink("/games", "Games", active),
            mobileLink("/tools", "Tools", active),
            mobileLink("/services", "Services", active),
            mobileLink("/apps", "Apps", active),
            mobileLink("/posts", "Posts", active),
            mobileLink("/about", "About", active),
            .button(
                .class("font-toggle"),
                .attribute(named: "type", value: "button"),
                .attribute(named: "aria-label", value: "Toggle OpenDyslexic font"),
                .attribute(named: "aria-pressed", value: "false"),
                .style("margin-top:24px;height:44px;padding:0 18px;align-self:flex-start;gap:8px;"),
                .text("Aa · OpenDyslexic")
            )
        )
    )
}

private func mobileLink(_ path: String, _ title: String, _ active: String) -> Node<HTML.BodyContext> {
    if path == active {
        return .a(
            .href(path),
            .attribute(named: "aria-current", value: "page"),
            .text(title),
            iconChevronDim()
        )
    }
    return .a(.href(path), .text(title), iconChevronDim())
}

// MARK: - Shared footer

private func siteFooter() -> Node<HTML.BodyContext> {
    .footer(
        .class("site-footer"),
        .div(
            .class("inner"),
            .div(
                .style("display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:28px;margin-bottom:32px;"),
                .div(
                    .style("display:flex;align-items:center;gap:12px;"),
                    .img(.class("logo-on-dark"), .src("/images/brand/logo-mark.png"), .alt(""), .attribute(named: "style", value: "height:40px;width:40px;object-fit:contain;")),
                    .img(.class("logo-on-light"), .src("/images/brand/logo-mark-light.png"), .alt(""), .attribute(named: "style", value: "height:40px;width:40px;object-fit:contain;")),
                    .div(
                        .p(.style("font-weight:600;font-size:15.5px;letter-spacing:-0.01em;margin:0;"), .text("KinNoKi Labs")),
                        .p(.style("font-size:13px;color:var(--text-muted);margin:0;"), .text("Building Tools That Make Sense."))
                    )
                ),
                .div(
                    .class("footer-links"),
                    .a(.href("/apps"), .text("Apps")),
                    .a(.href("/services"), .text("Services")),
                    .a(.href("/learn"), .text("Learn")),
                    .a(.href("/posts"), .text("Posts")),
                    .a(.href("/about"), .text("About")),
                    .a(.href("/privacy"), .text("Privacy")),
                    .a(.href("/support"), .text("Support")),
                    .raw(#"<a href="https://github.com/dfakkeldy" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>GitHub</a>"#),
                    .a(.href("mailto:hello@kinnokilabs.com"), .text("hello@kinnokilabs.com"))
                )
            ),
            .div(
                .class("footer-legal"),
                .raw(#"<p style="margin:0;">© 2026 KinNoKi Labs · Cape Breton, Nova Scotia · Generated with <a href="https://github.com/johnsundell/publish" target="_blank" rel="noopener">Publish</a></p>"#),
                .button(
                    .class("font-toggle"),
                    .attribute(named: "type", value: "button"),
                    .attribute(named: "aria-label", value: "Toggle OpenDyslexic font"),
                    .attribute(named: "aria-pressed", value: "false"),
                    .style("height:34px;padding:0 14px;gap:7px;"),
                    .text("Aa · OpenDyslexic")
                )
            )
        )
    )
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
        .p(
            .class("tool-privacy"),
            .text("Runs entirely in your browser. Nothing you enter leaves this device.")
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
                  <p class="tax-lede">One quick place for posted municipal dates, the live parcel map, and the public text and audio editions of <cite>Beyond the Tax-Sale Packet</cite>.</p>
                  <div class="tax-actions">
                    <a class="tax-button tax-button-solid" href="/apps/nsmarksthespot/map/">Open the live map <span aria-hidden="true">↗</span></a>
                    <a class="tax-button tax-button-line" href="#dates">See posted dates <span aria-hidden="true">↓</span></a>
                  </div>
                  <p class="tax-refreshed">Municipal notices re-checked July 23, 2026</p>
                </div>

                <aside class="tax-desk" aria-label="Current tax-sale desk summary">
                  <div class="tax-desk-label"><span>Current desk</span><span>NS / 2026</span></div>
                  <div class="tax-desk-date">
                    <span class="tax-desk-day">11</span>
                    <div><strong>August</strong><small>Inverness County · 9:30 a.m.</small></div>
                  </div>
                  <div class="tax-desk-rule"></div>
                  <p><strong>40</strong> advertised rows</p>
                  <p><strong>40</strong> active mapped PIDs</p>
                  <small>Counts reflect the current Inverness notice. Five withdrawn rows are retained as status evidence and excluded from current parcel mapping.</small>
                </aside>
              </div>
            </section>

            <section class="tax-section tax-dates-section" id="dates" aria-labelledby="tax-dates-heading">
              <div class="tax-wrap">
                <div class="tax-section-intro reveal">
                  <div>
                    <p class="tax-kicker">Posted dates</p>
                    <h2 id="tax-dates-heading">What is still<br><em>coming up.</em></h2>
                  </div>
                  <p>This is the current official notice tracked in the map—not a promise that every advertised property will still be offered. Always open the municipal source again before acting.</p>
                </div>

                <div class="tax-date-list">
                  <article class="tax-date-card reveal">
                    <div class="tax-date-calendar" aria-hidden="true"><span>AUG</span><strong>11</strong><small>2026</small></div>
                    <div class="tax-date-copy">
                      <p class="tax-status">Posted · Public auction</p>
                      <h3>Municipality of the County of Inverness</h3>
                      <p><strong>Tuesday, August 11 at 9:30 a.m.</strong><br>St. Peter’s Parish Hall, 260 Main Street, Port Hood</p>
                      <p class="tax-date-detail">40 advertised rows · 5 withdrawn rows · 40 active PIDs mapped</p>
                    </div>
                    <div class="tax-date-actions">
                      <a href="https://invernesscounty.ca/services/finance-taxation/tax-sales/">Official Inverness page <span aria-hidden="true">↗</span></a>
                      <a href="/apps/nsmarksthespot/map/">View mapped parcels <span aria-hidden="true">→</span></a>
                    </div>
                  </article>
                </div>

                <div class="tax-notice reveal" role="note">
                  <strong>Posted does not mean final.</strong>
                  <p>Owners may pay arrears, municipalities may revise or remove listings, and results are a separate record. Confirm the current list, terms, time, venue, and outcome with the municipality.</p>
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
                  <p class="tax-large-copy">Search an eight-digit PID or Nova Scotia civic address, open a mapped tax-sale parcel, and compare it with roads, water, aerial imagery, Crown land, and municipal context.</p>
                  <ul class="tax-facts">
                    <li><span>Mapped now</span><strong>Inverness County current notice</strong></li>
                    <li><span>Search</span><strong>PID, civic address, or visible parcel</strong></li>
                    <li><span>Privacy</span><strong>No owner names; no location upload</strong></li>
                    <li><span>Boundary</span><strong>Approximate context, never a legal survey</strong></li>
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
                    <p class="tax-kicker">Public EPUB + audiobook · available now</p>
                    <h2 id="tax-guide-heading"><em>Beyond the<br>Tax-Sale Packet</em></h2>
                    <p class="tax-large-copy">A thirteen-chapter guide to how Nova Scotia municipal tax sales work—and how to research carefully without mistaking a notice, assessment, or map for an answer.</p>
                    <div class="tax-actions tax-guide-actions">
                      <a class="tax-button tax-button-solid" href="/taxsale/beyond-the-tax-sale-packet.epub" download>Download the EPUB <span aria-hidden="true">↓</span></a>
                      <a class="tax-button tax-button-line" href="/listen/?book=beyond-the-tax-sale-packet">Listen in the Listening Room <span aria-hidden="true">→</span></a>
                    </div>
            <p class="tax-guide-meta">Text + audio · 13 chapters · 54 figures · 4:12:50 · educational information only</p>
                  </div>
                </div>

                <div class="tax-format-grid" aria-label="Guide formats and status">
                  <article class="tax-format-card reveal">
                    <p class="tax-format-number">01</p>
                    <p class="tax-status tax-status-active">Available now</p>
                    <h3>EPUB text edition</h3>
            <p>The complete public text, selected cover, 54 public-safe figures, source appendix, and careful boundary between screening evidence and unresolved questions.</p>
                    <a href="/taxsale/beyond-the-tax-sale-packet.epub" download>Download the EPUB <span aria-hidden="true">↓</span></a>
                    <a href="/tools/epub-reader/">Open the on-device reader <span aria-hidden="true">→</span></a>
                  </article>
                  <article class="tax-format-card reveal">
                    <p class="tax-format-number">02</p>
                    <p class="tax-status tax-status-active">Available now</p>
                    <h3>Audiobook</h3>
            <p>A creator-listened chaptered edition for the road, a walk, or the workbench, with synced text and figures in the Listening Room.</p>
            <p>This edition has passed package and audio checks. The creator completed the full listening review and approved this edition for publication.</p>
                    <a href="/listen/?book=beyond-the-tax-sale-packet">Open the Listening Room <span aria-hidden="true">→</span></a>
                  </article>
                  <article class="tax-format-card reveal">
                    <p class="tax-format-number">03</p>
                    <p class="tax-status">Planned · not public</p>
                    <h3>Video edition</h3>
                    <p>Maps, packet anatomy, and process diagrams paced to the same grounded narration. No finished public video is available yet.</p>
                  </article>
                </div>
                <a class="tax-text-link tax-development-link" href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/docs/nova-scotia-tax-sale-book">Open the public development packet and sources <span aria-hidden="true">↗</span></a>
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
                  <a href="https://cbrm.ns.ca/business/property-sales-management/tax-sales/"><span>Past event source</span><strong>CBRM tax-sales page</strong><b aria-hidden="true">↗</b></a>
                  <a href="https://invernesscounty.ca/services/finance-taxation/tax-sales/"><span>Current notice</span><strong>Inverness County tax-sales page</strong><b aria-hidden="true">↗</b></a>
                  <a href="https://www.novascotia.ca/sign-property-online"><span>Land records</span><strong>Nova Scotia Property Online</strong><b aria-hidden="true">↗</b></a>
                </div>
              </div>
            </section>

            <section class="tax-boundary" aria-labelledby="tax-boundary-heading">
              <div class="tax-wrap tax-boundary-grid reveal">
                <p class="tax-kicker">The useful boundary</p>
                <h2 id="tax-boundary-heading">A map can tell you <em>where.</em><br>It cannot tell you <em>whether.</em></h2>
                <div>
                  <p>Neither this hub, the map, nor the guide proves access, title, condition, value, possession, insurance, financing, environmental condition, or buildability.</p>
                  <p>Use these resources to ask better questions. Verify live details with the municipality and take unresolved legal, tax, title, survey, planning, or construction questions to the right qualified professional.</p>
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
                <p class="tax-fine-print">Educational information only—not legal, tax, investment, surveying, appraisal, environmental, planning, or construction advice.</p>
              </div>
            </section>
            """#
        )
    )
}

private func postsListMain(_ section: Section<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main"),
        .style("max-width:760px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(20px,5vw,32px) 24px;min-height:40vh;"),
        .p(.class("eyebrow"), .text("Posts")),
        .h1(.style("font-weight:650;font-size:clamp(34px,4.5vw,48px);line-height:1.08;letter-spacing:-0.025em;margin:0 0 32px;"), .text("Studio notes.")),
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
        .style("max-width:680px;"),
        .a(.class("back-link"), .href("/posts"), iconArrowBack(), .text("All posts")),
        .p(.class("post-kicker"), .style("color:var(--gold-text);margin-bottom:12px;"), .text(kicker(for: item))),
        .article(.class("prose prose-post"), item.body.node)
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
                .h1(.style("font-weight:650;font-size:clamp(30px,4vw,42px);letter-spacing:-0.02em;margin:0 0 8px;"), .text(item.title)),
                .unwrap(item.metadata.tagline) {
                    .p(.style("font-size:17px;font-weight:500;color:var(--gold-text);margin:0 0 12px;"), .text($0))
                },
                .div(
                    .style("display:flex;flex-wrap:wrap;align-items:center;gap:8px;"),
                    .unwrap(item.metadata.status) { .span(.class("status-chip"), .text($0)) },
                    .unwrap(item.metadata.platforms) { .span(.class("platforms"), .text($0)) }
                )
            )
        ),
        .article(.class("prose"), item.body.node)
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

private func proseMain(_ page: Page) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main article-page"),
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
    .raw(#"<svg class="icon-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>"#)
}

private func iconMoon<Ctx>() -> Node<Ctx> {
    .raw(#"<svg class="icon-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>"#)
}

private func iconMenu<Ctx>() -> Node<Ctx> {
    .raw(#"<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"></path><path d="M4 6h16"></path><path d="M4 18h16"></path></svg>"#)
}

private func iconClose<Ctx>() -> Node<Ctx> {
    .raw(#"<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>"#)
}

private func iconChevronDim<Ctx>() -> Node<Ctx> {
    .raw(#"<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.35;"><path d="m9 18 6-6-6-6"></path></svg>"#)
}

private func iconArrowBack<Ctx>() -> Node<Ctx> {
    .raw(#"<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(180deg);"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>"#)
}

// MARK: - Marketing bodies (copy-locked; recreated from the design prototype)

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
          <p class="eyebrow">Independent Apple-platform studio · Nova Scotia</p>
          <h1>Building Tools<br><span class="hero-metal">That Make Sense.</span></h1>
          <p class="hero-sub">Focused Apple-platform apps and practical software systems for messy real-world work — built by one person who lives inside the workflows they fix.</p>
          <div class="hero-ctas">
            <a class="btn btn-gray" href="/apps">Explore the apps</a>
            <a class="btn btn-gold" href="/services">Work with me</a>
          </div>
          <div class="proof-strip">
            <span>5 apps in development</span>
            <span class="dot" aria-hidden="true"></span>
            <span>4 in TestFlight beta</span>
            <span class="dot" aria-hidden="true"></span>
            <a class="link-quiet" href="https://github.com/dfakkeldy" target="_blank" rel="noopener">Open source on GitHub</a>
            <span class="dot" aria-hidden="true"></span>
            <span>Swift-first</span>
          </div>
        </div>
      </section>

      <section class="reveal" style="max-width:1120px;margin:0 auto;padding:clamp(40px,6vw,72px) clamp(16px,4vw,32px) 0;">
        <p class="eyebrow">Flagship app</p>
        <div class="bento bento-gold split-flagship">
          <div style="padding:clamp(28px,4.5vw,52px);display:flex;flex-direction:column;align-items:flex-start;min-width:0;">
            <img src="/images/apps/echo.png" alt="Echo app icon — an infinity symbol in silver and gold" style="width:84px;height:84px;border-radius:22.37%;box-shadow:0 2px 10px rgba(0,0,0,0.25);margin-bottom:22px;">
            <h2 style="font-weight:600;font-size:clamp(28px,3.4vw,38px);line-height:1.12;letter-spacing:-0.02em;margin:0 0 8px;">Echo</h2>
            <p style="font-size:16.5px;font-weight:500;color:var(--gold-text);margin:0 0 14px;">For Every Mind — turn listening into learning.</p>
            <p style="font-size:16px;color:var(--text-muted);margin:0 0 22px;text-wrap:pretty;">The audiobook player that helps you remember what you heard. Built on a mail route: 956 commits in nine weeks, for an AuDHD brain that learns in stolen, interrupted minutes.</p>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
              <div style="display:flex;align-items:baseline;gap:10px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:color-mix(in srgb, var(--gold-500) 75%, var(--text));flex:none;transform:translateY(2px);"><path d="M20 6 9 17l-5-5"></path></svg>
                <p style="margin:0;font-size:15px;"><strong style="font-weight:600;">Word-perfect read-along.</strong> <span style="color:var(--text-muted);">True karaoke, tuned on-device to the real audio.</span></p>
              </div>
              <div style="display:flex;align-items:baseline;gap:10px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:color-mix(in srgb, var(--gold-500) 75%, var(--text));flex:none;transform:translateY(2px);"><path d="M20 6 9 17l-5-5"></path></svg>
                <p style="margin:0;font-size:15px;"><strong style="font-weight:600;">One-tap flashcards.</strong> <span style="color:var(--text-muted);">Spaced repetition (SM-2) with the narrator's audio attached.</span></p>
              </div>
              <div style="display:flex;align-items:baseline;gap:10px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:color-mix(in srgb, var(--gold-500) 75%, var(--text));flex:none;transform:translateY(2px);"><path d="M20 6 9 17l-5-5"></path></svg>
                <p style="margin:0;font-size:15px;"><strong style="font-weight:600;">Smart Rewind.</strong> <span style="color:var(--text-muted);">Interruptions stop costing you context.</span></p>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:26px;">
              <span class="badge-pill">iPhone</span>
              <span class="badge-pill">Apple Watch</span>
              <span class="badge-pill">Mac</span>
              <span class="badge-pill">CarPlay</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px;">
              <a class="btn btn-gold btn-md" href="/apps/echo">Meet Echo</a>
              <a class="link-quiet" href="/echo-beta">Join the TestFlight beta</a>
              <a class="link-quiet" href="/learn">Sample learning audiobooks</a>
            </div>
          </div>
          <div style="position:relative;background:#0a0a0c;min-height:400px;overflow:hidden;">
            <div aria-hidden="true" style="position:absolute;inset:0;background:radial-gradient(ellipse 80% 62% at 50% 46%, rgba(201,162,75,0.17), transparent 74%);"></div>
            <div style="position:absolute;left:50%;transform:translateX(-50%);top:clamp(36px,5vw,56px);bottom:-80px;width:min(274px,76%);">
              <div style="height:100%;background:#050506;border:1px solid rgba(255,255,255,0.14);border-bottom:none;border-radius:44px 44px 0 0;padding:9px 9px 0;box-shadow:0 30px 80px rgba(0,0,0,0.55), 0 0 70px rgba(201,162,75,0.10);">
                <img src="/images/screenshots/echo/player-tinted.png" alt="Echo Now Playing screen — the player tinted from the book's cover art" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:35px 35px 0 0;display:block;">
              </div>
            </div>
            <div aria-hidden="true" style="position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06);pointer-events:none;"></div>
          </div>
        </div>
      </section>

      <section class="reveal" style="max-width:1120px;margin:0 auto;padding:clamp(48px,7vw,88px) clamp(16px,4vw,32px) 0;">
        <p class="eyebrow">Also in the lab</p>
        <div class="card-grid">
          <a class="app-card" href="https://dfakkeldy.github.io/MacroMark/" target="_blank" rel="noopener">
            <div class="app-icon" style="width:60px;height:60px;background:linear-gradient(180deg,#3d9bff,#1f7ae8);display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <img src="/images/apps/macromark.png" alt="MacroMark app icon" style="width:74%;height:74%;object-fit:contain;">
            </div>
            <h3>MacroMark</h3>
            <p>Apple Watch voice capture for people whose notes live in Markdown.</p>
            <div class="app-card-meta">
              <span class="status-chip neutral">In development</span>
              <span class="platforms">Watch · iPhone</span>
            </div>
          </a>
          <a class="app-card" href="/apps/nsmarksthespot/">
            <img class="app-icon" src="/images/apps/nsmarksthespot.svg" alt="NS Marks The Spot app icon">
            <h3>NS Marks The Spot</h3>
            <p>Historical Nova Scotia maps, lined up with the map in your hand.</p>
            <div class="app-card-meta">
              <span class="status-chip">TestFlight</span>
              <span class="platforms">iPhone</span>
            </div>
          </a>
          <a class="app-card" href="https://dfakkeldy.github.io/Routey/" target="_blank" rel="noopener">
            <img class="app-icon" src="/images/apps/routey.png" alt="Routey app icon — a route line connecting three stops">
            <h3>Routey</h3>
            <p>Offline-first route support for rural delivery workflows.</p>
            <div class="app-card-meta">
              <span class="status-chip">TestFlight</span>
              <span class="platforms">iPhone</span>
            </div>
          </a>
          <a class="app-card" href="https://dfakkeldy.github.io/VisualTimer/" target="_blank" rel="noopener">
            <img class="app-icon" src="/images/apps/turntimer.png" alt="Turn Timer app icon — an orange progress ring">
            <h3>Turn Timer</h3>
            <p>Visual rounds for countdowns, turns, routines, and reusable sequences.</p>
            <div class="app-card-meta">
              <span class="status-chip">TestFlight</span>
              <span class="platforms">iPhone</span>
            </div>
          </a>
        </div>
        <div style="display:flex;justify-content:center;margin-top:22px;">
          <a class="row-link" href="/apps">All apps, honestly statused <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></a>
        </div>
      </section>

      <section class="reveal" style="max-width:1120px;margin:0 auto;padding:clamp(48px,7vw,88px) clamp(16px,4vw,32px) 0;">
        <div class="bento-tint split-services" style="padding:clamp(28px,4.5vw,52px);">
          <div>
            <p class="eyebrow">Services</p>
            <h2 style="font-weight:600;font-size:clamp(26px,3.2vw,36px);line-height:1.15;letter-spacing:-0.02em;margin:0 0 14px;text-wrap:balance;">I also turn repeated paperwork into working systems.</h2>
            <p style="font-size:16px;color:var(--text-muted);margin:0 0 22px;max-width:56ch;text-wrap:pretty;">For small businesses drowning in quotes, job folders, forms, and supplier notes — small, reviewable software built around the workflow you already run.</p>
            <div style="display:flex;flex-direction:column;gap:9px;">
              <div style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:500;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:color-mix(in srgb, var(--gold-500) 75%, var(--text));flex:none;"><path d="m9 18 6-6-6-6"></path></svg>Workflow audits — a fixed diagnostic for one problem</div>
              <div style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:500;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:color-mix(in srgb, var(--gold-500) 75%, var(--text));flex:none;"><path d="m9 18 6-6-6-6"></path></svg>Single-workflow automation builds</div>
              <div style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:500;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:color-mix(in srgb, var(--gold-500) 75%, var(--text));flex:none;"><path d="m9 18 6-6-6-6"></path></svg>Reliable, source-linked company knowledge bases</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:14px;">
            <a class="btn btn-gold" href="/services">See services</a>
            <a class="row-link" href="mailto:hello@kinnokilabs.com"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>hello@kinnokilabs.com</a>
          </div>
        </div>
      </section>

      <section class="reveal" style="max-width:760px;margin:0 auto;padding:clamp(56px,8vw,104px) clamp(20px,5vw,32px);text-align:center;">
        <p style="font-size:clamp(19px,2.4vw,24px);font-weight:400;line-height:1.5;letter-spacing:-0.01em;margin:0 0 18px;text-wrap:balance;">Built between shifts on a rural mail route in Nova Scotia — bid rooms before that. <span style="color:var(--text-muted);">The tools exist because the work demanded them.</span></p>
        <a class="row-link" style="color:var(--gold-text);" href="/about">About the studio <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></a>
      </section>
    </main>
    """)
}

private func appsMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main" style="max-width:1120px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(16px,4vw,32px) 24px;">
      <p class="eyebrow">Apps</p>
      <h1 style="font-weight:650;font-size:clamp(34px,4.5vw,52px);line-height:1.08;letter-spacing:-0.025em;margin:0 0 14px;">Five apps, honestly statused.</h1>
      <p style="font-size:17px;color:var(--text-muted);max-width:62ch;margin:0 0 40px;text-wrap:pretty;">Four have TestFlight builds running; none are on the App Store yet. Getting them there — review prep, metadata, polish — is the current work. Every one is open source.</p>

      <a class="reveal echo-row" href="/apps/echo" style="background:var(--surface);border:1px solid color-mix(in srgb, var(--gold-500) 28%, var(--separator));border-radius:24px;padding:clamp(24px,3.5vw,40px);margin-bottom:14px;text-decoration:none;color:var(--text);">
        <img src="/images/apps/echo.png" alt="Echo app icon" style="width:96px;height:96px;border-radius:22.37%;box-shadow:0 2px 12px rgba(0,0,0,0.25);">
        <div style="min-width:0;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:6px;">
            <h2 style="font-weight:600;font-size:clamp(22px,2.6vw,28px);letter-spacing:-0.02em;margin:0;">Echo: Audiobook Study Player</h2>
            <span class="status-chip">TestFlight beta — open</span>
          </div>
          <p style="font-size:15.5px;color:var(--text-muted);margin:0 0 10px;text-wrap:pretty;">An audiobook player built for studying, not just listening. Word-perfect read-along, one-tap flashcards, Smart Rewind, and a Watch remote you design.</p>
          <span style="font-size:13px;color:var(--text-quaternary);">iPhone · Apple Watch · Mac · CarPlay · GPL-3.0</span>
        </div>
        <svg class="echo-row-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-quaternary);justify-self:end;"><path d="m9 18 6-6-6-6"></path></svg>
      </a>

      <div class="reveal card-grid">
        <a class="app-card" href="https://dfakkeldy.github.io/MacroMark/" target="_blank" rel="noopener">
          <div class="app-icon" style="width:60px;height:60px;background:linear-gradient(180deg,#3d9bff,#1f7ae8);display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
            <img src="/images/apps/macromark.png" alt="MacroMark app icon" style="width:74%;height:74%;object-fit:contain;">
          </div>
          <h3>MacroMark</h3>
          <p style="margin:0 0 8px;flex:none;">Tap your Watch complication, speak, lower your wrist — the note lands in today's Markdown file, ready for Obsidian or Logseq.</p>
          <p style="font-size:13.5px;">Verbal Macros turn speech into structure: say "Task" and get <span style="font-family:var(--font-mono);font-size:12.5px;background:var(--fill-2);border-radius:5px;padding:1px 6px;">- [ ]</span></p>
          <div class="app-card-meta">
            <span class="status-chip neutral">In development toward V1.0</span>
            <span class="platforms">Watch · iPhone</span>
          </div>
        </a>
        <a class="app-card" href="/apps/nsmarksthespot/">
          <img class="app-icon" src="/images/apps/nsmarksthespot.svg" alt="NS Marks The Spot app icon">
          <h3>NS Marks The Spot</h3>
          <p>Slide Nova Scotia's archival Fletcher maps over today's landscape — old roads, gold mines, and shorelines line up under your thumb. Offline-first tiles for places with weak signal.</p>
          <div class="app-card-meta">
            <span class="status-chip">TestFlight — v1.0 candidate</span>
            <span class="platforms">iPhone</span>
          </div>
        </a>
        <a class="app-card" href="https://dfakkeldy.github.io/Routey/" target="_blank" rel="noopener">
          <img class="app-icon" src="/images/apps/routey.png" alt="Routey app icon — a route line connecting three stops">
          <h3>Routey</h3>
          <p>Offline-first route support for rural mail carriers, built in my own delivery truck. OCR label scanning, a master route list, and a daily-run flow that survives dead zones.</p>
          <div class="app-card-meta">
            <span class="status-chip">Internal TestFlight</span>
            <span class="platforms">iPhone</span>
          </div>
        </a>
        <a class="app-card" href="https://dfakkeldy.github.io/VisualTimer/" target="_blank" rel="noopener">
          <img class="app-icon" src="/images/apps/turntimer.png" alt="Turn Timer app icon — an orange progress ring">
          <h3>Turn Timer</h3>
          <p>An Apple-native visual sequence timer — one-tap visual countdowns plus reusable sequences for game nights, routines, classrooms, and kitchens.</p>
          <div class="app-card-meta">
            <span class="status-chip">TestFlight</span>
            <span class="platforms">iPhone</span>
          </div>
        </a>
      </div>
      <p style="font-size:13.5px;color:var(--text-quaternary);margin:28px 0 0;">Cards lead to each app's public home. Source for everything is on <a class="link-quiet" href="https://github.com/dfakkeldy" target="_blank" rel="noopener">GitHub</a>.</p>
    </main>
    """)
}

private func servicesMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main" style="max-width:1120px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(16px,4vw,32px) 24px;">
      <p class="eyebrow">Services</p>
      <h1 style="font-weight:650;font-size:clamp(34px,4.5vw,52px);line-height:1.08;letter-spacing:-0.025em;margin:0 0 16px;max-width:20ch;text-wrap:balance;">Repeated operational work, turned into practical software.</h1>
      <p style="font-size:17px;color:var(--text-muted);max-width:66ch;margin:0 0 10px;text-wrap:pretty;">The work starts with the real workflow: the quotes, job folders, forms, emails, spreadsheets, supplier notes, and decisions that already keep your business moving.</p>
      <p style="font-size:17px;color:var(--text-muted);max-width:66ch;margin:0 0 44px;text-wrap:pretty;">I build small, reviewable systems around that work — so owners and operators can find what matters, reuse what already exists, and make better decisions with less scrambling.</p>

      <div class="reveal offer-grid">
        <div class="offer-card">
          <div class="offer-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg></div>
          <h2 style="font-weight:600;font-size:20px;letter-spacing:-0.015em;margin:0 0 8px;">Workflow Audits</h2>
          <p style="font-size:15px;line-height:1.6;color:var(--text-muted);margin:0 0 10px;">A fixed diagnostic for one operational problem. The output is a clear map of how the work happens today, where time or money leaks out, and what a first useful automation would look like.</p>
          <p style="font-size:14px;line-height:1.55;color:var(--text-muted);margin:0;"><strong style="color:var(--text);font-weight:600;">The recommendation can be no build.</strong> Some workflows need a better checklist or a cleaner source of truth before software is worth the cost.</p>
        </div>
        <div class="offer-card">
          <div class="offer-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg></div>
          <h2 style="font-weight:600;font-size:20px;letter-spacing:-0.015em;margin:0 0 8px;">Single-Workflow Automation Builds</h2>
          <p style="font-size:15px;line-height:1.6;color:var(--text-muted);margin:0 0 10px;">One narrow job at a time: a quote packet, a bid-room checklist, a reporting handoff, a release pipeline — a repeated process with a clear owner.</p>
          <p style="font-size:14px;line-height:1.55;color:var(--text-muted);margin:0;"><strong style="color:var(--text);font-weight:600;">Not a vague transformation project.</strong> A scoped tool that can be reviewed, approved, and improved while the business keeps running.</p>
        </div>
        <div class="offer-card">
          <div class="offer-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg></div>
          <h2 style="font-weight:600;font-size:20px;letter-spacing:-0.015em;margin:0 0 8px;">Reliable Company Knowledge Bases</h2>
          <p style="font-size:15px;line-height:1.6;color:var(--text-muted);margin:0 0 10px;">Your knowledge is already valuable — just scattered across old jobs, spreadsheets, emails, PDFs, and people's heads. I make it findable, reusable, and reviewable before important decisions.</p>
          <p style="font-size:14px;line-height:1.55;color:var(--text-muted);margin:0;"><strong style="color:var(--text);font-weight:600;">Reliable means source-linked.</strong> AI helps with search, extraction, and drafts — but the system shows where information came from, and high-stakes decisions stay with people.</p>
        </div>
      </div>

      <section class="reveal" style="margin-bottom:clamp(48px,7vw,72px);">
        <p class="eyebrow">Why it pays</p>
        <h2 style="font-weight:600;font-size:clamp(24px,3vw,32px);letter-spacing:-0.02em;margin:0 0 24px;max-width:24ch;text-wrap:balance;">Business memory makes money in practical ways.</h2>
        <div class="check-list">
          <div class="row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg><p style="margin:0;font-size:15px;"><strong style="font-weight:600;">Faster quoting</strong> <span style="color:var(--text-muted);">— old assumptions, prices, and supplier notes are easier to find for bid/no-bid calls.</span></p></div>
          <div class="row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg><p style="margin:0;font-size:15px;"><strong style="font-weight:600;">Fewer missed requirements</strong> <span style="color:var(--text-muted);">— forms, due dates, and compliance docs tied back to real jobs.</span></p></div>
          <div class="row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg><p style="margin:0;font-size:15px;"><strong style="font-weight:600;">Less owner bottleneck</strong> <span style="color:var(--text-muted);">— repeated decisions stop living only in one person's memory.</span></p></div>
          <div class="row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg><p style="margin:0;font-size:15px;"><strong style="font-weight:600;">Less rework</strong> <span style="color:var(--text-muted);">— the next job starts from reviewed prior knowledge, not a blank spreadsheet.</span></p></div>
          <div class="row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg><p style="margin:0;font-size:15px;"><strong style="font-weight:600;">Better delegation</strong> <span style="color:var(--text-muted);">— staff can see the company's preferred way to estimate, document, and close out work.</span></p></div>
          <div class="row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg><p style="margin:0;font-size:15px;"><strong style="font-weight:600;">Better follow-through</strong> <span style="color:var(--text-muted);">— schedules, safety paperwork, and closeout requirements stay connected after the win.</span></p></div>
        </div>
      </section>

      <section class="reveal" style="margin-bottom:clamp(48px,7vw,72px);">
        <p class="eyebrow">Workflows I take on</p>
        <div class="chip-row">
          <span class="chip">Estimate, quote &amp; bid-room support</span>
          <span class="chip">Lost-bid learning</span>
          <span class="chip">Compliance &amp; safety paperwork reuse</span>
          <span class="chip">Supplier, pricing &amp; old-job memory</span>
          <span class="chip">Document source-of-truth cleanup</span>
          <span class="chip">Apple-platform rescue &amp; release pipelines</span>
        </div>
      </section>

      <section class="reveal bento-tint split-services" style="padding:clamp(28px,4.5vw,52px);">
        <div>
          <h2 style="font-weight:600;font-size:clamp(24px,3vw,32px);letter-spacing:-0.02em;margin:0 0 20px;">How engagements start</h2>
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div class="step"><span class="num">01</span><p style="margin:0;font-size:15.5px;"><strong style="font-weight:600;">A paid diagnostic.</strong> <span style="color:var(--text-muted);">You and I pick one workflow, map the current reality, and identify the first useful improvement.</span></p></div>
            <div class="step"><span class="num">02</span><p style="margin:0;font-size:15.5px;"><strong style="font-weight:600;">Decide if a build is worth it.</strong> <span style="color:var(--text-muted);">If there's a clear return, the next step is a scoped first build — fixed pricing where possible.</span></p></div>
            <div class="step"><span class="num">03</span><p style="margin:0;font-size:15.5px;"><strong style="font-weight:600;">Keep humans in the loop.</strong> <span style="color:var(--text-muted);">Async-friendly work, and human review for decisions that carry real cost.</span></p></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:14px;">
          <p style="font-size:16px;font-weight:500;margin:0;">Want to talk through a workflow?</p>
          <a class="btn btn-gold" href="mailto:hello@kinnokilabs.com">hello@kinnokilabs.com</a>
          <p style="font-size:13.5px;color:var(--text-muted);margin:0;">Plain email. No call required.</p>
        </div>
      </section>
    </main>
    """)
}

private func aboutMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main" style="max-width:1120px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(16px,4vw,32px) 24px;">
      <div style="max-width:720px;">
        <p class="eyebrow">About</p>
        <h1 style="font-weight:650;font-size:clamp(34px,4.5vw,52px);line-height:1.08;letter-spacing:-0.025em;margin:0 0 16px;">A solo studio with dirt on its boots.</h1>
        <p style="font-size:17px;color:var(--text-muted);margin:0 0 10px;text-wrap:pretty;"><strong style="color:var(--text);font-weight:600;">KinNoKi Labs</strong> is one person building focused Apple-platform apps — iOS, macOS, and watchOS — and practical software systems for real-world workflows, from Cape Breton, Nova Scotia.</p>
        <p style="font-size:17px;color:var(--text-muted);margin:0 0 44px;text-wrap:pretty;">The same operator-first approach runs through everything: understand the real work, find the painful handoff, and build the smallest useful system around it.</p>
      </div>

      <div class="reveal about-grid">
        <div class="about-card">
          <h2 style="font-weight:600;font-size:17px;letter-spacing:-0.01em;margin:0 0 6px;">Swift-first</h2>
          <p style="font-size:14.5px;line-height:1.55;color:var(--text-muted);margin:0;">Swift across the stack, from apps to server-side tooling — even this site is generated by Swift.</p>
        </div>
        <div class="about-card">
          <h2 style="font-weight:600;font-size:17px;letter-spacing:-0.01em;margin:0 0 6px;">Pragmatic design</h2>
          <p style="font-size:14.5px;line-height:1.55;color:var(--text-muted);margin:0;">I don't chase trends. I build interfaces and workflows that feel obvious in daily use.</p>
        </div>
        <div class="about-card">
          <h2 style="font-weight:600;font-size:17px;letter-spacing:-0.01em;margin:0 0 6px;">Reviewable systems</h2>
          <p style="font-size:14.5px;line-height:1.55;color:var(--text-muted);margin:0;">Small systems that show where every answer came from — not black boxes — especially when decisions carry real cost.</p>
        </div>
        <div class="about-card">
          <h2 style="font-weight:600;font-size:17px;letter-spacing:-0.01em;margin:0 0 6px;">Open source</h2>
          <p style="font-size:14.5px;line-height:1.55;color:var(--text-muted);margin:0;">I share what I learn. The apps and several supporting tools are public on <a class="link-quiet" href="https://github.com/dfakkeldy" target="_blank" rel="noopener">GitHub</a>.</p>
        </div>
      </div>

      <section class="reveal" style="max-width:720px;margin-bottom:clamp(48px,7vw,72px);">
        <p class="eyebrow">Background</p>
        <p style="font-size:clamp(17px,2.1vw,19px);line-height:1.65;margin:0 0 16px;text-wrap:pretty;">Before KinNoKi Labs, I spent years in bid rooms — estimates, tender paperwork, and the documents that follow a job around. These days I deliver a rural mail route, which is where several of these apps were born.</p>
        <p style="font-size:clamp(17px,2.1vw,19px);line-height:1.65;color:var(--text-muted);margin:0;text-wrap:pretty;">That mix keeps the work honest. I know what it costs to quote work against a deadline with the numbers scattered across old jobs, and I know what a tool has to survive to earn its place on a busy day: spotty connectivity, repeated paperwork, and no patience for software that gets in the way.</p>
      </section>

      <section class="reveal contact-band">
        <p style="font-size:clamp(17px,2.2vw,20px);font-weight:500;margin:0;">Want to work together, or just say hello?</p>
        <a class="btn btn-gold" href="mailto:hello@kinnokilabs.com">hello@kinnokilabs.com</a>
      </section>
    </main>
    """)
}

private func supportMain() -> Node<HTML.BodyContext> {
    .raw("""
    <main class="site-main article-page" style="max-width:680px;min-height:40vh;">
      <p class="eyebrow">Support</p>
      <h1 style="font-weight:650;font-size:clamp(30px,4vw,42px);line-height:1.12;letter-spacing:-0.025em;margin:0 0 12px;">Stuck on something?</h1>
      <p style="font-size:16.5px;line-height:1.7;color:var(--text-muted);margin:0 0 28px;">Pick the app you need help with, or email for anything else.</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:28px;">
        <a class="support-row" href="/echo-help">Echo <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-quaternary);"><path d="m9 18 6-6-6-6"></path></svg></a>
        <a class="support-row" href="/macromark-help">MacroMark <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-quaternary);"><path d="m9 18 6-6-6-6"></path></svg></a>
        <a class="support-row" href="/nsmarksthespot-help">NS Marks The Spot <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-quaternary);"><path d="m9 18 6-6-6-6"></path></svg></a>
        <a class="support-row" href="/visualtimer-help">Turn Timer <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-quaternary);"><path d="m9 18 6-6-6-6"></path></svg></a>
      </div>
      <p style="font-size:16px;line-height:1.7;color:var(--text-muted);margin:0;">Routey has no help page yet — and for general inquiries, business opportunities, or feedback: <a class="link-quiet" href="mailto:hello@kinnokilabs.com">hello@kinnokilabs.com</a>.</p>
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
          <p class="learn-card-label">Flyer offer</p>
          <p>Send a topic you genuinely want to learn. If it is a good fit, I will make a short custom audiobook and invite you to test it in Echo.</p>
          <a class="row-link" href="mailto:learn@kinnokilabs.com">learn@kinnokilabs.com</a>
        </aside>
      </section>

      <section class="reveal learn-section">
        <div class="contact-band">
          <div style="max-width:46rem;">
            <p class="learn-card-label">Echo Listening Room</p>
            <p style="color:var(--text-muted);font-size:1rem;line-height:1.65;margin:0;">Stream a sample learning audiobook right here, with the same read-along captions Echo uses. No install, no signup.</p>
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
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/books/chicken-predators" target="_blank" rel="noopener">Book folder</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/raw/main/books/chicken-predators/chicken-predators.epub">EPUB</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/blob/main/books/chicken-predators/chicken-predators.md" target="_blank" rel="noopener">Read</a>
            </div>
          </article>

          <article class="learn-book-card">
            <img class="learn-book-cover" src="/learn/covers/the-new-deal.png" alt="Cover of The New Deal" width="1600" height="2560" loading="lazy" decoding="async">
            <div>
              <p class="learn-book-runtime">9 chapters · about 1.9 hours</p>
              <h3>The New Deal</h3>
              <p>A plain-language guide to the 2026 Canada Post and CUPW agreements, their restructuring context, and what the changes could mean for rural mail.</p>
            </div>
            <div class="learn-book-links">
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/books/the-new-deal" target="_blank" rel="noopener">Book folder</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/raw/main/books/the-new-deal/the-new-deal.epub">EPUB</a>
              <a href="https://github.com/dfakkeldy/explainer-audiobooks/blob/main/books/the-new-deal/the-new-deal.md" target="_blank" rel="noopener">Read</a>
            </div>
          </article>
        </div>

        <p class="learn-library-link"><a class="row-link" href="https://github.com/dfakkeldy/explainer-audiobooks" target="_blank" rel="noopener">Browse the public Explainer Audiobooks library</a></p>
      </section>

      <section class="reveal learn-section learn-request-grid">
        <div>
          <p class="eyebrow">Request a topic</p>
          <h2>Tell me what you want to learn.</h2>
          <p>Send me a topic, with as much detail as you want. If it's a good fit, I'll make a short custom audiobook and give you early access to Echo so you can test it.</p>
          <a class="btn btn-gold" href="mailto:learn@kinnokilabs.com">learn@kinnokilabs.com</a>
        </div>
        <div class="learn-request-list">
          <p>I can only make a limited number while testing.</p>
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
      <section class="band-dark" style="text-align:center;">
        <div class="glow-top"></div>
        <div style="position:relative;max-width:880px;margin:0 auto;padding:clamp(48px,7vw,88px) clamp(20px,5vw,32px) clamp(44px,6vw,72px);">
          <a class="echo-back" href="/apps"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(180deg);"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>All apps</a>
          <img src="/images/apps/echo.png" alt="Echo app icon — an infinity symbol in silver and gold" style="width:112px;height:112px;border-radius:22.37%;box-shadow:0 12px 44px rgba(201,162,75,0.28), 0 2px 10px rgba(0,0,0,0.5);display:block;margin:0 auto 26px;">
          <h1 style="font-weight:650;font-size:clamp(38px,5.5vw,64px);line-height:1.05;letter-spacing:-0.025em;margin:0 0 12px;color:#f5f5f7;">Echo</h1>
          <p style="font-size:clamp(17px,2.2vw,21px);font-weight:500;color:#dcc389;margin:0 0 16px;">For Every Mind — turn listening into learning.</p>
          <p style="font-size:16.5px;line-height:1.6;color:rgba(245,245,247,0.65);max-width:560px;margin:0 auto 28px;text-wrap:pretty;">The audiobook player that helps you remember what you heard — word-perfect read-along, one-tap flashcards, and a study system built on the real science of memory.</p>
          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-bottom:30px;">
            <span style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.6);border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:3px 11px;">iPhone</span>
            <span style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.6);border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:3px 11px;">Apple Watch</span>
            <span style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.6);border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:3px 11px;">Mac</span>
            <span style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.6);border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:3px 11px;">CarPlay</span>
            <span style="font-size:12px;font-weight:600;color:#dcc389;border:1px solid rgba(201,162,75,0.45);border-radius:999px;padding:3px 11px;">Open source · GPL-3.0</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:14px;">
            <a class="btn btn-gold" href="/echo-beta">Join the TestFlight beta</a>
            <a href="https://github.com/dfakkeldy/Echo" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;font-size:14.5px;font-weight:500;color:rgba(245,245,247,0.65);text-decoration:none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>View source</a>
          </div>
        </div>
      </section>

      <section class="reveal" style="max-width:1080px;margin:0 auto;padding:clamp(40px,6vw,64px) clamp(16px,4vw,32px) 0;">
        <div class="screens-grid">
          <figure style="margin:0;display:flex;flex-direction:column;gap:12px;">
            <div class="screen-frame"><img src="/images/screenshots/echo/player-dark.png" alt="Echo Now Playing screen with chapter scrubber and large transport controls"></div>
            <figcaption class="screen-caption"><strong>Now Playing.</strong> Chapter scrubbing, 30-second hops, and transport buttons you lay out yourself.</figcaption>
          </figure>
          <figure style="margin:clamp(0px,3vw,36px) 0 0;display:flex;flex-direction:column;gap:12px;">
            <div class="screen-frame"><img src="/images/screenshots/echo/player-tinted.png" alt="Echo Now Playing screen tinted orange from the cover of Emotional Design"></div>
            <figcaption class="screen-caption"><strong>Tints itself to your book.</strong> The whole player picks up the cover's color — here, <em>Emotional Design</em>.</figcaption>
          </figure>
          <figure style="margin:0;display:flex;flex-direction:column;gap:12px;">
            <div class="screen-frame"><img src="/images/screenshots/echo/reader.png" alt="Echo's synced reader following the narration paragraph by paragraph"></div>
            <figcaption class="screen-caption"><strong>Word-perfect read-along.</strong> The text follows the narrator; tap any paragraph to jump the audio.</figcaption>
          </figure>
        </div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(14px,2.5vw,26px);margin-top:clamp(20px,3.5vw,34px);">
          <figure style="margin:0;display:flex;flex-direction:column;gap:12px;width:min(238px,100%);">
            <div class="screen-frame watch-frame"><img src="/images/screenshots/echo/watch-dark.jpeg" alt="Echo's Apple Watch remote — play, skip, and bookmark from the wrist"></div>
            <figcaption class="screen-caption"><strong>On your wrist.</strong> The Watch remote stays ready to play, even after a long pause.</figcaption>
          </figure>
          <figure style="margin:0;display:flex;flex-direction:column;gap:12px;width:min(238px,100%);">
            <div class="screen-frame watch-frame"><img src="/images/screenshots/echo/watch-tinted.jpeg" alt="Echo's Apple Watch remote tinted from the cover of Emotional Design"></div>
            <figcaption class="screen-caption"><strong>Tinted there too.</strong> The wrist UI picks up your book's color as well.</figcaption>
          </figure>
        </div>
      </section>

      <section class="reveal" style="max-width:720px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(20px,5vw,32px) 0;">
        <p class="eyebrow">Built on a mail route</p>
        <p style="font-size:clamp(17px,2.1vw,19px);line-height:1.65;margin:0 0 16px;text-wrap:pretty;">I deliver mail — in and out of the car thirty times a shift, an aux cable, an Apple Watch, and an AuDHD brain that learns from non-fiction audiobooks in stolen, interrupted minutes. No app would loop a single chapter until it stuck, stay ready on a watch after a long pause, or remember <em>why</em> a bookmark was made three driveways ago.</p>
        <p style="font-size:clamp(17px,2.1vw,19px);line-height:1.65;color:var(--text-muted);margin:0;text-wrap:pretty;">So I built it: <strong style="color:var(--text);font-weight:600;">956 commits in nine weeks</strong>, nights and weekends around a full delivery route — an app that treats audiobooks the way students treat textbooks. And if you're just here to listen? You never have to make a single flashcard.</p>
      </section>

      <section class="reveal" style="max-width:880px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(20px,5vw,32px) 0;">
        <p class="eyebrow">Read-along is where most apps stop</p>
        <h2 style="font-weight:600;font-size:clamp(26px,3.2vw,36px);line-height:1.15;letter-spacing:-0.02em;margin:0 0 24px;text-wrap:balance;">Sync gets you to the page. Echo gets it into your head.</h2>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div class="ladder-row"><span class="ladder-num" style="color:var(--text-quaternary);">01</span><p style="margin:0;font-size:15.5px;"><strong style="font-weight:600;">Chapter sync — table stakes.</strong> <span style="color:var(--text-muted);">Match your audiobook to your ebook chapter by chapter. A growing crowd of apps does this; Echo does too.</span></p></div>
          <div class="ladder-row"><span class="ladder-num">02</span><p style="margin:0;font-size:15.5px;"><strong style="font-weight:600;">Word-perfect read-along.</strong> <span style="color:var(--text-muted);">Echo follows the narrator word by word — true karaoke, aligned on-device to the real audio (WhisperKit + CoreML), not snapped to the nearest chapter.</span></p></div>
          <div class="ladder-row ladder-row-gold"><span class="ladder-num">03</span><p style="margin:0;font-size:15.5px;"><strong style="font-weight:600;">Turn it into memory.</strong> <span style="color:var(--text-muted);">One tap makes any passage a spaced-repetition flashcard with its audio snippet attached — reviewed on iPhone, Watch, and Mac until you own it.</span></p></div>
        </div>
      </section>

      <section class="reveal" style="max-width:1120px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(16px,4vw,32px) 0;">
        <p class="eyebrow">What Echo does</p>
        <h2 style="font-weight:600;font-size:clamp(26px,3.2vw,36px);line-height:1.15;letter-spacing:-0.02em;margin:0 0 8px;">A serious study system, out of the way until you want it.</h2>
        <p style="font-size:15px;color:var(--text-muted);margin:0 0 28px;">Everything below is in the current TestFlight beta unless marked — Echo is in open development toward 1.0.</p>
        <div class="feature-grid">
          <div class="feature-card"><h3>Smart Rewind</h3><p>Hit play and Echo has already rewound — a little after a short pause, more after hours. Interruptions stop costing you context.</p></div>
          <div class="feature-card"><h3>Chapter Looping</h3><p>Repeat one chapter until you own it — the feature Echo was born for. Or loop the exact passage between two bookmarks.</p></div>
          <div class="feature-card"><h3>Built-in Spaced Repetition</h3><p>An Anki-style flashcard system (SM-2) with the narrator's audio on the cards — daily review, hands-free on Apple Watch.</p></div>
          <div class="feature-card"><h3>Synced EPUB Reader</h3><p>Text scrolls with the narration. Tap a paragraph to jump the audio; search the book and leap to the spoken moment.</p></div>
          <div class="feature-card"><h3>Voice &amp; Photo Bookmarks</h3><p>Hold a button and speak your thought, or attach a photo of where you are — memos play back inline when the narration returns there.</p></div>
          <div class="feature-card"><h3>A Watch Remote You Design</h3><p>Up to 25 buttons across 5 pages, Digital Crown scrubbing, plus a Pomodoro focus timer on your wrist.</p></div>
          <div class="feature-card"><h3>Built for CarPlay</h3><p>Full Now Playing plus a browseable library — with in-dash buttons to bookmark, record a memo, or mark a passage on the road.</p></div>
          <div class="feature-card"><h3>Pitch-Corrected Speed</h3><p>Narrators sound human at 1.25× — zero pitch distortion, and every book remembers its own speed.</p></div>
          <div class="feature-card"><h3>Dyslexia-Friendly by Design</h3><p>Lexend and OpenDyslexic built in, Dynamic Type, VoiceOver labels. Designed for interrupted, neurodivergent attention first.</p></div>
          <div class="feature-card feature-card-soon"><h3>Mark Now, Card Later <span class="soon-pill">Coming in 1.0</span></h3><p>One tap marks a passage without stopping the narration; the Card Inbox turns marks into flashcards when you have the bandwidth.</p></div>
          <div class="feature-card feature-card-soon"><h3>Second-Brain Export <span class="soon-pill">Coming in 1.0</span></h3><p>One tap exports a book's bookmarks, notes, memos, photos, and flashcards as clean Markdown — straight into Obsidian, Logseq, or Notion.</p></div>
          <div class="feature-card feature-card-soon"><h3>On-Device AI Narration <span class="soon-pill">Coming in 1.0</span></h3><p>Natural narration for text-only EPUBs, generated entirely on your device — no cloud, no API calls. Books never recorded can still be heard.</p></div>
        </div>
      </section>

      <section class="reveal" style="max-width:1120px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(16px,4vw,32px) 0;">
        <div class="principles-grid">
          <div class="principle-card"><h3>Radically private</h3><p>No accounts, no analytics, no tracking, no servers.</p></div>
          <div class="principle-card"><h3>Open source</h3><p>GPL-3.0, public on GitHub — the whole app.</p></div>
          <div class="principle-card"><h3>No locked files</h3><p>Built around DRM-free files you own and can see.</p></div>
          <div class="principle-card"><h3>For Every Mind</h3><p>Designed for interrupted, neurodivergent attention first.</p></div>
        </div>
      </section>

      <section class="reveal" style="max-width:880px;margin:0 auto;padding:clamp(48px,7vw,80px) clamp(20px,5vw,32px) 24px;">
        <div class="band-dark echo-cta">
          <div class="glow-bottom"></div>
          <div style="position:relative;">
            <h2 style="font-weight:600;font-size:clamp(24px,3vw,32px);letter-spacing:-0.02em;margin:0 0 10px;color:#f5f5f7;">Echo is in open beta right now.</h2>
            <p style="font-size:15.5px;color:rgba(245,245,247,0.6);margin:0 0 24px;">TestFlight builds for iPhone, Apple Watch, Mac, and CarPlay — guides, test plans, and a devlog included.</p>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px 24px;margin-bottom:28px;font-size:13.5px;">
              <a class="echo-cta-link" href="/echo-learn">Learning guide</a>
              <a class="echo-cta-link" href="/learn">Sample learning audiobooks</a>
              <a class="echo-cta-link" href="/echo-focus">Focus Field Guide</a>
              <a class="echo-cta-link" href="/echo-manual">User manual</a>
              <a class="echo-cta-link" href="/echo-devlog">Devlog</a>
              <a class="echo-cta-link" href="/echo-help">Help &amp; support</a>
            </div>
            <a class="btn btn-gold" href="/echo-beta">Join the TestFlight beta</a>
          </div>
        </div>
      </section>
    </main>
    """)
}
