# Dad’s record room

A buildless photographic collection browser. The room is reconstructed from the six original family photographs, with five selectable boxes. Clicking a box moves the same camera toward it and isolates it in focus. Records lift out in front of the original box. Browse by spine, the centered cover carousel, keyboard arrows, touch swipes, or the searchable collection view.

## Run locally

From this directory, run `npm run dev` and open `http://localhost:4173`. Python 3 and Node.js are the only runtime requirements; there are no npm dependencies. Run `npm run check` for JavaScript syntax and catalog integrity checks.

## Catalog and evidence

The editable catalog lives in `research/left.json`, `research/middle.json`, and `research/right.json`. Each item retains its box, visible position, read spine text, confidence, and source links. Use `node scripts/merge-catalog.mjs` after editing those files to regenerate `dist/catalog.json`, then run the checks.

318 positions are estimated from photographed spines. Thin worn edges, gatefolds, and multiple-disc sleeves can make the physical item count ambiguous. 263 identities are confirmed, 19 are probable, and 36 remain unidentified. One item is Roger Dean’s Views art book. The archive has 255 fronts, 49 sourced backs, and 92 verified Spotify album IDs.

Artwork comes from documented MusicBrainz/Cover Art Archive releases, Apple Music, Deezer, Spotify and book sources. Per-item provenance lives in the catalog. Artwork represents the album and may show a different pressing or digital edition. Classical works with unknown performers keep neutral placeholders. Original record labels and original back covers have not been photographed. The visible vinyl is an illustration, clearly labeled in the experience.

The source photographs are in `dist/assets/IMG_3569.jpg` through `IMG_3573.jpg`. The generated room asset is `dist/assets/room-wide.jpg`. Selected box faces use the original 4032 × 3024 photographs in `dist/assets/boxes/`, not an enlarged crop of that rendering. A tested projective homography in `dist/photo-projection.js` maps each calibrated photo face onto its room perspective and blends it into the shared camera during zoom. `dist/box-photos.json` stores source and destination corners; `research/photo-calibration.json` documents the measured points and the one small lower-middle frame corner that lies outside its source photograph. That corner retains the room rendering underneath. Photographs retain their EXIF orientation and are rendered from their native dimensions. The full rendering and generation prompts are preserved one directory above this project under `visuals/`.

## Adding missing records later

Photograph the spine and both faces of a missing sleeve. Find its stable item ID and update that row, retaining the box/position. Add artwork under `dist/assets/covers/`. Set Spotify IDs only after verifying both artist and album on the actual Spotify album page, and include that page in `sources`. Otherwise retain the clearly labeled search fallback.

## Playback and hosting

Verified albums open a Spotify embed on demand and offer the exact album link. Closing the listening panel removes its iframe, stopping playback. Other identified albums offer a Spotify search. Unidentified records and the art book have no playback action. Spotify manages login, regional availability, and playback permissions.

`.openai/hosting.json` declares the private Sites project and static `dist` output. No credentials are stored in this repository. Publishing keeps the owner-private audience until the user explicitly changes sharing.
