import Foundation
import Publish
import Plot

// MARK: - KinNoKi Theme

extension Theme where Site == KinNoKiLabsSite {

    /// Custom theme with sticky navigation bar and modern CSS.
    /// Replaces the built-in `.foundation` theme.
    static var kinNoKi: Self {
        Theme(
            htmlFactory: KinNoKiHTMLFactory()
        )
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
                siteHeader(context: context),
                siteMain(index.body.node),
                siteFooter(context: context)
            )
        )
    }

    func makeSectionHTML(for section: Section<Site>, context: PublishingContext<Site>) throws -> HTML {
        HTML(
            .lang(context.site.language),
            siteHead(for: section, context: context),
            .body(
                .class("page-section"),
                siteHeader(context: context),
                siteMain(
                    .h1(.text(section.title)),
                    .element(named: "ul", nodes: [
                        .class("post-list"),
                        .forEach(section.items) { item in
                            .element(named: "li", nodes: [
                                .class("post-item"),
                                .span(.class("post-date"), .text(formattedDate(item.date))),
                                .a(.href(item.path), .text(item.title)),
                                .unwrap(item.description) { desc in
                                    .p(.class("post-description"), .text(desc))
                                }
                            ])
                        }
                    ])
                ),
                siteFooter(context: context)
            )
        )
    }

    func makeItemHTML(for item: Item<Site>, context: PublishingContext<Site>) throws -> HTML {
        HTML(
            .lang(context.site.language),
            siteHead(for: item, context: context),
            .body(
                .class("page-item"),
                siteHeader(context: context),
                siteMain(
                    // The Markdown body keeps its own leading `# heading`, so the theme
                    // must not inject a second <h1>. Dates only make sense for posts.
                    .if(item.sectionID == .posts, .p(.class("post-date"), .text(formattedDate(item.date)))),
                    .unwrap(item.tags.nonEmpty) { tags in
                        .p(.forEach(tags) { tag in
                            .span(.class("tag"), .text(tag.string))
                        })
                    },
                    item.body.node
                ),
                siteFooter(context: context)
            )
        )
    }

    func makePageHTML(for page: Page, context: PublishingContext<Site>) throws -> HTML {
        HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context),
            .body(
                .class("page-page"),
                siteHeader(context: context),
                siteMain(page.body.node),
                siteFooter(context: context)
            )
        )
    }

    func makeTagListHTML(for page: TagListPage, context: PublishingContext<Site>) throws -> HTML? {
        HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, titleOverride: "Tags"),
            .body(
                .class("page-tags"),
                siteHeader(context: context),
                siteMain(
                    .h1(.text("Tags")),
                    .element(named: "ul", nodes: [
                        .class("post-list"),
                        .forEach(page.tags.sorted()) { tag in
                            .element(named: "li", nodes: [
                                .class("post-item"),
                                .a(
                                    .href(context.site.path(for: tag)),
                                    .text(tag.string)
                                )
                            ])
                        }
                    ])
                ),
                siteFooter(context: context)
            )
        )
    }

    func makeTagDetailsHTML(for page: TagDetailsPage, context: PublishingContext<Site>) throws -> HTML? {
        let taggedItems = context.items(
            taggedWith: page.tag,
            sortedBy: \.date,
            order: .descending
        )
        return HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, titleOverride: page.tag.string),
            .body(
                .class("page-tag-detail"),
                siteHeader(context: context),
                siteMain(
                    .h1(.text("Tagged: \(page.tag.string)")),
                    .element(named: "ul", nodes: [
                        .class("post-list"),
                        .forEach(taggedItems) { item in
                            .element(named: "li", nodes: [
                                .class("post-item"),
                                .a(.href(item.path), .text(item.title))
                            ])
                        }
                    ])
                ),
                siteFooter(context: context)
            )
        )
    }
}

// MARK: - Shared <head>

