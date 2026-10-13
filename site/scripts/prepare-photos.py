"""Keep photo pixels/ICC/orientation, omit unrelated capture metadata from served JPEGs."""
from pathlib import Path
import struct
import hashlib

def orientation(payload):
    if not payload.startswith(b'Exif\0\0'):
        return None
    tiff=payload[6:]
    endian='<' if tiff[:2]==b'II' else '>'
    offset=struct.unpack(endian+'I',tiff[4:8])[0]
    count=struct.unpack(endian+'H',tiff[offset:offset+2])[0]
    for index in range(count):
        entry=tiff[offset+2+12*index:offset+14+12*index]
        tag,kind,length=struct.unpack(endian+'HHI',entry[:8])
        if tag==0x112 and kind==3 and length==1:
            return struct.unpack(endian+'H',entry[8:10])[0]
    return 1

def segments(data):
    assert data[:2]==b'\xff\xd8'
    cursor=2
    while cursor<len(data):
        start=cursor
        assert data[cursor]==255
        while data[cursor]==255:
            cursor+=1
        marker=data[cursor]
        cursor+=1
        if marker==0xDA:
            yield marker,b'',data[start:]
            return
        if marker==0xD9:
            yield marker,b'',data[start:cursor]
            return
        length=int.from_bytes(data[cursor:cursor+2],'big')
        end=cursor+length
        yield marker,data[cursor+2:end],data[start:end]
        cursor=end

def prepare(path):
    data=path.read_bytes()
    parsed=list(segments(data))
    value=next((orientation(payload) for marker,payload,_ in parsed if marker==0xE1 and payload.startswith(b'Exif\0\0')),1)
    # A minimal little-endian TIFF preserves the browser's image orientation.
    tiff=b'II\x2a\0'+struct.pack('<I',8)+struct.pack('<H',1)+struct.pack('<HHI',0x112,3,1)+struct.pack('<H',value)+b'\0\0'+b'\0\0\0\0'
    payload=b'Exif\0\0'+tiff
    out=b'\xff\xd8\xff\xe1'+struct.pack('>H',len(payload)+2)+payload
    out+=b''.join(segment for marker,_,segment in parsed if marker not in (0xE1,0xED,0xFE))
    old_scan=next(segment for marker,_,segment in parsed if marker==0xDA)
    new_scan=next(segment for marker,_,segment in segments(out) if marker==0xDA)
    assert hashlib.sha256(old_scan).digest()==hashlib.sha256(new_scan).digest()
    assert orientation(payload)==value
    temporary=path.with_suffix('.prepared.jpg')
    temporary.write_bytes(out)
    temporary.replace(path)

root=Path(__file__).resolve().parents[1]/'dist/assets'
photos=[*root.glob('IMG_*.jpg'),*root.glob('boxes/*.jpg')]
for photo in photos:
    prepare(photo)
print(f'Prepared {len(photos)} photo assets; JPEG scan data, colour profiles, and orientation unchanged.')
