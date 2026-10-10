# Shakespeare showcase: The Merchant of Venice

Approved visual design for the Shakespeare collection, desktop and phone. Production publication and release of pending assets remain separate approvals.

Approved bounded expansion: `/shakespeare` is the collection index with Merchant and Midsummer work cards. The existing Merchant playbill lives at `/shakespeare/merchant-of-venice`; `/shakespeare/a-midsummer-nights-dream` is an honest in-progress work page. Work pages link back to the collection and to one another. Collection cards state available formats and release status; Midsummer exposes no media, book, audiobook or public project-repo link. The original playbill design, shared shell, accessibility controls and release gates remain in force.

## 1. Existing patterns, briefly

The studio already has what this page needs: a dark black/gold shell, Lexend throughout, a 1120px column with 20px-radius surfaces, 50px actions, an adaptive gold focus ring, and a shared header and footer. The current Posts and Apps pages establish three reusable pieces: a one-column hero with eyebrow, title and intro; surface cards with a leading visual and trailing text; and long-form prose with generous margins. The gap is a pattern for a work that exists in several forms with different readiness. This proposal extends hero, card and prose rather than inventing a dashboard: one new composite pattern, the **edition block**, and one new state, **pending**, expressed as calm status text instead of disabled buttons.

## 2. Direction: a playbill

The page reads top to bottom like a programme for one production. Sections are numbered as acts in a small gold eyebrow (I · Watch, II · Listen, III · Read), with Sources and Code as unnumbered end matter. Hairline rules in surface-2 separate sections like ledger lines, a quiet nod to the bond. Original motifs only: a Venetian pointed arch over canal ripples in the hero, a storyboard film panel with a bridge and moon for Watch, three small caskets on the album concept, and typographic covers for Read. No anime characters, no final art, no counterfeit thumbnails. Gold is used for eyebrows, status markers, rules and the primary listening action. Other text stays neutral so Listen on Suno is unmistakable; source, code and same-page links remain available.

The existing shared header and footer remain the production shell. The original mockups use a simplified concept mark and footer to illustrate the Merchant composition; they do not replace the current brand assets, footer copy or existing links. The Merchant hero eyebrow reads “Shakespeare · A KinNoKi Labs collection”. The collection index uses the same typography, gold accents, surface cards and focus styling; it introduces two work cards without inventing Midsummer artwork or public assets.

## 3. Page structure and exact copy

**Header (unchanged).** Tree mark and wordmark, Home · Games · Tools · Services · Apps · Posts · About, OpenDyslexic and theme controls, burger on phone.

**Introduction.** Two columns on desktop (text 640px, illustration panel 440px); stacked on phone with the panel under the byline.
- Eyebrow: “SHAKESPEARE · A KINNOKI LABS COLLECTION”
- H1: “The Merchant of Venice”
- Byline: “by William Shakespeare”
- Intro: “Original songs, an anime music video in production, and modern-English editions of the play, made in the studio and gathered here as they are ready.”
- In-page index on a gold ledger rule: “I Watch · II Listen · III Read · Sources · Code”. These are same-page anchor links, not pills.

**I · Watch.** Text left, film panel right (540×304 on desktop, full width 16:9 on phone). The panel is a concept illustration, never an empty player.
- H2: “Word Is Bond”
- Body: “An anime music video told from Shylock's side.”
- Status: “Video in production”
- Support text: “The film will appear here when it is released, with captions and a direct YouTube link.”
- Panel caption: “Concept illustration · Video in production”

**II · Listen.** One live card: album concept square left, text and action right.
- H2: “Merchants of Venice”
- Byline: “An album by Dan”
- Body: “Fourteen original songs after Shakespeare, plus two bonus tracks.”
- Meta: “16 songs · Bonus tracks “Word Is Bond” and “The Bond””
- Primary action: “Listen on Suno ↗” linking to the playlist, opening in a new tab, with helper text “Opens suno.com in a new tab”.
- Concept label: “Album art concept”. No download, mirror or export language anywhere.

**III · Read.** Intro line: “Two modern-English editions, each as an EPUB and a chaptered M4B audiobook.” Two edition blocks side by side on desktop, stacked on phone. Each block: typographic cover concept (2:3), title, metadata, formats, status.
- “Modern-English play” · “20 chapters · about 2h 19m audio” · “EPUB and chaptered M4B audiobook” · “Release pending”
- “Modern-English novel” · “20 chapters · about 2h 06m audio” · “EPUB and chaptered M4B audiobook” · “Release pending”
- Support text: “Files, sizes and durations are listed here when the edition is released.”
- Cover label: “Cover concept”.

