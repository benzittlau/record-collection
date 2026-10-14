# Dad’s record room

A buildless photographic collection browser. The room is reconstructed from the six original family photographs, with five selectable boxes. Clicking a box moves the same camera toward it and isolates it in focus. Records lift out in front of the original box. Browse by spine, the centered cover carousel, keyboard arrows, touch swipes, or the searchable collection view.

## Run locally

From this directory, run `npm run dev` and open `http://localhost:4173`. Python 3 and Node.js are the only runtime requirements; there are no npm dependencies. After application or tracing edits, run `node scripts/merge-spine-masks.mjs` to refresh the masks and their content-based cache keys, then `npm run check` for syntax, catalog, projection, mask and cache integrity checks.

## Catalog and evidence

The editable catalog lives in `research/left.json`, `research/middle.json`, and `research/right.json`. Each item retains its box, visible position, read spine text, confidence, and source links. Use `node scripts/merge-catalog.mjs` after editing those files to regenerate `dist/catalog.json`, then run `node scripts/merge-spine-masks.mjs` to refresh the application cache key and run the checks.

318 positions are estimated from photographed spines. Thin worn edges, gatefolds, and multiple-disc sleeves can make the physical item count ambiguous. 281 identities are confirmed, 7 are probable, and 30 remain unidentified. One item is Roger Dean’s Views art book. The archive has 287 fronts, 284 verified LP outer backs, 124 sourced LP labels, and 92 verified Spotify album IDs.

Artwork comes from documented MusicBrainz/Cover Art Archive releases, Apple Music, Deezer, Spotify and book sources. Per-item provenance lives in the catalog. Artwork represents the album and may show a different pressing or digital edition. Classical works with unknown performers keep neutral placeholders. Sourced LP labels and backs are representative documented editions; the original family copies have not been individually photographed. The visible vinyl is an illustration; verified sourced labels are used where available and identified as representative editions.

The source photographs are in `dist/assets/IMG_3569.jpg` through `IMG_3573.jpg`. The generated room asset is `dist/assets/room-wide.jpg`. Selected box faces use the original 4032 × 3024 photographs in `dist/assets/boxes/`, not an enlarged crop of that rendering. A tested projective homography in `dist/photo-projection.js` maps each calibrated photo face onto its room perspective and blends it into the shared camera during zoom. `dist/box-photos.json` stores source and destination corners; `research/photo-calibration.json` documents the measured points and the one small lower-middle frame corner that lies outside its source photograph. That corner retains the room rendering underneath. Photographs retain their EXIF orientation and are rendered from their native dimensions. The full rendering and generation prompts are preserved one directory above this project under `visuals/`.

Spine outlines in `dist/spine-masks.json` use the displayed source-photo coordinates and the same homography as the photographic texture. Multiple vertices follow leaning or bent sleeves; measured widths preserve broad box sets, narrow records, divider gaps, and empty space at the edges. The numbered marker follows the photographed sleeve's lower edge. Masks are clipped to the actual image bounds, including the missing lower-middle corner.

Edit the tracing data in `research/spine-masks-left.json`, `spine-masks-middle.json`, and `spine-masks-right.json`, then run `node scripts/merge-spine-masks.mjs`. The merge retains catalog order and records a checksum of each source photo. It fingerprints the merged mask data and application script so preview and published browsers request the current files. Validation checks those cache keys, coverage, projection, clipping, and the Rampal/Laskine sleeve that previously highlighted the empty right frame. Several worn or uncertain boundaries remain interpolated between readable anchors; more precise outlines do not change the catalog's identification confidence.

## Adding missing records later

Use `capture.html` for the phone guide. Its 47 requested entries allow up to 94 photos, front then back, in original box order. Conditional folded edges can be skipped. Each entry shows the original source-photo mask, neighboring albums and the reason for capture. No image renaming, captions or folders are required. Original file order and cover content resolve retakes and skipped folds.

The frozen sequence is `research/capture-plans/7ac3efbb41aa.json`; retain it when matching uploads even if the catalogue changes. `research/photo-capture-plan.md` contains the complete list, and `dist/capture-map.pdf` is the printable visual map. Regenerate the current manifest with `node scripts/build-capture-plan.mjs`; use `--freeze` only when issuing a reviewed new sequence. The script fingerprints the manifest, guide script and styles. PDF regeneration uses `scripts/render-capture-map.py` with Pillow and ReportLab; the Codex bundled Python runtime provides both.

`research/deep-research-report.md` describes identifications, corrections and remaining gaps. The three `deep-*-audit.json` files account for all 318 positions, with queries, sources, accepted editions, rejected images and remaining photo needs. Independently reviewed contact sheets and `deep-right-peer-review.json` record the artwork checks. Unselected and superseded images are retained under `research/artwork-candidates/`; its index resolves original paths from older download logs without shipping those candidates to the website.

For new photos, match the saved front/back sequence to the stable item IDs, then update the appropriate research row while retaining its box/position until physical evidence justifies a correction. Add artwork under `dist/assets/covers/`. Set Spotify IDs only after verifying both artist and album on the actual Spotify album page, and include that page in `sources`. Otherwise retain the clearly labeled search fallback.

## Playback and hosting

Verified albums open a Spotify embed on demand and offer the exact album link. Closing the listening panel removes its iframe, stopping playback. Other identified albums offer a Spotify search. Unidentified records and the art book have no playback action. Spotify manages login, regional availability, and playback permissions.

`.openai/hosting.json` declares the private Sites project and static `dist` output. No credentials are stored in this repository. Publishing keeps the owner-private audience until the user explicitly changes sharing.
