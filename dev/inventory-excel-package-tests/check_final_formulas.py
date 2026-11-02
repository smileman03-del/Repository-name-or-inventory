"""흐름이 끝난 최종 시트(final_state.json)를 엑셀로 만들어 LibreOffice로 재계산하고, 상태 수식이 모두 올바른지 검증한다."""
import json,sys,subprocess,os,shutil
from openpyxl import Workbook, load_workbook
work=sys.argv[1]
st=json.load(open(work+'/final_state.json',encoding='utf-8')); wb=Workbook(); wb.remove(wb.active)
for t,rows in st.items():
    ws=wb.create_sheet(t)
    for r in rows: ws.append([None if v=='' else v for v in r])
wb.save(work+'/final.xlsx'); shutil.rmtree(work+'/final_recalc',ignore_errors=True)
subprocess.run(['soffice','--headless','--convert-to','xlsx:Calc MS Excel 2007 XML','--outdir',work+'/final_recalc',work+'/final.xlsx'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=120)
f=load_workbook(work+'/final.xlsx'); v=load_workbook(work+'/final_recalc/final.xlsx',data_only=True); tot=0
for tab,key in [('품목 마스터',1),('주간 재고 파악',2)]:
    wf,wv=f[tab],v[tab]; n=0;bad=[]
    for r in range(2,wv.max_row+1):
        if wv.cell(r,key).value is None: continue
        n+=1; exp='❌ 재고부족' if wv.cell(r,5).value<wv.cell(r,4).value else '✅ 안정'; fm=wf.cell(r,6).value
        if not(isinstance(fm,str) and fm.startswith('=')) or wv.cell(r,6).value!=exp: bad.append((r,fm,wv.cell(r,6).value,exp))
    tot+=len(bad); print(f'  {tab}: {n}행 수식 계산 검증, 불일치 {len(bad)}건')
rt=v['실시간 재고 대장']; assert all(rt.cell(r,6).value>0 for r in range(2,rt.max_row+1) if rt.cell(r,1).value)
sys.exit(1 if tot else 0)
