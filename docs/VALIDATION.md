# Validation — v0.3

## V2 structural rebuild — passed
- `node --check src/app.js`
- `npm run build`
- GitHub Actions branch verification on head `c0e8eb3f5d5173ff3d2901277cfa56e5fddc2983`: **PASS**
- GitHub Actions PR verification on the same head: **PASS**
- Built static artifact uploaded by CI
- No third-party runtime dependencies
- Responsive breakpoints retained
- `prefers-reduced-motion` retained
- Deterministic 15s demo retained

## V2 visual changes now in code
- package is the dominant hero object
- permanent side dashboards removed
- warm editorial print-lab environment
- FR/EN, data carrier and claim enter as physical constraints
- collision shown on the package surface
- COMPILE opens the carton into a dieline
- reflow occurs before refold
- EU / Canada continue to reuse the same master object

## Runtime
Cloudflare Pages runtime:
`https://packshift-awd.pages.dev/`

Cloudflare is expected to auto-deploy from:
`day19/vertical-slice`

## Runtime visual verification
**Pending live V2 visual QA.**

The external fetch available in this chat currently returns a cache miss for the Pages domain, so desktop/mobile rendering has not yet been independently inspected after the V2 push.

Required QA:
- desktop composition
- 360–430px mobile composition
- FR/EN entry
- data carrier entry
- visible claim collision
- dieline unfold
- content reflow
- refold
- VALID FORM
- EU → Canada
- 15s deterministic demo
- reduced-motion behavior

## Truth boundary
“VALID FORM” remains an interaction-demo state. It is not a regulatory compliance determination.
