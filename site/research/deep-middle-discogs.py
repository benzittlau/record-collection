"""Shared Discogs API limiter;2.5s aggregate start cadence and retry/backoff."""
from pathlib import Path
import fcntl,json,time,urllib.request
LOCK=Path('/tmp/record-collection-discogs-rate.lock');CLOCK=Path('/tmp/record-collection-discogs-rate.json')
def get_json(url,headers=None,timeout=25,attempts=4):
 h=headers or {'User-Agent':'FamilyRecordCollectionResearch/2.0 (personal LP artwork archive)','Accept':'application/json'}
 for attempt in range(attempts):
  try:
   with LOCK.open('a+') as lock:
    fcntl.flock(lock,fcntl.LOCK_EX)
    try:
     try:last=json.loads(CLOCK.read_text()).get('last',0)
     except Exception:last=0
     time.sleep(max(0,2.5-(time.time()-last)));CLOCK.write_text(json.dumps({'last':time.time()}))
     with urllib.request.urlopen(urllib.request.Request(url,headers=h),timeout=timeout) as r:
      limit=int(r.headers.get('X-Discogs-Ratelimit','25')); remaining=int(r.headers.get('X-Discogs-Ratelimit-Remaining','1'));data=json.loads(r.read())
      if remaining==0:time.sleep(60)
      return data
    finally:fcntl.flock(lock,fcntl.LOCK_UN)
  except Exception as error:
   if getattr(error,'code',None) in [400,401,404] or attempt==attempts-1:raise
   time.sleep([2,5,12,20][min(attempt,3)])
