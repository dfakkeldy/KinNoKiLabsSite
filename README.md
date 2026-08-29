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
