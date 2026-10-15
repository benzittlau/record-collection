# Dad’s record room

A buildless photographic collection browser. The room is reconstructed from the six original family photographs, with five selectable boxes. Clicking a box moves the same camera toward it and isolates it in focus. Records lift out in front of the original box. Browse by spine, the centered cover carousel, keyboard arrows, touch swipes, or the searchable collection view.

## Run locally

From this directory, run `npm run dev` and open `http://127.0.0.1:4173/`. The local server also accepts `localhost`, but Spotify sign-in uses the numeric loopback redirect registered below. Python 3.9 or newer and Node.js are the only runtime requirements; there are no npm dependencies. After application or tracing edits, run `node scripts/merge-spine-masks.mjs` to refresh the masks and their content-based cache keys, then `npm run check` for syntax, catalog, projection, mask, Spotify configuration and cache integrity checks.

For Spotify account playback, copy `.env.example` to the ignored `.env.local` in this directory, then replace its client ID placeholder with the public client ID from the Spotify developer app. The local server loads this file at startup; inherited environment variables take priority. It supports single-line `KEY=value` settings, single or double quotes, and comments. Restart the server after changing local settings.

The configuration names are `SPOTIFY_CLIENT_ID` and `SPOTIFY_REDIRECT_URI`. Locally, the redirect defaults to `http://127.0.0.1:4173/`. Register that exact URI separately from the production URI `https://records.zittlau.ca/` in the Spotify developer app. Open the numeric loopback address for sign-in so the callback returns to the same browser origin. `localhost` is unsuitable as a Spotify OAuth redirect.

The browser reads `/api/spotify-config` at runtime. This endpoint exposes only `{clientId, redirectUri}` and disables caching; the client ID is public OAuth application metadata. Missing or invalid configuration returns HTTP 503. Authorization Code with PKCE does not require a client secret. Never put a client secret in browser code, the runtime response, or tracked files. `.env.local` is ignored by Git and excluded from Vercel uploads; `.env.example` contains placeholders only.

## Catalog and evidence

The editable catalog lives in `research/left.json`, `research/middle.json`, and `research/right.json`. Each item retains its box, visible position, read spine text, confidence, and source links. Use `node scripts/merge-catalog.mjs` after editing those files to regenerate `dist/catalog.json`, then run `node scripts/merge-spine-masks.mjs` to refresh the application cache key and run the checks.

The catalog retains 320 stable source positions, including two documented folded-edge aliases, representing 318 physical items. After the October 14 front/back capture intake, 311 identities are confirmed and seven thin or conditional edges remain unresolved. One item is Roger Dean’s Views art book. The archive has 311 fronts, 311 outer backs (LP sleeves and the book), 123 sourced LP labels, and 283 verified Spotify album links.

Artwork comes from documented MusicBrainz/Cover Art Archive releases, Discogs LP scans, Apple Music, Deezer, Spotify and book sources. Per-item provenance lives in the catalog. The 90 phone captures establish the identities and editions of 45 family copies; clean external artwork is preferred for display. Two rare classical outer backs use perspective-corrected family photos because usable external scans remain unavailable. Other artwork may show a different pressing or digital edition, with differences documented per face. The visible vinyl is an illustration; verified sourced labels are representative editions, not photographs of the family discs.

The source photographs are in `dist/assets/IMG_3569.jpg` through `IMG_3573.jpg`. The generated room asset is `dist/assets/room-wide.jpg`. Selected box faces use the original 4032 × 3024 photographs in `dist/assets/boxes/`, not an enlarged crop of that rendering. A tested projective homography in `dist/photo-projection.js` maps each calibrated photo face onto its room perspective and blends it into the shared camera during zoom. `dist/box-photos.json` stores source and destination corners; `research/photo-calibration.json` documents the measured points and the one small lower-middle frame corner that lies outside its source photograph. That corner retains the room rendering underneath. Photographs retain their EXIF orientation and are rendered from their native dimensions. The full rendering and generation prompts are preserved one directory above this project under `visuals/`.

Spine outlines in `dist/spine-masks.json` use the displayed source-photo coordinates and the same homography as the photographic texture. Multiple vertices follow leaning or bent sleeves; measured widths preserve broad box sets, narrow records, divider gaps, and empty space at the edges. The numbered marker follows the photographed sleeve's lower edge. Masks are clipped to the actual image bounds, including the missing lower-middle corner.

Edit the tracing data in `research/spine-masks-left.json`, `spine-masks-middle.json`, and `spine-masks-right.json`, then run `node scripts/merge-spine-masks.mjs`. The merge retains catalog order and records a checksum of each source photo. It fingerprints the merged mask data, Spotify modules, player, application script and stylesheet so preview and published browsers request the current files. Validation checks those cache keys, coverage, projection, clipping, and the Rampal/Laskine sleeve that previously highlighted the empty right frame. Several worn or uncertain boundaries remain interpolated between readable anchors; more precise outlines do not change the catalog's identification confidence.

## Adding missing records later

Use `capture.html` for the phone guide. Its 47 requested entries allow up to 94 photos, front then back, in original box order. Conditional folded edges can be skipped. Each entry shows the original source-photo mask, neighboring albums and the reason for capture. No image renaming, captions or folders are required. Original file order and cover content resolve retakes and skipped folds.

