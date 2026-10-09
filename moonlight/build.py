from pathlib import Path
import base64, json
root=Path(__file__).parent
assets={}
for key,filename in [('harbor','harbor.png'),('hero','hero-atlas.png'),('enemies','enemies-atlas.png'),('flail','hero-flail-atlas.png'),('title','title.jpg'),('enemies2','act2-enemies.webp'),('motion','hero-motion.webp'),('cliffs','cliffs.webp')]:
    p=root/'assets'/filename
    mime={'jpg':'image/jpeg','webp':'image/webp'}.get(filename.rsplit('.',1)[1],'image/png')
    assets[key]=f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode() if p.exists() else ''
assets['frames']=json.loads((root/'assets/atlas-frames.json').read_text())
assets['frames2']=json.loads((root/'assets/act2-frames.json').read_text())
s=(root/'src/index.html').read_text().replace('/*STYLE*/',(root/'src/style.css').read_text()).replace('/*ASSETS*/','const ASSETS='+json.dumps(assets)+';').replace('/*GAME*/',(root/'src/game.js').read_text())
(root/'DentPhoto-Action.html').write_text(s)
print(f'Built {len(s.encode())/1024/1024:.1f} MB standalone action game')
