# KinNoKi Labs Site

Public site for [KinNoKi Labs](https://kinnokilabs.com).

## Source vs generated output

- `Content/` is the Markdown source [Publish](https://github.com/johnsundell/publish) reads.
- `Sources/KinNoKiLabsSite/` is the Swift theme and pipeline. Copy-locked marketing pages (home, `/apps`, `/apps/echo`, `/services`, `/about`, `/support`) are theme-rendered.
- `Resources/` static assets copy into the output root.
- `Output/` is generated. Do not hand-edit it. Cloudflare Pages serves the committed `Output/` folder.

```bash
make generate   # rebuild Output/ deterministically
make preview    # generate and serve locally
make test       # JavaScript suites (some route tests need a generated Output/)
```

## Narrated Shakespeare editions

The two Merchant editions in `/fiction/` use the accepted public first-listen
packages from `explainer-audiobooks` at commit
`4bf38dd2b67ffb205344e4331b6dd78fc2668fb1`. Re-stage either with:

```bash
BOOKS_REF=4bf38dd2b67ffb205344e4331b6dd78fc2668fb1 node Tools/stage-fiction-book.mjs merchant-of-venice-play
BOOKS_REF=4bf38dd2b67ffb205344e4331b6dd78fc2668fb1 node Tools/stage-fiction-book.mjs merchant-of-venice-novel
```

The command checks the publication receipt, source artifact hashes, release M4B
hash, chapter windows, and every narration anchor before writing. It preserves
the original cover and alignment bytes and derives blocks from the EPUB. The
play's chapter headings use Roman act numbers while the accepted recording
speaks Arabic numbers; only that one-to-one heading spelling is allowed by
`Tools/fiction-publication.mjs`. Text, cover, and recording retain their separate
notices, linked from each book's folder. These editions remain first listens
with human reading and listening review pending.

## License

The site's source code is released under the [MIT License](LICENSE). Written
content, images and other media are all rights reserved unless marked
otherwise. Third-party material keeps its own licence. See [LICENSE](LICENSE)
for exactly what is covered.
