from pathlib import Path
from PIL import Image, ImageStat
import json

root=Path(__file__).resolve().parents[1]
report=json.loads((root/'verification/browser-report.json').read_text())
rows=[]
for i,item in enumerate(report,1):
    file=root/f'screenshots/{i}-{item["name"]}.jpg'
    image=Image.open(file).convert('RGB')
    def metrics(im):
        variance=ImageStat.Stat(im).var
        return {'rgb_variance':[round(v,2) for v in variance],'mean_rgb_variance':round(sum(variance)/3,2),'unique_colors':len(im.getcolors(im.width*im.height))}
    row={'file':file.name,'bytes':file.stat().st_size,'dimensions':list(image.size),**metrics(image)}
    row['world']=metrics(image.crop((210,120,1040,620)))
    # Neon-dusk check: hot pink / magenta pixels from the sun glow, neon signs and HUD accents.
    neon=sum(1 for px in image.crop((210,120,1040,620)).getdata() if px[0]>140 and px[1]<120 and px[2]>90 and px[2]<220)
    row['neon_pixels']=neon
    car=item['diagnostics']['car']
    if car:
        coordinates=[int(max(0,min(1280 if j%2==0 else 720,v))) for j,v in enumerate(car['bounds'])]
        box=(coordinates[0],coordinates[1],coordinates[2],coordinates[3])
        row['car_region']={'bounds':box,**metrics(image.crop(box))}
    row['pass']=row['mean_rgb_variance']>500 and row['unique_colors']>10000 and row['bytes']<262144
    rows.append(row)
print(json.dumps(rows,indent=2))
(root/'verification/image-metrics.json').write_text(json.dumps(rows,indent=2)+'\n')
assert all(r['pass'] for r in rows)
assert rows[1]['bytes']>51200
assert rows[1]['car_region']['mean_rgb_variance']>250
assert rows[1]['car_region']['unique_colors']>1000
assert rows[1]['neon_pixels']>300 and rows[2]['neon_pixels']>300
