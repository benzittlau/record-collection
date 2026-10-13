# Left crate catalog audit

The authoritative artifact is `left.json`. It contains 126 observed sleeve positions: 60 in the upper-left crate (IMG_3569.jpg) and 66 in the lower-left crate (IMG_3571.jpg). The ordering runs left to right within each of the three photographed compartments. Positions represent the best reading of the photograph, not a verified count of discs: multi-LP gatefolds are represented as one album and deeply worn narrow sleeves are retained as placeholders.

100 album identities are confirmed by readable artist/title spines, 11 are probable from partial text or catalogue numbers, and 15 remain unidentified. Every identified or probable album has a local front-cover asset (111 fronts). Three scanned editions also have local backs. The 32 Spotify album IDs were independently verified against Spotify album pages. Primary-page metadata evidence for the first 31 is saved in `left_spotify_evidence.json`; Electric Ladyland was additionally verified at https://open.spotify.com/album/5z090LQztiqh13wYspQvKQ.

Apple Music and Deezer art represents digital releases; Cover Art Archive images are scans of specified catalogued editions. None establishes the exact pressing of the photographed vinyl. Per-record `artworkEdition` and `notes` preserve this distinction. Wendy Carlos’s probable Switched-On Bach II uses the restored cover from her official artist website. No invented back-cover art is provided.

Unidentified slots are intentionally useful placeholders for later front-cover photography. Artist-only fragments are preserved in `artist`/`spineText` when reasonably readable; a candidate artist is never given a fabricated album title. The original damaged spines and approximate order should remain visible in the scene even when a cover is unavailable.

All linked local JPEG assets opened and passed Pillow integrity verification. The cover contact sheets were visually inspected for title/artist mismatches.
