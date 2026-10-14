# Completed left-box deep pass

All 126 stable catalogue slots were audited: 60 upper-left and 66 lower-left.
Final identification confidence is 108 confirmed, 5 probable, and 13 unknown.
All 113 identified albums have local, visually verified vinyl LP outer fronts
and outer backs. There are also 91 verified matching LP label references.

The catalogue shard is `left.json`; the complete per-record audit is
`deep-left-audit.json`; accepted per-face provenance is
`deep-left-art-selections.json`. Candidate responses, failed requests, scans,
spine crops, and contact sheets remain in the dedicated `deep-left-*` files.
The final accepted contact sheets are `deep-left-accepted-contact-01.jpg`
through `deep-left-accepted-contact-19.jpg`.

## Identity and transcription corrections

- Upper-left 19 is **Graham Nash / David Crosby (1972)**, not Crosby's solo
  *If I Could Only Remember My Name*. Both names and Atlantic SD7220 are
  readable. The original London/Atlantic catalogue evidence and LP scans agree.
- Upper-left 29 is **Their Satanic Majesties Request (1967)**, not
  *Through the Past, Darkly*. The source reads NPS2; the latter album is NPS3.
- Upper-left 02 reads **KC34162**, not KC34167.
- Upper-left 34 reads **SR2108**, not SR2110.
- Lower-left 48 is probably the self-titled **David Bromberg** LP. The worn
  source resembles C31104; the old ST114 reading is rejected. Original-year
  disagreement between the artist's 1971 account and documented 1972 commercial
  release remains explicit, so the catalogue year is null.
- Lower-left 53 is probably **Third Ear Band — Alchemy**, newly readable on
  the original adjacent strip. The album presence is clear, but mask 52 currently
  crosses that lettering, so slot binding is not silently reassigned.
- Lower-left 52's unsubstantiated ST11793 code was removed. *Never for Ever*
  remains readable, and the selected Canadian LP scans are STAO6476 references.

## Face-level rejection and verification

Rejected same-title singles, a UK Magical Mystery Tour double 7-inch EP, a
Fleetwood Mac compilation, Cunning Stunts' Japanese CD rear, Before the Flood's
misattached CD tray, and an incorrectly uploaded U2 War label in a Marianne
Faithfull release. Gatefold interiors were excluded when selecting Prisoner in
Disguise, Aja, Before the Flood, and other rear faces. Trilogy and Heartbeat City
use literal outer rear panels cropped from documented exterior jacket spreads;
crop rectangles and original source URLs are preserved.

MusicBrainz requests share the 1.1-second aggregate limiter. Discogs requests
share the measured 25-request/minute limiter at 2.5 seconds. Catalogue/version,
release relationship, artist-release, owner-scan, and alternative-host leads
were followed when a first source lacked usable scans. Previously remote-only
Construction #1 now has a matching Canadian LP back asset. No unknown album was
assigned artwork from color, label, neighbors, or a guessed title.

An independent researcher reviewed all 19 accepted contact sheets and verified
all selected source URLs/local files. The final verdict found no remaining
wrong-album, CD-tray, inner-panel, or mismatched-label selections.

## Remaining physical questions

Twenty-five catalogue slots request front/back pairs before conditional
consolidation. These requests address unidentified jackets or uncertain physical
order; identified albums have no reference-artwork gaps. Ten precise physical
groups are listed in `deep-left-physical-groups.json`. Known Best of OMD and Queen
Jazz are only visual anchors for the uncertain worn jacket between them; those
anchors do not need new photo pairs. Possible folded leaves should be skipped
when they are not separate physical jackets. Counts, positions, and masks remain
unchanged, with the ambiguity documented for the capture guide.

## Validation and seal

Every referenced selected image opens successfully. All 126 IDs, source photos,
boxes, positions, compartments, and compartment positions match the baseline.
The finalization script reruns idempotently and can resolve archived candidate
scans from `research/artwork-candidates` after publication cleanup.

Final SHA256:

- `left.json`: `1515602881ae7a100806a5905139c557ca22e2c35e92e89b2ba222ae38bf3584`
- `deep-left-audit.json`: `e6e5c1ece340fe025b05c03307d06cfee38d5d57c6b6d78d100a58810bb12a87`
- `deep-left-art-selections.json`: `088457acdd4ef170a369ae07ae85aea4683e2a974fbdd6b385feb9b8a1adfcfd`

Catalogue and audit are sealed for the parent's merge/capture-plan freeze.
