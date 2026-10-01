# Read-only alpha analysis. Produces frame coordinates; never edits generated images.
from PIL import Image
from collections import deque
from pathlib import Path
import json
result={}
for filename in ['hero-atlas','hero-flail-atlas','enemies-atlas']:
    im=Image.open(Path(__file__).parent/'assets'/f'{filename}.png')
    a=im.getchannel('A'); step=3; w,h=im.size; gw=(w+step-1)//step;gh=(h+step-1)//step
    pixels=a.load(); mask={(x,y) for y in range(gh) for x in range(gw) if pixels[min(w-1,x*step),min(h-1,y*step)]>80}
    comps=[]
    while mask:
        start=mask.pop();q=deque([start]);xs=[];ys=[]
        while q:
            x,y=q.popleft();xs.append(x);ys.append(y)
            for nxt in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if nxt in mask:mask.remove(nxt);q.append(nxt)
        if len(xs)>150:comps.append({'box':[max(0,min(xs)*step-3),max(0,min(ys)*step-3),min(w,(max(xs)+1)*step+3),min(h,(max(ys)+1)*step+3)],'size':len(xs)})
    rows=2 if filename=='enemies-atlas' else 3
    comps.sort(key=lambda c:(int(((c['box'][1]+c['box'][3])/2)/(h/rows)),c['box'][0]))
    result[filename]=[c['box'] for c in comps]
    print(filename, len(comps), 'isolated sprites')
(Path(__file__).parent/'assets'/'atlas-frames.json').write_text(json.dumps(result))
