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
    }

    // Update these properties to configure your website:
    var url = URL(string: "https://kinnokilabs.com")!
    var name = "KinNoKi Labs"
    var description = "We build focused Apple-platform apps and practical software systems for messy real-world work."
    var language: Language { .english }
    var imagePath: Path? { nil }
}

// Generate using our custom theme with sticky navigation and modern CSS:
try KinNoKiLabsSite().publish(withTheme: .kinNoKi)
