# Immersive collection UX review — pass 1

Reviewed the local build at `http://localhost:4173/` in a separate built-in Chrome tab. The in-app browser was unavailable. Desktop visual inspection covered the room, opening the right-hand box, and pulling out Time Out. Code inspection covered all five hotspot mappings, sleeve controls, modal focus, responsive rules, and catalogue integration. The browser viewport control is shared, so mobile visual review is pending the primary agent's screenshots.

## What works

The room image is convincing and unusually personal: worn white boxes, silver Sony turntable, floor, black panelled wall, and lighting all support the intended memory of the collection. The revised box view uses the same photograph and camera transform. The selected physical box stays sharp while the room blurs. The first box state shows the box and a small ordered sleeve strip, with no automatically opened cover. Selecting a sleeve places its cover in front of that same box. This is the correct interaction model; it no longer feels like leaving the room for an opaque gallery.

All five initial hotspot labels and data attributes map to their corresponding box IDs. The photo, heading, and ordered catalogue are selected by those same IDs. The record strip supplies a usable precise alternative to the thin physical-spine targets. Front/back/illustrated-disc actions are clear, source uncertainty is documented, unknown sleeves retain their place, and the Roger Dean item is handled as a book.

## Concrete findings

1. **P1 — Merge the completed catalogue before delivery.** The inspected build still displayed Time Out as 2010 and only offered a Spotify search. Several completed right-box covers still appeared as placeholders. The final right.json now has 52 real fronts, 22 backs, and 31 verified album IDs; duplicate MusicBrainz dates for Time Out, Rust Never Sleeps, and Who's Next have been corrected to 1959, 1979, and 1971. Song for Juli is 1973. This is an integration issue, not missing research.

2. **P2 — Move keyboard focus into the pulled sleeve's controls.** `pullRecord()` changes the visible layout but keeps focus on the strip button near the end of the modal's DOM order. After selecting sleeve 13, the focused element remained the strip's item 13. The new Front/Back/Record inside/listening controls occur earlier, so forward keyboard traversal must pass the remaining dozens of strip buttons and cycle the modal before reaching the new actions. Focus the jacket or another appropriate newly visible control on an initial pull. Preserve intentional focus when only changing records with arrow keys.

3. **P2 — Reset accessible selected-state attributes when advancing records.** `changeView()` sets `aria-pressed`, while `renderRecord()` resets only `.active` classes on `[data-view]`. Back → next record visually returns to Front but leaves Back announced as pressed. Reset each button's `aria-pressed` in `renderRecord()` alongside the active class.

4. **P2 — Give the dialogs accessible names and keep announcements inside the active modal.** None of the static dialogs have `aria-labelledby`/`aria-label`. The selected-box heading can name the box dialog, and equivalent headings can name the others. `#announcement` is outside the modal; native modality makes the outside subtree inert, so the record-change live region may not be announced. Put the active record announcement inside the box dialog.

5. **P2 — Restore box URLs after reload.** Opening a box writes `#box=right`, but the startup loader restores only `#record=…`. Reloading `#box=right` returns to the overview while retaining the box URL. Restore known box IDs on startup, or avoid writing a state URL that the application cannot restore.

6. **P2 — Physical spine targets lack keyboard access and naming.** The generated SVG polygons have only mouse enter/leave/click handlers, no role, name, focusability, or keyboard activation. They appeared as unnamed image nodes in the accessibility tree. The strip mitigates complete exclusion, but the principal physical interaction should also be accessible. In the v3 markup the polygons are inside `.focus-layer[aria-hidden=true]`; adding roles alone will not expose them. Keep decorative imagery hidden separately from interactive spine targets.

7. **P2 — Physical spine association is approximate.** `buildSpines()` divides each compartment evenly by record count, while the photographed records have very different spine widths, including thick box sets and the Views book. This cannot provide exact sleeve-to-spine correspondence. Preserve measured boundaries where possible, or explicitly make physical hovering a coarse browsing aid with the ordered strip as the precise selector. Do not present equal-width reconstruction as exact physical placement.

## Visual refinements

The hard sharp/blur boundary can make the right box look slightly suspended above its blurred floor. A slightly broader, feathered focus mask that includes its contacting floor/shadow would help it remain grounded. This is a refinement to an otherwise strong depth-of-field effect, not a reason to return to a separate gallery.

The vinyl centre label correctly declares itself an illustration. Front sleeves have a restrained aged tint and edge treatment; further simulated damage should remain subtle so it does not obscure the genuine cover artwork.

## Verdict

The immersive direction is strong and the room rendering is convincing. It is close to an excellent first release, but not yet ready to call world-class until catalogue integration, keyboard handoff, and selected-state/focus issues above are resolved. Mobile visual sign-off remains pending. No application code was edited during this review; the only mutation was correcting discovered release-year data in the assigned right-box research file.

