# Photographic spine masking review

The hit regions and highlights now use 318 photograph-derived polygons rather than equal divisions of the box opening. The five source maps retain stable record IDs and document uncertain or interpolated boundaries. Served photo pixels are unchanged.

The reported lower-middle sleeve 67 is the Rampal/Laskine Japanese Melodies sleeve. At source y700, its old mask crossed x3413–3451, over the empty right edge. The corrected trace crosses x3147–3189 on the cream spine. Its number follows the lower edge. Tracing also confirmed the physical sequence Scary Monsters, Abbey Road, Low; their catalog positions were corrected without changing IDs or any album artwork, confidence, or Spotify data.

Native in-app review covered all five box views, a direct click on the corrected leaning sleeve, and mobile390×844. Every box used the full set of photo-derived masks. On mobile there was no horizontal overflow or hidden spine tab stop, and sleeve67's marker remained within the viewport. The camera now fits the complete box width as well as its height.

Hover cards measure their actual height and move clear of the selected number. Their positions refresh after photo calibration and camera transitions. In the final Views52 case, the popup ends at x588.83 and the number begins at x602.84, leaving14px clearance. The outline follows the broad leaning art-book spine independently of the adjacent Solo Concerts box.

Validation covers all318 catalog IDs, source photo checksums, clipping at photographed image edges, noncrossing polygons, finite projective coordinates, marker anchors, and the Japanese Melodies/Bowie-order regressions. `npm run check` passes. Independent trace and final native screenshot review found no remaining blockers in this change. Very thin worn edges retain documented interpolation; the improved outlines do not change identification confidence.

Native screenshots are preserved under `visuals/mask-*-in-app.jpg` in the workspace root.
