# Dad’s record room

A buildless photographic collection browser. The room is reconstructed from the six original family photographs, with five selectable boxes. Clicking a box moves the same camera toward it and isolates it in focus. Records lift out in front of the original box. Browse by spine, the centered cover carousel, keyboard arrows, touch swipes, or the searchable collection view.

## Run locally

From this directory, run `npm run dev` and open `http://localhost:4173`. Python 3 and Node.js are the only runtime requirements; there are no npm dependencies. After application or tracing edits, run `node scripts/merge-spine-masks.mjs` to refresh the masks and their content-based cache keys, then `npm run check` for syntax, catalog, projection, mask and cache integrity checks.

## Catalog and evidence

The editable catalog lives in `research/left.json`, `research/middle.json`, and `research/right.json`. Each item retains its box, visible position, read spine text, confidence, and source links. Use `node scripts/merge-catalog.mjs` after editing those files to regenerate `dist/catalog.json`, then run `node scripts/merge-spine-masks.mjs` to refresh the application cache key and run the checks.

318 positions are estimated from photographed spines. Thin worn edges, gatefolds, and multiple-disc sleeves can make the physical item count ambiguous. 281 identities are confirmed, 7 are probable, and 30 remain unidentified. One item is Roger Dean’s Views art book. The archive has 287 fronts, 284 verified LP outer backs, 124 sourced LP labels, and 261 verified Spotify album links.

Artwork comes from documented MusicBrainz/Cover Art Archive releases, Apple Music, Deezer, Spotify and book sources. Per-item provenance lives in the catalog. Artwork represents the album and may show a different pressing or digital edition. Classical works with unknown performers keep neutral placeholders. Sourced LP labels and backs are representative documented editions; the original family copies have not been individually photographed. The visible vinyl is an illustration; verified sourced labels are used where available and identified as representative editions.

The source photographs are in `dist/assets/IMG_3569.jpg` through `IMG_3573.jpg`. The generated room asset is `dist/assets/room-wide.jpg`. Selected box faces use the original 4032 × 3024 photographs in `dist/assets/boxes/`, not an enlarged crop of that rendering. A tested projective homography in `dist/photo-projection.js` maps each calibrated photo face onto its room perspective and blends it into the shared camera during zoom. `dist/box-photos.json` stores source and destination corners; `research/photo-calibration.json` documents the measured points and the one small lower-middle frame corner that lies outside its source photograph. That corner retains the room rendering underneath. Photographs retain their EXIF orientation and are rendered from their native dimensions. The full rendering and generation prompts are preserved one directory above this project under `visuals/`.

Spine outlines in `dist/spine-masks.json` use the displayed source-photo coordinates and the same homography as the photographic texture. Multiple vertices follow leaning or bent sleeves; measured widths preserve broad box sets, narrow records, divider gaps, and empty space at the edges. The numbered marker follows the photographed sleeve's lower edge. Masks are clipped to the actual image bounds, including the missing lower-middle corner.

Edit the tracing data in `research/spine-masks-left.json`, `spine-masks-middle.json`, and `spine-masks-right.json`, then run `node scripts/merge-spine-masks.mjs`. The merge retains catalog order and records a checksum of each source photo. It fingerprints the merged mask data and application script so preview and published browsers request the current files. Validation checks those cache keys, coverage, projection, clipping, and the Rampal/Laskine sleeve that previously highlighted the empty right frame. Several worn or uncertain boundaries remain interpolated between readable anchors; more precise outlines do not change the catalog's identification confidence.

## Adding missing records later

Use `capture.html` for the phone guide. Its 47 requested entries allow up to 94 photos, front then back, in original box order. Conditional folded edges can be skipped. Each entry shows the original source-photo mask, neighboring albums and the reason for capture. No image renaming, captions or folders are required. Original file order and cover content resolve retakes and skipped folds.

The frozen sequence is `research/capture-plans/7ac3efbb41aa.json`; retain it when matching uploads even if the catalogue changes. `research/photo-capture-plan.md` contains the complete list, and `dist/capture-map.pdf` is the printable visual map. Regenerate the current manifest with `node scripts/build-capture-plan.mjs`; use `--freeze` only when issuing a reviewed new sequence. The script fingerprints the manifest, guide script and styles. PDF regeneration uses `scripts/render-capture-map.py` with Pillow and ReportLab; the Codex bundled Python runtime provides both.

`research/deep-research-report.md` describes identifications, corrections and remaining gaps. The three `deep-*-audit.json` files account for all 318 positions, with queries, sources, accepted editions, rejected images and remaining photo needs. Independently reviewed contact sheets and `deep-right-peer-review.json` record the artwork checks. Unselected and superseded images are retained under `research/artwork-candidates/`; its index resolves original paths from older download logs without shipping those candidates to the website.

For new photos, match the saved front/back sequence to the stable item IDs, then update the appropriate research row while retaining its box/position until physical evidence justifies a correction. Add artwork under `dist/assets/covers/`. Set Spotify IDs only after verifying both artist and album on the actual Spotify album page, and include that page in `sources`. Otherwise retain the clearly labeled search fallback.

The Spotify matching audit accounts for all 188 confirmed music slots that originally lacked album IDs. `research/spotify-link-audit-summary.json` records every match and every remaining search-only case; the three shard audits retain queries, rejected candidates, and edition decisions. `research/spotify-link-verification/` contains independently fetched primary album metadata with track-level credits. Public native Spotify discography checks are recorded in `research/spotify-link-native-review.json`. Remasters and expanded reissues may be linked when the original album programme is verified, with differences stated in sleeve details. Classical matches require the original performers and recording. Probable and unidentified sleeves retain their existing confidence and listening behavior.

To rebuild this audited snapshot, run `python3 scripts/verify-spotify-links.py`, then `node scripts/merge-spotify-links.mjs`, `node scripts/merge-catalog.mjs`, and `node scripts/merge-spine-masks.mjs`. The merge refuses unfinished cases and disagreement between the audit and independent Spotify metadata. `npm run check` validates listening provenance alongside the catalogue and frozen photo sequence. A verified ID establishes album identity; Spotify controls regional availability and account playback. Specific observed restrictions appear beside the listen button.

## Playback and hosting

Verified albums open a Spotify embed on demand and offer the exact album link. Closing or pressing Escape in the listening panel minimizes it to a corner player while the same iframe continues playing. Its controls remain usable in boxes, the collection, and photo views. Only Stop, Refresh player, or choosing another album resets the player. Sign in to Spotify and Refresh player are available inside the expanded turntable; refreshing resets playback. Other identified albums offer a Spotify search. Unidentified records and the art book have no playback action. Spotify manages login, regional availability, and playback permissions. Full browser playback through the Web Playback SDK requires a separate Spotify developer app, user authorization, and Spotify Premium; this project currently uses embeds.

`.openai/hosting.json` declares the private Sites project and static `dist` output. No credentials are stored in this repository. Publishing keeps the owner-private audience until the user explicitly changes sharing.

## Vercel hosting

The Vercel project is `record-collection` in `ben-zittlaus-projects`, with production domain `records.zittlau.ca`. Use the Vercel CLI for deployment and account configuration. `vercel.json` serves only `dist/`, with no install or build step. `.vercelignore` excludes research, tooling, hosting metadata and local environment files from CLI uploads. Original phone captures live outside `site/`.

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

For Spotify authorization on this domain, register the exact redirect URI `https://records.zittlau.ca/` in the Spotify developer app. The current Spotify embed does not require an OAuth redirect; the future Web Playback SDK sign-in will.
