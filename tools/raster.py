import json, numpy as np
from matplotlib.path import Path
from PIL import Image
from scipy import ndimage
d=json.load(open('tools/seoul_municipalities_geo.json'))
feats=d['features']
NX,NZ=264,220
LON0,LON1,LAT0,LAT1=126.76636,127.18567,37.42568,37.69860
LONC=(LON0+LON1)/2; LATC=(LAT0+LAT1)/2
KX=252/(LON1-LON0); KZ=KX/np.cos(np.radians(LATC))
print('KX',KX,'KZ',KZ,'height',(LAT1-LAT0)*KZ, LONC, LATC)
xs=np.arange(NX)+0.5-NX/2; zs=np.arange(NZ)+0.5-NZ/2
X,Z=np.meshgrid(xs,zs)
LON=LONC+X/KX; LAT=LATC-Z/KZ
pts=np.c_[LON.ravel(),LAT.ravel()]
gu=np.full(NX*NZ,-1,int)
names=[]
for i,f in enumerate(feats):
    names.append(f['properties']['name'])
    g=f['geometry']; polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    for p in polys:
        m=Path(p[0]).contains_points(pts)
        gu[m]=i
gu=gu.reshape(NZ,NX)
north={'종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구'}
isN=np.array([n in north for n in names])
side=np.where(gu<0,0,np.where(isN[np.clip(gu,0,None)],1,2))
# boundary seeds between north and south
seed=np.zeros_like(side,bool)
for dz,dx in [(0,1),(1,0)]:
    a=side[:NZ-dz,:NX-dx]; b=side[dz:,dx:]
    m=((a==1)&(b==2))|((a==2)&(b==1))
    seed[:NZ-dz,:NX-dx]|=m; seed[dz:,dx:]|=m
dist=ndimage.distance_transform_edt(~seed)


img=np.zeros((NZ,NX,3),np.uint8)
rs=np.random.RandomState(1); cols=rs.randint(80,230,(len(names),3))
img[gu>=0]=cols[gu[gu>=0]]
img[gu<0]=(40,90,160)
img[dist<3.5]=(80,160,230)


thr=np.full(dist.shape,3.6)
# 여의도: 남쪽(영등포) 강변은 강폭을 좁혀 섬을 살림
yeo=(side==2)&(X>-46)&(X<-15)&(Z>10)&(Z<36)
thr[yeo]=1.4
han=(dist<thr)
chars='abcdefghijklmnopqrstuvwxy'
rows=[]
for z in range(NZ):
    s=''.join('~' if han[z,x] else ('.' if gu[z,x]<0 else chars[gu[z,x]]) for x in range(NX))
    # RLE
    out=[];i=0
    while i<NX:
        j=i
        while j<NX and s[j]==s[i]: j+=1
        n=j-i; out.append((str(n) if n>1 else '')+s[i]); i=j
    rows.append(''.join(out))
cent=[]
for i,n in enumerate(names):
    zz,xx=np.nonzero((gu==i)&~han)
    cent.append([round(float(xx.mean()+0.5-NX/2),1),round(float(zz.mean()+0.5-NZ/2),1)])
eng=[f['properties']['name_eng'] for f in feats]
js=f"""// 자동 생성: tools/raster.py (통계청 2013 행정구역 경계 → {NX}x{NZ} 타일)
// 1타일 ≈ {37000/252:.0f}m. 서울 동서 끝(252타일)을 걸어서 약 1분.
export const NX = {NX}, NZ = {NZ};
export const LONC = {LONC:.6f}, LATC = {LATC:.6f}, KX = {KX:.4f}, KZ = {KZ:.4f};
export const GU = {json.dumps([{'name':n,'eng':e,'north':bool(isN[i]),'c':cent[i]} for i,(n,e) in enumerate(zip(names,eng))],ensure_ascii=False)};
// 행마다 RLE: 'a'~'y' = GU 인덱스, '~' = 한강, '.' = 서울 밖
export const ROWS = {json.dumps(rows)};
"""
open('src/seoulData.js','w').write(js)
print(len(js))