**Sources.** Two columns: links and credits left, a note panel right.
- “Source text — MIT Shakespeare, full text ↗” (shakespeare.mit.edu)
- “Reading reference — Folger Shakespeare Library ↗” (folger.edu)
- Credits: “Modern adaptation prepared with Codex for Dan Fakkeldy. Character narration is synthetic, voiced with Echo and Kokoro. Cover art is generated.”
- Rights: “Shakespeare's text is in the public domain. The licence for these new editions is still being settled.”
- Note panel, titled “A note on the play”: “The Merchant of Venice stages antisemitic prejudice and a coerced conversion. These editions keep that material in view rather than soften it. The attitudes of its characters belong to the characters, not to the studio.” No Folger editorial text is reused.

**Code.** A three-row list with hairlines.
- “Website source ↗” · KinNoKiLabsSite on GitHub
- “Production methods ↗” · explainer-audiobooks on GitHub
- “Merchant project code” · “Publication pending” (static text, no link)

**Footer:** retain the current shared footer. The proposed additional “Shakespeare” link is marked for approval in the mockup.

## 4. Availability states

| Area | Now | Future approved state |
|---|---|---|
| Watch | Concept panel, “Video in production”, no play affordance, no URL | Responsive 16:9 YouTube embed in the same panel, accessible title, captions on, no autoplay, plus a “Watch on YouTube ↗” text link |
| Listen | Live: one external action | Unchanged; additional platforms would be added as further text links, not pills |
| Read | “Release pending” status text, typographic covers | Approved covers replace concepts; each block gains two labelled actions, “Download EPUB (size)” and “Download M4B audiobook (size · duration)”, linked to the verified public package; M4B downloads use GitHub Release assets because they exceed the 25 MiB Pages limit |
| Code | “Publication pending” static text | Third row becomes “Merchant project ↗” |

Status text is a 5px gold dot plus 15px semibold label. Pending states never render disabled buttons, placeholders with play triangles, or countdowns.

## 5. Tokens

Reuse the existing palette, type and shape tokens. The following muted-text changes are proposed for this page only unless a broader change is separately approved. Dark: bg #000000, surface #1c1c1e, surface-2 #2c2c2e, text #f5f5f7, secondary text #d1d1d6, muted strengthened to #a1a1a6 (6.6:1 on surface), gold text #f1d596, gold rules #c9a24b at 60%. Light: bg #f5f5f7, surface #ffffff, surface-2 #f0f0f2, text #1d1d1f, secondary #3a3a3f, muted #5f5f66, gold text and status #7a5d2a (6.1:1 on white), decorative gold strokes #c9a24b. Primary action: fill #f1d596, label #1d1d1f, 1px gradient hairline. Hover retains that solid fill and text colour; emphasis comes from the border or focus treatment, preserving contrast in every state. The gradient alone is avoided as a button fill because its darkest stop reaches only about 4.1:1 against #1d1d1f at 17px. Focus: 2px outline, 3px offset, #f1d596 dark / #7a5d2a light. Radii: 20px cards, 12px actions, 8px covers. Type: H1 52/58 desktop, 36/42 phone; H2 32/38 and 26/32; H3 24/30 and 20/26; body 18/28 and 17/26; small 15/22; eyebrow 13 uppercase, 0.14em tracking. Decorative cover and panel labels stay at 11px minimum and carry no unique information.

## 6. Accessibility and motion

Headings follow one H1 then H2 per section; the in-page index is a `nav` labelled “On this page” with same-page links. The film panel is an `img`-role illustration with alt “Concept illustration: a Venetian bridge over water at night; video in production”. Status text is live text, announced in reading order, not an aria-disabled control. External links say “opens in a new tab” to assistive tech. All primary actions are at least 50px tall on desktop and 44px on phone. Header controls, same-page index links and footer links also need at least 44×44px touch regions with sufficient spacing; do not infer interactive target size from the static SVG text bounds. Typography uses the shared font stack so the OpenDyslexic control switches every heading, label and cover concept; no separate display font. Reduced motion: omit hover movement and the future embed poster fade; nothing on the page animates by default. Future video: captions required, no autoplay, keyboard focus moves into the player only on activation. Colour is never the sole status indicator; the word is always present.

## 7. Assets and credits

The hero arch, film panel, album concept and typographic covers are original vector design concepts. Their production use needs an approved artwork choice. This design pass supplies no production page and introduces no new site font or raster dependency. Final covers and video stills are not imported until accepted. Credits live in Sources as above; the Suno link is the only outbound media action.

## 8. Decisions needing human approval

1. Add a modest “Shakespeare” link to the footer, or rely on Posts and search.
2. Keep the act numerals (I, II, III) or use plain section names.
3. Accept the muted-text strengthening to #a1a1a6 scoped to this page; any site-wide change is a separate decision.
4. Confirm the wording of the note on the play.
5. Confirm whether the album concept square should appear at all, or the card should be text-only until artwork is cleared.
