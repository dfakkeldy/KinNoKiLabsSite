import Foundation
import Publish
import Plot

// This type acts as the configuration for your website.
struct KinNoKiLabsSite: Website {
    enum SectionID: String, WebsiteSectionID {
        // Add the sections that you want your website to contain here:
        case posts
    }

    struct ItemMetadata: WebsiteItemMetadata {
        // Add any site-specific metadata that you want to use here.
    }

    // Update these properties to configure your website:
    var url = URL(string: "https://kinnokilabs.com")!
    var name = "KinNoKi Labs"
    var description = "We build native applications for Apple platforms with an emphasis on clarity, performance, and craftsmanship."
    var language: Language { .english }
    var imagePath: Path? { nil }
}

// Generate using our custom theme with sticky navigation and modern CSS:
try KinNoKiLabsSite().publish(withTheme: .kinNoKi)