# Verification pass 2 — v4

The primary agent implemented the fixes and the reviewer reloaded the current build.

Verified in the separate browser tab:

- Every hotspot opens its matching box and ordered catalogue: upper-left 60, lower-left 66, upper-middle 68, lower-middle 70, right 54.
- All five initial box states keep `albumOpen=false`; covers are pulled only after a record selection.
- `#box=right` restores the physical box on reload.
- Time Out now displays 1959 and its exact verified Spotify album; formerly missing right-box fronts are present.
- Pulling a strip item moves focus to the jacket.
- Back → next album resets Front pressed=true, Back pressed=false, Record inside pressed=false.
- The box dialog is named by its heading and the record announcement is now inside it.
- Settled sharp and blurred camera planes have the same bounds to subpixel precision. The selected object is not drifting independently of the room.
- Compartment counts and thicker book weighting now replace the uniform three-section assumption. Exact spine boundaries remain reconstructed, appropriately documented as uncertain.

The earlier functional blockers above are resolved. Remaining review items: the interactive spine SVG's `aria-hidden` ancestor must be separated from decorative imagery, and mobile visuals need inspection. Desktop composition is now excellent for the intended immersive experience; the contact-shadow refinement is optional polish rather than a release blocker.

# Carousel source review — v7

The latest user steering requests a larger centered coverflow carousel, flanking navigation, and returning a sleeve by clicking the room. The implementation follows that direction and retains the physical box/camera model.

Two new navigation cases were identified in the source and sent to the primary agent:

- A natural horizontal trackpad wheel (`abs(deltaX) >= abs(deltaY)`) does not set `manualCarouselScroll`. Its native scroll can move the covers while leaving the caption/current selection unchanged. The flag should recognize horizontal wheel input as manual browsing too.
- In the initial physical-box mode, manual scrolling changes `carouselIndex` and the caption but does not change `currentIndex`. Next/previous arrows still navigate from the old `currentIndex`, producing a jump from the centered album back to the old album's neighbor. Synchronize the browse index on settle, or navigate from the centered index in this mode.

The earlier spine accessibility ancestor and roving-focus issues are now fixed in the source. Final carousel/mobile screenshot review follows once the navigation corrections are present.

# Verification pass 3 — prior carousel design, v9/v10

The built-in browser namespace became unavailable. Review briefly continued in an isolated headless `record-review` session using the agent-browser fallback, then stopped immediately when the user explicitly rejected that fallback. Only that review session was closed. The latest user steering supersedes this carousel design, so the following evidence is historical and does **not** approve the upcoming centered-sleeve redesign.

Confirmed on the prior build:

- Desktop room, box, and pulled-sleeve compositions retain the physical collection and look convincing. The source-art edge treatment is restrained.
- Carousel arrows and keyboard arrows keep the selected cover and caption synchronized.
- At 390 × 844, a mouse drag on the carousel settled at Eliminator (slot 16). Next correctly advanced to Bongo Fury (slot 17), validating the stale-index fix.
- Album-next advances the sleeve. Clicking the background puts the sleeve back while keeping the physical box open.
- Time Out uses the verified Spotify album `0nTTEAhCZsbbeplyDMIFuA`. Its embed returned HTTP 200 and rendered the correct artist/title and all seven tracks, including Take Five. No playback was triggered.
- At 390 × 844, the complete front cover fits, the box remains visible behind it, and the listening action is reachable on the first screen.
- At 375 × 667, the front cover fits and the metadata/listening controls are reachable by scrolling the sleeve-details area. The compact room overview remains usable.

Saved reviewer screenshots in `site/research/screenshots`: `review-desktop-box.jpg`, `review-desktop-spotify.jpg`, `review-mobile-album.jpg`, `review-mobile-box.jpg`, `review-small-mobile-room.jpg`, `review-small-mobile-album.jpg`, and `review-small-mobile-details.jpg`. The small-mobile album screenshot was captured during the pull animation and is evidence of layout only; it should not be used as the final presentation image.

The fallback's wheel operation failed to move the carousel, and its subsequent condition wait hung beyond the documented timeout. A restarted isolated session and actual mouse drag verified the selection flow. The wheel result was therefore not classified as an application defect.

## Current review status

New user requirement: while a sleeve is open, remove the broad carousel, make the sleeve large and centered, place its metadata in one grouped panel beside or below it, and keep compact previous/next navigation directly beneath. Reduce peripheral controls. Source/static-screenshot review of that new design is pending. No further external browser testing is authorized. The previous design's visual approval cannot carry over automatically.

# Focused sleeve review — v12

Reviewed the current HTML/CSS/JS and the native in-app screenshot `centered-album-in-app.jpg`. The child review runtime can see the extension browser but not the primary task's scoped IAB connection; an attempted separate in-app review tab was queued on the hidden child task. No fallback browser was reopened.

