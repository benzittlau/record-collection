"""Validate the sealed middle research shard without modifying served catalogue data.

Run with the bundled Python runtime (Pillow is required). Only the dedicated
deep-middle-validation.json report is written. Stable positions are compared
against the initial deep-pass audit snapshot, including the prior Bowie fix.
"""
from pathlib import Path
import collections
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
rows = json.loads((ROOT / 'site/research/middle.json').read_text())
audit = json.loads((ROOT / 'site/research/deep-middle-audit.json').read_text())
decisions = {r['id']: r for r in audit['records']}
assert len(rows) == len(decisions) == 138
assert len({r['id'] for r in rows}) == 138
assert collections.Counter(r['box'] for r in rows) == {
    'upper-middle': 68, 'lower-middle': 70
}
assets = []
for row in rows:
    decision = decisions[row['id']]
    assert row['position'] == decision['position']
    assert row['box'] == decision['box']
    assert decision['status'] in {'capture_required', 'complete_reference_artwork'}
    assert set(decision['neededFaces']) in [set(), {'front', 'back'}]
    assert decision['reason'] and decision['evidence']
    if row['confidence'] == 'unknown':
        assert not row.get('cover') and not row.get('backUrl')
    if row['confidence'] != 'confirmed':
        assert decision['neededFaces'] == ['front', 'back']
    for field, source_field, audit_field in [
        ('cover', 'coverUrl', 'front'),
        ('backUrl', 'backSourceUrl', 'back'),
        ('label', 'labelUrl', None),
    ]:
        value = row.get(field)
        if not value:
            continue
        assert row.get(source_field), (row['id'], field)
        path = ROOT / 'site/dist' / value.lstrip('/')
        Image.open(path).verify()
        if audit_field:
            assert decision['finalArtwork'][audit_field] == value
            assert decision['finalArtwork'][audit_field + 'SourceUrl'] == row[source_field]
        assets.append({
            'id': row['id'], 'face': field,
            'path': str(path.relative_to(ROOT)),
            'sourceUrl': row[source_field],
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        })

gregorian = next(r for r in rows if r['id'] == 'lower-middle-07')
assert not gregorian.get('label')  # Misuploaded SPA189 is not SPA4034.
assert gregorian['cover'].endswith('-face.jpg')
assert gregorian['backUrl'].endswith('-face.jpg')
ringo = next(r for r in rows if r['id'] == 'upper-middle-30')
assert '36636136-3' in ringo['backUrl']  # Genuine SWAL3413 LP rear.
firebird = next(r for r in rows if r['id'] == 'lower-middle-05')
assert '13382055-1' in firebird['backUrl']  # Text sleeve, not Philips label.
report = {
    'records': 138,
    'validSourcedAssets': len(assets),
    'positionsPreserved': True,
    'unknownArtWithheld': True,
    'consistentCapturePairs': True,
    'noPendingAuditOutcomes': True,
    'independentArtworkReview': audit.get('qualityReview'),
    'summary': audit['summary'],
    'artworkPaths': assets,
}
(ROOT / 'site/research/deep-middle-validation.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n'
)
print(json.dumps({k: v for k, v in report.items() if k != 'artworkPaths'}, indent=2))
