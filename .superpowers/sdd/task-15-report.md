# Task 15 Report — EPUB XML and package layer

## Status

DONE — implementation and hardening complete; committed locally for parent
integration, with no push.

## Implementation

- Added `Resources/tools/epub-xml.js`, a zero-dependency metadata XML parser.
  It preserves qualified element and attribute names, decodes the five XML named
  entities plus decimal/hex numeric references, retains CDATA as literal text,
  and exposes depth-first local-name lookup helpers.
- The parser fails closed with `bad-xml` for malformed structure, attributes,
  entities, literal XML characters, declarations, and processing instructions.
  It enforces these metadata limits before work can grow without bound:
  1,048,576 UTF-16 input units, 65,536 DOCTYPE units, 128 element levels,
  10,000 elements, and 262,144 decoded text units.
- Element `.text` remains the public aggregate-text contract, but is now a lazy
  accessor over each node's ordered direct content. Descendant aggregates are
  not copied onto every ancestor during parsing.
- Standard bounded DOCTYPE declarations, including PUBLIC/SYSTEM external IDs
  and internal subsets, are syntax-checked and skipped. No external subset is
  fetched and no declared entity is resolved; use of an internal entity still
  fails as an unknown entity.
- Added `Resources/tools/epub-package.js` for secure ZIP-relative paths,
  `container.xml`, EPUB 2/3 OPF metadata, manifest/spine, cover/nav/NCX lookup,
  and nav/NCX TOCs. Metadata and TOC selection resolve namespace URI bindings,
  preventing forged `evil:title`, `evil:creator`, or `evil:type="toc"` nodes.
- `parsePackage` requires direct OPF manifest and spine children plus at least
  one usable unique spine reference. Manifest IDs are deterministic first-wins;
  repeated spine `idref`s keep their first occurrence; missing/unresolvable
  references reject the package as `bad-package`.
- EPUB 3 TOC parsing requires a genuine EPUB-namespace `type="toc"` marker and
  returns `[]` for landmarks/page-list-only navigation, allowing the reader to
  use its NCX fallback. V1 intentionally strips URL fragments and query parts,
  landing at chapter top.

## Documented design deviation

The approved design described `DOMParser` for metadata XML. Per the Task 15 plan
refinement, `container.xml`, OPF, XHTML nav metadata, and NCX use this in-repo
mini-parser so the package engine behaves identically in Node tests and the
browser. Chapter XHTML remains a `DOMParser` responsibility in Task 17.

## TDD evidence

### Initial implementation RED/GREEN

- XML tests first failed with `ERR_MODULE_NOT_FOUND`; after the initial parser,
  the document-order assertion failed with
  `onefivetwofourthree` versus `onetwothreefourfive`, proving the nested-text
  regression before correction.
- Package tests first failed with `ERR_MODULE_NOT_FOUND`.
- Initial focused verification passed 18 tests; the then-current full
  `make test-tools` suite passed 182 tests.

### Comprehensive hardening RED

Regression tests were added before hardening production code:

```sh
node --test Tests/tools/epub-xml.test.mjs Tests/tools/epub-package.test.mjs
```

RED — 16 passed, 10 failed for the expected old behavior: eager aggregate text,
missing input/depth/node/text limits, rejected standard DOCTYPE, accepted unsafe
literal/PI forms, namespace-spoofed metadata/container/TOC, retained duplicate
spine entries, accepted missing package structure, landmark fallback, and NCX
DOCTYPE rejection.

Self-review added three adjacent regressions before their fixes. The suite was
RED at 23 passed / 3 failed for a bracket inside a DTD comment, nested OPF
manifest/spine sections, and a namespace-correct TOC hidden under a forged root.
A final malformed-DOCTYPE probe separately failed before name/header/root-name
validation was implemented.

### Final GREEN

```sh
node --test Tests/tools/epub-xml.test.mjs Tests/tools/epub-package.test.mjs
```

PASS — 26 tests, 0 failures.

```sh
make test-tools
```

PASS — 190 tests, 0 failures.

## Scope and hygiene

- Production modules use no runtime dependencies, browser globals, or
  `DOMParser`.
- Only the two Task 15 modules, their two focused test files, and this report
  changed in the hardening commit.
- No file under `Output/` was edited or generated.

## Concerns

None blocking. Metadata documents beyond the explicit limits are intentionally
rejected rather than partially parsed.
