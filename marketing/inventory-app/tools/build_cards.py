"""판매 페이지용 카드 이미지 생성. 사용: python3 build_cards.py <원본 촬영 폴더(raw)> <출력 폴더>
원본 촬영은 mk_shots.js 로 만든다(가상 예제 데이터만 사용). 한글 글꼴이 필요하다(wqy-zenhei)."""
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
RAW, OUT = sys.argv[1], sys.argv[2]
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
INK=(20,33,31); INK2=(70,82,79); PINE=(14,74,70); PINE2=(10,57,53); PAPER=(242,240,234); MINT=(211,232,226); WHITE=(255,255,255)
def F(sz): return ImageFont.truetype(FONT, sz)
def text_w(d, t, f): return d.textlength(t, font=f)
def wrap(d, text, f, maxw):
    lines=[]
    for para in text.split('\n'):
        cur=''
        for word in para.split(' '):
            trial=(cur+' '+word) if cur else word
            if text_w(d, trial, f) <= maxw: cur=trial; continue
            if cur: lines.append(cur); cur=''
            if text_w(d, word, f) <= maxw: cur=word; continue
            for ch in word:                      # 한 낱말이 한 줄보다 길 때만 글자 단위
                if text_w(d, cur+ch, f) > maxw and cur: lines.append(cur); cur=ch
                else: cur+=ch
        lines.append(cur)
    return lines
def bold(d, xy, t, f, fill, w=1): d.text(xy, t, font=f, fill=fill, stroke_width=w, stroke_fill=fill)
def canvas(W,H,bg):
    im=Image.new('RGB',(W,H),bg); d=ImageDraw.Draw(im)
    lc=tuple(max(0,c-8) for c in bg) if sum(bg)>400 else tuple(min(255,c+8) for c in bg)
    for y in range(31,H,32): d.line((0,y,W,y),fill=lc,width=1)   # 앱과 같은 장부 줄무늬
    return im
