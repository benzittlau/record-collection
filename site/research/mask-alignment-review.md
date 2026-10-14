# Photographic spine masking review

The hit regions and highlights now use 318 photograph-derived polygons rather than equal divisions of the box opening. The five source maps retain stable record IDs and document uncertain or interpolated boundaries. Served photo pixels are unchanged.

The reported lower-middle sleeve 67 is the Rampal/Laskine Japanese Melodies sleeve. At source y700, its old mask crossed x3413–3451, over the empty right edge. The corrected trace crosses x3147–3189 on the cream spine. Its number follows the lower edge. Tracing also confirmed the physical sequence Scary Monsters, Abbey Road, Low; their catalog positions were corrected without changing IDs or any album artwork, confidence, or Spotify data.

Native in-app review covered all five box views, a direct click on the corrected leaning sleeve, and mobile390×844. Every box used the full set of photo-derived masks. On mobile there was no horizontal overflow or hidden spine tab stop, and sleeve67's marker remained within the viewport. The camera now fits the complete box width as well as its height.

Hover cards measure their actual height and move clear of the selected number. Their positions refresh after photo calibration and camera transitions. In the final Views52 case, the popup ends at x588.83 and the number begins at x602.84, leaving14px clearance. The outline follows the broad leaning art-book spine independently of the adjacent Solo Concerts box.

Validation covers all318 catalog IDs, source photo checksums, clipping at photographed image edges, noncrossing polygons, finite projective coordinates, marker anchors, and the Japanese Melodies/Bowie-order regressions. `npm run check` passes. Independent trace and final native screenshot review found no remaining blockers in this change. Very thin worn edges retain documented interpolation; the improved outlines do not change identification confidence.

Native screenshots are preserved under `visuals/mask-*-in-app.jpg` in the workspace root.

## Box 3 sleeve ends

All 68 upper-middle outlines now use individually measured left/right cap and foot heights. The previous shared y650–2550 cutoff missed visible tips; Chance (sleeve 14) now reaches y432–2746, with its number anchored to the foot midpoint. Existing side-seam body measurements and the other four box maps remain unchanged. Worn or folded corner tips retain a straight-edge approximation inset a few pixels inside the photographed sleeve.

Independent source-photo review checked every endpoint and magnified Chance's cap and foot. Native in-app checks confirmed that clicking both previously uncovered ends opens Chance directly, and reviewed Let It Flow and the taller Apocalypse sleeve. The 390×844 phone view retains all 68 photographic masks, no horizontal overflow, and a visible number marker. The new Chance extent regression fails against the previous data and passes with the corrected data; the complete check suite passes. The desktop result is preserved in `visuals/box3-full-height-masks-in-app.jpg`.

## Box 1 sleeve ends

All 60 upper-left outlines now reach individually measured cap and foot corners. Prisoner in Disguise (sleeve 33) expands from the old y480–2530 band to y401–2688; its numbered marker follows the new foot midpoint. Small folded cap peaks and the rounded heel use a conservative straight-edge approximation. The original middle-body seams and the other four box maps remain unchanged.

Independent photo review resolved shelf-shadow wedges beside the compartment dividers and checked the final endpoint overlay. Native in-app checks covered both newly clickable ends of sleeve 33, the first sleeve, Dark Side of the Moon beside the divider, the last sleeve, and a 390×844 phone viewport. All 60 photographic masks render, the number remains visible, and the phone view has no horizontal overflow. The new sleeve-33 extent regression fails on the old map and passes on the corrected map; the complete check suite passes. The measured endpoint generator is idempotent and preserves the lower-left map. Native desktop evidence is saved as `visuals/box1-full-height-masks-in-app.jpg`.
