"""Validate proposal coverage and cached Spotify identity without catalogue writes."""
from pathlib import Path
import hashlib
import json
import re

E = Path(__file__).resolve().parent
ROOT = E.parents[2]
audit = json.loads((ROOT / 'site/research/spotify-link-audit-middle.json').read_text())
baseline = json.loads((E / 'baseline.json').read_text())
records = audit['records']
assert len(records) == 92
assert len({row['id'] for row in records}) == 92
assert [(row['id'], row['box'], row['position'], row['title'], row['artist'])
        for row in records] == [
        (row['id'], row['box'], row['position'], row['title'], row['artist'])
        for row in baseline['records']]
assert audit['canonicalSourceSha256'] == baseline['canonicalSourceSha256']

for row in records:
    assert row['searched']
    assert row['queries'], row['id']
    assert row['status'] in ('matched', 'unresolved')
    assert 'in progress' not in str(row).lower(), row['id']
    for evidence in row['verificationEvidence'] + row['rejections']:
        if evidence.get('evidenceFile'):
            assert (ROOT / evidence['evidenceFile']).exists(), evidence
    for file in row['researchEvidenceFiles']:
        assert (ROOT / file).exists(), file
    if row['status'] == 'unresolved':
        assert row['reason'] and row['spotifyId'] is None
        continue
    sid = row['spotifyId']
    assert re.fullmatch('[A-Za-z0-9]{22}', sid)
    metadata = json.loads((E / (sid + '.json')).read_text())
    assert metadata['embedEntity']['uri'] == 'spotify:album:' + sid
    assert row['spotifyUrl'] == 'https://open.spotify.com/album/' + sid
    assert row['spotifyTitle'] == metadata['title']
    assert row['spotifyTrackCount'] == len(metadata['embedEntity']['trackList']) >= 3
    assert metadata.get('pageTitle') and row['editionNotes']

def check_session_fields(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if any(part in key.lower() for part in ('token', 'secret')):
                assert item in ('[redacted session metadata]', None, ''), key
            check_session_fields(item)
    elif isinstance(value, list):
        for item in value:
            check_session_fields(item)

for file in E.glob('*.json'):
    check_session_fields(json.loads(file.read_text()))

current_hash = hashlib.sha256((ROOT / 'site/research/middle.json').read_bytes()).hexdigest()
result = {
    'passed': True,
    'coverage': audit['summary'],
    'canonicalSourceUnchangedAtValidation': current_hash == baseline['canonicalSourceSha256'],
    'checks': ['All 92 baseline IDs, positions and physical identities preserved',
               'Every record has a completed decision and search evidence',
               'Accepted IDs match direct primary Spotify album metadata',
               'Every referenced evidence file exists',
               'No unredacted runtime token or secret fields retained'],
}
(E / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False))