def phone(path, w, tilt=0):
    im=Image.open(os.path.join(RAW,path)).convert('RGBA'); h=int(im.height*w/im.width); scr=im.resize((w,h),Image.LANCZOS)
    r=int(w*0.115); m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),r,fill=255)
    b=max(8,int(w*0.028)); W,H=w+2*b,h+2*b
    fr=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(fr)
    d.rounded_rectangle((0,0,W-1,H-1),r+b,fill=(16,28,26,255)); d.rounded_rectangle((2,2,W-3,H-3),r+b-2,outline=(66,84,80,255),width=3)
    fr.paste(scr,(b,b),m)
    pad=70; sh=Image.new('RGBA',(W+2*pad,H+2*pad),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle((pad,pad+26,pad+W,pad+26+H),r+b,fill=(10,30,28,120))
    sh=sh.filter(ImageFilter.GaussianBlur(26)); sh.alpha_composite(fr,(pad,pad))
    if tilt: sh=sh.rotate(tilt,resample=Image.BICUBIC,expand=True)
    return sh
def paste(im, layer, x, y): im.paste(layer,(x,y),layer)
def sheet_card(path, w, top_ratio):
    im=Image.open(os.path.join(RAW,path)).convert('RGB'); y0=int(im.height*top_ratio); crop=im.crop((0,y0,im.width,im.height)); h=int(crop.height*w/crop.width); crop=crop.resize((w,h),Image.LANCZOS)
    r=36; m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),r,fill=255)
    pad=60; sh=Image.new('RGBA',(w+2*pad,h+2*pad),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle((pad,pad+22,pad+w,pad+22+h),r,fill=(10,30,28,130)); sh=sh.filter(ImageFilter.GaussianBlur(22))
    bd=Image.new('RGBA',(w+6,h+6),(214,210,200,255)); bm=Image.new('L',(w+6,h+6),0); ImageDraw.Draw(bm).rounded_rectangle((0,0,w+5,h+5),r+3,fill=255); sh.paste(bd,(pad-3,pad-3),bm); sh.paste(crop,(pad,pad),m); return sh
def header(im, eyebrow, head, sub, dark=False):
    d=ImageDraw.Draw(im); W=im.width
    fg=WHITE if dark else INK; fg2=(205,224,219) if dark else INK2; pill=(255,255,255) if dark else PINE; pt=PINE2 if dark else WHITE
    f=F(30); tw=text_w(d,eyebrow,f); d.rounded_rectangle((72,76,72+tw+56,76+58),29,fill=pill); bold(d,(100,88),eyebrow,f,pt,0)
    fh=F(86); y=170
    for ln in head.split('\n'): bold(d,(72,y),ln,fh,fg,2); y+=108
    fs=F(37); y+=10
    for ln in wrap(d,sub,fs,W-144): d.text((72,y),ln,font=fs,fill=fg2); y+=52
    return y
def save(im, name): p=os.path.join(OUT,name); im.save(p,optimize=True); print(name, im.size)

W,H=1080,1350
# 01 재고현황
im=canvas(W,H,PAPER); y=header(im,'재고현황','부족한 품목,\n한눈에 보입니다','부서별 부족 개수 · 적정재고 대비 게이지 · "부족만 보기"'); p=phone('01_dashboard.png',560); paste(im,p,(W-p.width)//2,y+30); save(im,'01_재고현황.png')
# 02 물품청구
im=canvas(W,H,PAPER); y=header(im,'물품청구','부족한 것만 골라\n청구서까지','부족 품목 자동 선택 · 수량 조정 · 한 번에 생성'); p=phone('02_request.png',560); paste(im,p,(W-p.width)//2,y+30); save(im,'02_물품청구.png')
# 03 인쇄 (A4 문서)
im=canvas(W,H,PAPER); y=header(im,'청구서 인쇄','결재용 A4,\n바로 인쇄 · PDF 저장','담당 · 팀장 · 승인 결재란이 들어간 청구서'); pg=Image.open(os.path.join(RAW,'print_a4-1.png')).convert('RGB')
pw=760; ph=int(pg.height*pw/pg.width); pg=pg.resize((pw,ph),Image.LANCZOS); sh=Image.new('RGBA',(pw+140,ph+140),(0,0,0,0)); ImageDraw.Draw(sh).rectangle((70,90,70+pw,90+ph),fill=(10,30,28,110)); sh=sh.filter(ImageFilter.GaussianBlur(22))
bd=Image.new('RGB',(pw+4,ph+4),(200,196,186)); bd.paste(pg,(2,2)); sh.paste(bd,(68,68)); sh=sh.rotate(-2.2,resample=Image.BICUBIC,expand=True); paste(im,sh,(W-sh.width)//2,y+10); save(im,'03_청구서_인쇄.png')
# 04 입고 + 입고 취소
im=canvas(W,H,PAPER); y=header(im,'입고','청구서에서\n입고까지 이어집니다','남은 수량 자동 입력 · 나눠서 입고 · 입고 취소'); a=phone('04_receive_detail.png',500); b=sheet_card('08_receipt_modal.png',540,0.485); paste(im,a,30,y+30); paste(im,b,W-b.width+10,y+330); save(im,'04_입고.png')
# 05 재고파악
im=canvas(W,H,PAPER); y=header(im,'재고파악','정기 실사,\n놓치지 않게','부서별 D-day · 지남 표시 · 바뀐 수량을 실시간으로 확인'); a=phone('05_audit_select.png',470); b=phone('05b_audit_detail.png',470); paste(im,a,36,y+40); paste(im,b,W-b.width-36,y+150); save(im,'05_재고파악.png')
# 06 품목관리
im=canvas(W,H,PAPER); y=header(im,'품목관리','품목은 앱에서도,\n시트에서도','추가·수정·삭제 · 분류 자유 설정 · 엑셀 붙여넣기'); p=phone('06_manage.png',560); paste(im,p,(W-p.width)//2,y+30); save(im,'06_품목관리.png')
# 07 다크 모드
im=canvas(W,H,(12,24,22)); y=header(im,'다크 모드','야간 근무에도\n눈이 편하게','휴대폰 설정에 맞춰 밝은 화면 · 어두운 화면 자동 전환',dark=True); a=phone('07_dark_dashboard.png',470); b=phone('07b_dark_request.png',470); paste(im,a,36,y+40); paste(im,b,W-b.width-36,y+150); save(im,'07_다크모드.png')
# 08 설치 3단계
im=canvas(W,H,PAPER); d=ImageDraw.Draw(im); bold(d,(72,120),'설치는',F(96),INK,2); bold(d,(72,232),'3단계면 됩니다',F(96),PINE,2); d.text((72,360),'단계별 설명서가 함께 들어 있어요 (소요 약 25분 예상)',font=F(36),fill=INK2)
steps=[('1','구글 시트에 코드 붙여넣기','새 구글 시트를 만들고 Apps Script에 Code.gs 를 붙여넣어 실행하면 탭이 자동으로 만들어져요'),('2','웹 앱으로 배포하고 주소 연결','배포해서 받은 주소를 index.html 에 넣어요 (메모장 "모두 바꾸기"도 OK)'),('3','스마트폰에서 열어 바로 사용','GitHub Pages에 올린 주소를 폰으로 열고 홈 화면에 추가하면 앱처럼 써요')]
y=440
for n,t,s in steps:
    d.rounded_rectangle((72,y,W-72,y+196),28,fill=WHITE,outline=(217,213,202),width=2); d.ellipse((104,y+54,192,y+142),fill=PINE); bold(d,(135,y+66),n,F(56),WHITE,1)
    bold(d,(228,y+34),t,F(44),INK,1)
    for i,ln in enumerate(wrap(d,s,F(31),W-72-228-24)): d.text((228,y+98+i*42),ln,font=F(31),fill=INK2)
    y+=216
d.rounded_rectangle((72,y+10,W-72,y+190),24,fill=MINT)
for i,ln in enumerate(['구성: 앱(index.html) · 시트 연결 코드(Code.gs) · 설치 설명서','필요한 것: 구글 계정 · GitHub 계정(무료) · 별도 서버 불필요','소모품·재고 관리 전용입니다 (환자 개인정보는 넣지 않아요)']): d.text((104,y+34+i*52),ln,font=F(31),fill=PINE2)
save(im,'08_설치_3단계.png')
# 00 대표 썸네일 (1200x1200)
T=1200; im=canvas(T,T,PAPER); d=ImageDraw.Draw(im)
im2=Image.new('RGB',(T,520),PINE); im.paste(im2,(0,0)); d=ImageDraw.Draw(im)
for k in range(-1,12): d.line((k*120,520,k*120+260,0),fill=(20,96,90),width=2)
bold(d,(72,86),'병원 소모품',F(104),WHITE,2); bold(d,(72,208),'재고관리 시스템',F(104),WHITE,2); d.text((76,340),'청구 · 입고 · 정기 실사를 스마트폰에서',font=F(44),fill=(214,232,228))
x=76
for t in ['구글 시트 연동','서버비 없음','다크 모드']:
    f=F(32); tw=text_w(d,t,f); d.rounded_rectangle((x,414,x+tw+48,414+56),28,fill=(255,255,255)); bold(d,(x+24,425),t,f,PINE2,0); x+=tw+48+16
L=phone('02_request.png',330,tilt=7); C=phone('01_dashboard.png',400); R=phone('04_receive_detail.png',330,tilt=-7)
paste(im,L,40,600); paste(im,R,T-R.width-40,600); paste(im,C,(T-C.width)//2,540); save(im,'00_대표_썸네일_1200x1200.png')
