"""Independently verify staged links against public Spotify album metadata.

This reads album pages only. It does not request audio, account tokens, or
private Spotify endpoints. Existing successful checks are reused.
"""
import argparse
import base64
import concurrent.futures
import datetime
import hashlib
import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'research' / 'spotify-link-verification'


def verify(album_id):
    assert re.fullmatch(r'[A-Za-z0-9]{22}', album_id), album_id
    path = CACHE / f'{album_id}.json'
    if path.exists():
        cached = json.loads(path.read_text())
        if cached.get('verified') and len(cached.get('tracks', [])) == cached.get('trackCount'):
            return cached
    url = f'https://open.spotify.com/album/{album_id}'
    try:
        with urllib.request.urlopen(url, timeout=25) as response:
            raw = response.read()
        page = raw.decode('utf-8')
        match = re.search(r'<script id="initialState"[^>]*>(.*?)</script>', page, re.S)
        if not match:
            raise ValueError('Spotify album metadata is absent from the public page')
        state = json.loads(base64.b64decode(match.group(1)))
        album = state['entities']['items'][f'spotify:album:{album_id}']
        assert album['id'] == album_id
        assert album['type'] in ['ALBUM', 'COMPILATION'], album.get('type')
        artists = [a['profile']['name'] for a in album['artists']['items']]
        assert album.get('name') and artists
        tracks = []
        for item in album.get('tracksV2', {}).get('items', []):
            track = item.get('track', {})
            tracks.append({
                'name': track.get('name'),
                'artists': [a.get('profile', {}).get('name') for a in track.get('artists', {}).get('items', [])],
                'disc': track.get('discNumber'),
                'number': track.get('trackNumber'),
                'durationMs': track.get('duration', {}).get('totalMilliseconds'),
            })
        title = re.search(r'<title>(.*?)</title>', page, re.S)
        result = {
            'verified': True, 'id': album_id, 'url': url,
            'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'pageSha256': hashlib.sha256(raw).hexdigest(),
            'pageTitle': html.unescape(title.group(1)) if title else None,
            'title': album['name'], 'artists': artists, 'date': album.get('date'),
            'copyright': album.get('copyright', {}).get('items', []),
            'trackCount': album.get('tracksV2', {}).get('totalCount', len(tracks)),
            'tracks': tracks,
            'availabilityNote': 'Public album identity verified. Availability and full playback depend on the listener’s region, account, and browser.',
        }
        if len(tracks) < result['trackCount']:
            # Public album pages paginate after 30 tracks. The official embed
            # supplies the complete list without account credentials.
            embed_url = f'https://open.spotify.com/embed/album/{album_id}'
            with urllib.request.urlopen(embed_url, timeout=25) as response:
                embed_raw = response.read()
            embed_page = embed_raw.decode('utf-8')
            embed_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', embed_page, re.S)
            assert embed_match, 'Spotify embed metadata is absent'
            embed_data = json.loads(embed_match.group(1))
            entity = embed_data['props']['pageProps']['state']['data']['entity']
            assert entity['uri'] == f'spotify:album:{album_id}'
            assert entity['name'] == result['title']
            complete = entity['trackList']
            assert len(complete) == result['trackCount'], 'Spotify embed track count differs'
            for index, track in enumerate(complete):
                if index < len(tracks):
                    assert track['title'] == tracks[index]['name'], 'Public page and embed tracks disagree'
                    continue
                credit = track.get('subtitle', '').replace('\\xa0', ' ').replace('\u00a0', ' ')
                tracks.append({
                    'name': track['title'],
                    'artists': [name.strip() for name in credit.split(',') if name.strip()],
                    'creditText': credit, 'disc': None, 'number': index + 1,
                    'durationMs': track['duration'],
                })
            result['completeTrackListSource'] = {
                'url': embed_url,
                'pageSha256': hashlib.sha256(embed_raw).hexdigest(),
                'note': 'Additional rows come from the official complete embed list. Its row numbers are sequential; disc numbering is not supplied.',
            }
        assert len(tracks) == result['trackCount'], 'Incomplete Spotify programme metadata'
    except Exception as error:
        result = {'verified': False, 'id': album_id, 'url': url, 'error': str(error)}
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--album', action='append', default=[])
    args = parser.parse_args()
    ids = set(args.album)
    for shard in ['left', 'middle', 'right']:
        path = ROOT / 'research' / f'spotify-link-audit-{shard}.json'
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        rows = data if isinstance(data, list) else data['records']
        ids.update(row['spotifyId'] for row in rows if row.get('status') == 'matched')
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(verify, sorted(ids)))
    print(json.dumps({
        'checked': len(results), 'verified': sum(r['verified'] for r in results),
        'failures': [r for r in results if not r['verified']],
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
