"""Shared1.1-second global MusicBrainz limiter for the three artwork researchers.

Load via runpy.run_path(path). get_json(url,headers=None,timeout=25,attempts=4)
returns parsed JSON or raises the final request error. request_slot() may also
wrap an existing urllib request. Hold the lock through the response read.
"""
from pathlib import Path
from contextlib import contextmanager
import fcntl,json,time,urllib.request
LOCK=Path('/tmp/record-collection-musicbrainz-rate.lock')
CLOCK=Path('/tmp/record-collection-musicbrainz-rate.json')

@contextmanager
def request_slot():
 with LOCK.open('a+') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  try:
   try:last=json.loads(CLOCK.read_text()).get('last',0)
   except Exception:last=0
   time.sleep(max(0,1.1-(time.time()-last)))
   CLOCK.write_text(json.dumps({'last':time.time()}))
   yield
  finally:fcntl.flock(lock,fcntl.LOCK_UN)

def get_json(url,headers=None,timeout=25,attempts=4):
 default={'User-Agent':'FamilyRecordCollectionResearch/1.0 (personal family LP archive; https://musicbrainz.org)','Accept':'application/json'}
 for attempt in range(attempts):
  try:
   with request_slot():
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers or default),timeout=timeout) as r:
     return json.loads(r.read())
  except Exception as error:
   if getattr(error,'code',None) in [400,404] or attempt==attempts-1:raise
   time.sleep([1,3,8,15][min(attempt,3)])