private func siteHead<L: Location>(
    for location: L,
    context: PublishingContext<KinNoKiLabsSite>,
    titleOverride: String? = nil
) -> Node<HTML.DocumentContext> {
    let site = context.site
    let isIndex = location.path.string.isEmpty
    let baseTitle = titleOverride ?? location.title
    let pageTitle = isIndex ? site.name : "\(baseTitle) — \(site.name)"
    let description = location.description.isEmpty ? site.description : location.description
    let url = site.url(for: location.path)
    let imageURL = site.url(for: location.imagePath ?? Path("/logo.png"))

    return .head(
        .meta(.charset(.utf8)),
        .meta(.name("viewport"), .content("width=device-width, initial-scale=1")),
        // Plain `<title>` element — Plot's `.title(_:)` head-component helper also
        // injects `twitter:title`/`og:title` metas, which would duplicate the
        // explicit `og:title` meta below.
        .element(named: "title", text: pageTitle),
        .meta(.name("description"), .content(description)),
        .link(.attribute(named: "rel", value: "canonical"), .attribute(named: "href", value: url.absoluteString)),
        .link(.attribute(named: "rel", value: "icon"), .attribute(named: "href", value: "/logo.png")),
        .stylesheet("/styles.css"),
        .meta(.attribute(named: "property", value: "og:site_name"), .attribute(named: "content", value: site.name)),
        .meta(.attribute(named: "property", value: "og:title"), .attribute(named: "content", value: pageTitle)),
        .meta(.attribute(named: "property", value: "og:description"), .attribute(named: "content", value: description)),
        .meta(.attribute(named: "property", value: "og:type"), .attribute(named: "content", value: "website")),
        .meta(.attribute(named: "property", value: "og:url"), .attribute(named: "content", value: url.absoluteString)),
        .meta(.attribute(named: "property", value: "og:image"), .attribute(named: "content", value: imageURL.absoluteString)),
        .meta(.name("twitter:card"), .content("summary"))
    )
}

// MARK: - Shared Layout Components

private func siteHeader<Site: Website>(context: PublishingContext<Site>) -> Node<HTML.BodyContext> {
    .header(
        .class("site-header"),
        .element(named: "nav", nodes: [
            .class("site-nav"),
            .a(.class("nav-brand"), .href("/"), 
               .img(.src("/logo.png"), .alt(context.site.name)),
               .text(context.site.name)
            ),
            .element(named: "ul", nodes: [
                .class("nav-links"),
                navLink("/", "Home"),
                navLink("/services", "Services"),
                navLink("/apps", "Apps"),
                navLink("/posts", "Posts"),
                navLink("/about", "About"),
                .li(
                    .button(
                        .class("font-toggle"),
                        .attribute(named: "onclick", value: "document.body.classList.toggle('font-opendyslexic')"),
                        .text("OpenDyslexic")
                    )
                )
            ])
        ])
    )
}

private func siteMain(_ nodes: Node<HTML.BodyContext>...) -> Node<HTML.BodyContext> {
    .main(.class("site-main"), .div(.class("bento-box"), .group(nodes)))
}

private func siteMain(_ nodes: [Node<HTML.BodyContext>]) -> Node<HTML.BodyContext> {
    .main(.class("site-main"), .div(.class("bento-box"), .group(nodes)))
}

private func siteFooter<Site: Website>(context: PublishingContext<Site>) -> Node<HTML.BodyContext> {
    .footer(
        .class("site-footer"),
        .div(
            .class("footer-links"),
            .a(.href("/privacy"), .text("Privacy Policy")),
            .a(.href("/support"), .text("Support"))
        ),
        .p(
            .text("© \(currentYear) \(context.site.name). Generated with "),
            .a(.href("https://github.com/johnsundell/publish"), .text("Publish")),
            .text(".")
        )
    )
}

private func navLink(_ path: String, _ title: String) -> Node<HTML.ListContext> {
    .li(.a(.href(path), .text(title)))
}

// MARK: - Helpers

private func formattedDate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateStyle = .long
    formatter.timeStyle = .none
    return formatter.string(from: date)
}

private var currentYear: String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy"
    return formatter.string(from: Date())
}

private extension Array {
    var nonEmpty: Self? { isEmpty ? nil : self }
}
