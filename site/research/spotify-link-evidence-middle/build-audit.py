"""Build the isolated Spotify proposal; never write to the physical catalogue."""
from pathlib import Path
import hashlib
import json
import time

ROOT = Path(__file__).resolve().parents[3]
E = Path(__file__).resolve().parent
source = ROOT / 'site/research/middle.json'
baseline_path = E / 'baseline.json'
baseline = json.loads(baseline_path.read_text()) if baseline_path.exists() else None
rows = baseline['records'] if baseline else [
    r for r in json.loads(source.read_text())
    if r['confidence'] == 'confirmed' and not r.get('spotifyId') and r.get('kind') != 'book']
mapping = json.loads((E / 'candidates.json').read_text())
records = []

for row in rows:
    proposal = mapping.get(row['id'], {})
    sid = proposal.get('accepted')
    record = {
        'id': row['id'], 'box': row['box'], 'position': row['position'],
        'title': row['title'], 'artist': row['artist'],
        'status': 'unresolved', 'spotifyId': None, 'spotifyUrl': None,
        'searched': proposal.get('searched', bool(proposal.get('queries'))),
        'queries': proposal.get('queries', []), 'verificationEvidence': [],
        'editionNotes': proposal.get('note'), 'reason': proposal.get('reason'),
        'candidates': [], 'rejections': proposal.get('rejections', []),
        'researchEvidenceFiles': list(dict.fromkeys(
            proposal.get('webEvidenceFiles', [])
            + [value for key in ('mbEvidenceFile', 'assistanceEvidence')
               for value in (proposal.get(key) if isinstance(proposal.get(key), list)
                             else [proposal[key]] if proposal.get(key) else [])])),
        'discoveryEvidence': proposal.get('discoveryEvidence', []),
    }
    for candidate in proposal.get('candidates', []):
        path = E / (candidate + '.json')
        if path.exists():
            data = json.loads(path.read_text())
            record['candidates'].append({
                'spotifyId': candidate, 'url': data['albumUrl'],
                'title': data.get('title'), 'artists': data.get('artists'),
                'trackCount': data.get('trackCount'),
                'evidenceFile': str(path.relative_to(ROOT))})
    if proposal.get('publisherUrl'):
        record['verificationEvidence'].append({
            'type': 'publisher_recording_or_programme',
            'url': proposal['publisherUrl'],
            'checks': proposal.get('checks')})
    record['verificationEvidence'].extend(proposal.get('additionalEvidence', []))
    if sid:
        path = E / (sid + '.json')
        data = json.loads(path.read_text())
        date = data.get('releaseDate') or next(
            (ld.get('datePublished') for ld in data.get('jsonLd', [])
             if isinstance(ld, dict) and ld.get('datePublished')), None)
        record.update(
            status='matched', spotifyId=sid, spotifyUrl=data['albumUrl'],
            spotifyTitle=data.get('title'), spotifyArtists=data.get('artists'),
            spotifyDate=date, spotifyTrackCount=data.get('trackCount'),
            reason=None, searched=True)
        record['verificationEvidence'].insert(0, {
            'type': 'primary_spotify_metadata', 'url': data['albumUrl'],
            'embedUrl': data['embedUrl'], 'evidenceFile': str(path.relative_to(ROOT)),
            'pageTitle': data.get('pageTitle'),
            'checks': proposal.get('checks',
                'Album title, credited artist and original core programme match '
                'the photographed LP identity. Digital mastering or edition may differ.')})
    records.append(record)

matched = sum(r['status'] == 'matched' for r in records)
searched = sum(r['searched'] for r in records)
complete = all(r['searched'] and (r['status'] == 'matched' or r['reason'])
               for r in records) and (E / 'sealed').exists()
out = {
    'version': 1,
    'scope': 'Middle boxes: confirmed non-book records with no existing Spotify ID',
    'canonicalSourceSha256': (baseline['canonicalSourceSha256'] if baseline
                              else hashlib.sha256(source.read_bytes()).hexdigest()),
    'status': 'complete' if complete else 'in_progress',
    'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'method': 'Web album/artist searches, MusicBrainz release links, direct public '
              'Spotify album/embed metadata, original LP programme comparison, '
              'publisher recording evidence and independent native-browser checks. '
              'Classical matches require the original performers and recording; '
              'complete remasters and expanded editions of the original album are allowed.',
    'summary': {'eligible': len(records), 'searched': searched, 'matched': matched,
                'unresolved': len(records) - matched},
    'records': records,
}
(ROOT / 'site/research/spotify-link-audit-middle.json').write_text(
    json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(out['summary'])