The new front view matches the user's correction: the sleeve is large and centered on the viewport, the metadata/listening actions form one compact panel beside it, previous/next sit directly below the sleeve, and the broad carousel is hidden while a sleeve is open. The screenshot retains the same box behind the cover and has no obvious front-view clipping or overlap. The mobile rules stack the grouped panel under the enlarged cover and reserve the remaining viewport for scrolling. The background handler excludes the new navigation group, and the new position caption is updated with each record.

One new mode-specific concern remains to check visually: the enlarged sleeve inherits the prior vinyl transform (sleeve shifts left 12%; disc shifts right 49%). With a 386–410px sleeve and a sidebar only 24–32px away, the disc can extend approximately 130–145px into the sidebar's area. Verify Record inside in the native browser and adjust the exposed-disc arrangement if it overlaps or disappears behind the grouped panel.

Front composition passes this review. Full visual approval remains pending the vinyl-mode check and the next front-on physical box projection requested by the user. The perspective box shown in this screenshot has not yet received that new projection.

# Final visual/source verdict — v15

Reviewed the native IAB captures `projected-album-in-app.jpg` and `centered-vinyl-in-app.jpg`, the final photographic calibration, projection module, responsive sleeve layout, and v15 focus handling. No external browser fallback was used for this final pass.

The reviewed front and vinyl views are excellent. Full-resolution original photographs now supply the real spine detail while the room's side/top surfaces preserve depth and context. The large front sleeve remains centered, its metadata and listening action stay grouped beside it, and compact navigation sits directly beneath. The carousel is confined to browsing the box. Vinyl mode now scales the sleeve/disc arrangement to expose a convincing disc without obscuring the metadata panel. Its illustrated-label note remains visible and honest.

The final keyboard finding is resolved in the source: `renderRecord`, `buildSpines`, and `pullRecord` all remove spine targets from tab order during `album-open`; `putRecordBack` restores exactly the current spine to tabindex 0. The decorative position marker remains visible without reintroducing a hidden focus target. The corrected behavior also covers asynchronous photo loading and viewport-triggered spine rebuilds.

All five calibrated homographies reproduce their target corners to numerical precision (maximum residual below 3 × 10⁻¹³ room-image pixels), with finite projected opening corners and no projection-horizon crossing. The cropped lower-middle source corner is explicitly documented and clipped; the room rendering remains beneath it. Exact individual spine widths still require future confirmation, as documented in the product.

**Verdict: excellent in the reviewed final desktop compositions, with no remaining visual or source blockers.** Final live mobile and all-five-box verification is being performed by the primary agent in the native in-app browser; this reviewer does not claim to have repeated that live pass on the new layout. Catalogue uncertainty, pressing differences, and the illustrated disc remain appropriately disclosed.

# Hover, direct selection, and neighboring sleeves — v18

Reviewed the v18 application source, CSS v15, and native in-app screenshots `visuals/neighbor-previews-desktop.jpg` and `visuals/neighbor-previews-mobile.jpg`. The primary agent supplied native interaction results; this pass used no external browser fallback.

The requested bounded change passes review:

- Physical spine clicks stop propagation before opening the sleeve, preventing the same event from reaching the room's put-back handler. Carousel and neighboring-cover controls remain protected by their excluded ancestors. `openRecord` clears pending carousel settle work before choosing the index.
- Hover/focus and selected-album mode share the same highlight and numbered marker. `previewIndex` keeps the temporary selection separate from the open album; leave/blur clear the temporary state, and rebuilding the calibrated opening redraws the marker from the current state. The primary agent verified the same fill/stroke and slot 13 in hover and selected modes.
- Previous/next controls show real neighboring front covers and readable titles, with descriptive accessible names. The existing placeholder pipeline handles unresolved or unavailable art. Missing boundary neighbors clear their artwork and disable their controls rather than wrapping to another box.
- The desktop controls remain compact beneath the main sleeve. At 390 × 844, both photographed preview targets fit at 136.5 × 56px, with no horizontal overflow; the centered cover and Spotify action remain visible. The native mobile image supports this layout.
- The initial autofocus side effect identified during review is fixed by `putRecordBack(false)` when opening a box without a selected album. The primary agent confirmed no initial preview or highlight. Ordinary put-back still restores access to the current sleeve for keyboard browsing.

Native checks reported by the primary agent also covered direct physical-spine and carousel selection, next-album selection, background/Escape put-back with the box remaining open, pointer leave, keyboard focus/blur, first/last boundaries, a neighboring unidentified placeholder, and zero hidden spine tab stops in album mode. The v18 script passes syntax checking.

**Final verdict for v18: excellent; no remaining blockers in this change.** The preview controls add useful neighboring-cover context while preserving the focused centered-sleeve layout.
