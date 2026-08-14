# Self-hosted webfonts — attribution

These are served from this domain rather than from Google's CDN, so that no
visitor's IP address is disclosed to a third party on page load.

All four families are licensed under the **SIL Open Font License 1.1**, which
permits redistribution and self-hosting provided the licence travels with the
fonts. The full licence text is in `OFL.txt`; its body is identical for all four,
only the copyright lines differ:

| Family | Copyright | Source |
|---|---|---|
| Fraunces | 2018 The Fraunces Project Authors | https://github.com/undercasetype/Fraunces |
| IBM Plex Sans | 2017 IBM Corp. | https://github.com/IBM/plex |
| IBM Plex Mono | 2017 IBM Corp. | https://github.com/IBM/plex |
| Jost | 2020 The Jost Project Authors | https://github.com/indestructible-type/Jost |

The `.woff2` payloads are the same files Google Fonts serves, retrieved from
`fonts.gstatic.com`, so rendering is unchanged. Only the **latin** and
**latin-ext** subsets are kept — this site is English with occasional diacritics in
botanical and place names.

Fraunces, IBM Plex Sans and Jost are **variable** fonts: one file covers a weight
range, which is why several `@font-face` rules in `src/styles/fonts.css` point at
the same file. IBM Plex Mono is static, so 400 and 500 are separate files.

To regenerate after a font or weight change, see the procedure in `SECURITY.md`.