The frozen sequence is `research/capture-plans/7ac3efbb41aa.json`; retain it when matching uploads even if the catalogue changes. `research/photo-capture-plan.md` contains the complete list, and `dist/capture-map.pdf` is the printable visual map. Regenerate the current manifest with `node scripts/build-capture-plan.mjs`; use `--freeze` only when issuing a reviewed new sequence. The script fingerprints the manifest, guide script and styles. PDF regeneration uses `scripts/render-capture-map.py` with Pillow and ReportLab; the Codex bundled Python runtime provides both.

`research/deep-research-report.md` describes identifications, corrections and remaining gaps. The three `deep-*-audit.json` files account for all 320 source positions, with queries, sources, accepted editions, rejected images and remaining photo needs. Their `beforeCapture` fields preserve earlier outcomes. Independently reviewed contact sheets and peer reviews record the artwork checks. Unselected and superseded images are retained under `research/artwork-candidates/`; these do not ship to the website.

`research/capture-intake-2026-10-14/README.md` records the completed intake. Its reconciliation maps all 90 original files to 45 physical items, retaining the frozen guide and original IDs. Julian Bream and Herbie Mann are inserted as `lower-middle-04b` and `right-04b`; two confirmed folds resolve to their parent albums, including for old direct links. Raw phone originals stay in the ignored repository-root `captures/` directory, outside the site. Published fallbacks omit capture metadata.

For new photos, match the saved front/back sequence to the stable item IDs, then update the appropriate research row while retaining its box/position until physical evidence justifies a correction. Add artwork under `dist/assets/covers/`. Set Spotify IDs only after verifying both artist and album on the actual Spotify album page, and include that page in `sources`. Otherwise retain the clearly labeled search fallback.

The original Spotify matching audit accounts for all 188 confirmed music slots that originally lacked album IDs. `research/spotify-link-audit-summary.json` and the three shard audits preserve that historical research. The capture intake adds 22 independently verified links in `research/capture-intake-2026-10-14/spotify-decisions.json`, retaining every earlier verified link. `research/spotify-link-verification/` contains primary album metadata with track-level credits. Remasters and expanded reissues may be linked when the original album programme is verified, with differences stated in sleeve details. Classical matches require the original performers and recording; partial anthologies and uncertain alternate takes retain search.

For ordinary catalog edits, run `node scripts/merge-catalog.mjs`, then `node scripts/merge-spine-masks.mjs` and `npm run check`. The historical `merge-spotify-links.mjs` rebuilds the pre-capture listening audit; use the capture intake’s application script afterward if replaying that research. The intake README documents its separate reconstruction inputs. Checks validate listening provenance alongside the catalog, frozen photo sequence and import receipt. A verified ID establishes album identity; Spotify controls regional availability and account playback. Specific observed restrictions appear beside the listen button.

## Playback and hosting

Verified albums open the turntable on demand and offer the exact album link. Spotify embeds remain available without connecting an account. Connecting Spotify authorizes the browser with Authorization Code and PKCE; full playback uses the Web Playback SDK and requires Spotify Premium, an eligible Spotify account and a configured developer app. Spotify manages account access, regional availability and playback permissions. Minimizing the turntable preserves playback while browsing boxes, the collection and photo views. Other identified albums offer a Spotify search. Unidentified records and the art book have no playback action.

`.openai/hosting.json` declares the private Sites project and static `dist` output. No credentials are stored in this repository. Publishing keeps the owner-private audience until the user explicitly changes sharing.

## Vercel hosting

The Vercel project is `record-collection` in `ben-zittlaus-projects`, with production domain `records.zittlau.ca`. Use the Vercel CLI for deployment and account configuration. `vercel.json` serves static files from `dist/`, with no install or build step. Vercel automatically deploys `api/spotify-config.js` as a Node.js function alongside that static output. `.vercelignore` excludes research, tooling, hosting metadata and local environment files from CLI uploads. Original phone captures live outside `site/`.

Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_REDIRECT_URI` in the Vercel project environment for each deployment target that needs playback. Production uses `SPOTIFY_REDIRECT_URI=https://records.zittlau.ca/`. Preview deployments can use that same registered URI: Connect first moves browsing to production, then starts authorization there. A separately registered preview root URL allows sign-in within that preview instead. Use the Vercel CLI's interactive environment input so values stay outside tracked files and shell command arguments, then deploy again to apply changes. A retained `SPOTIFY_CLIENT_SECRET` stays in environment storage and is unused by browser PKCE. The runtime endpoint reads only the public configuration. The static private Sites publication can use Spotify embeds; full account playback requires the configuration endpoint provided by the local or Vercel server.

From the repository root, link a fresh checkout once, then validate and deploy:

```sh
npx --yes vercel@64.1.0 --cwd site link --yes --project record-collection --scope ben-zittlaus-projects
npm run check
npx --yes vercel@64.1.0 --cwd site deploy --prod --scope ben-zittlaus-projects
```

The Vercel site is public, as explicitly requested on October 14, 2026. Vercel Authentication is disabled for this project, including its production domain. The existing private Sites project remains separate.

Vercel's recommended DNS record, retrieved October 14, 2026, is a `CNAME` named `records` pointing to `ffff5ae07e97b6f2.vercel-dns-017.com.`. Add this record at the authoritative DNS provider; the root domain and nameservers do not need to move. Recheck the recommendation and propagation with:

```sh
npx --yes vercel@64.1.0 --cwd site domains verify records.zittlau.ca --scope ben-zittlaus-projects
```

For Spotify authorization on this domain, register the exact redirect URI `https://records.zittlau.ca/` in the Spotify developer app, as well as the separate local redirect when developing. Spotify embeds do not require an OAuth redirect; account playback through the Web Playback SDK does.
