"""엑셀을 구글 시트로 가져온 상태를 재현한다: 값은 재계산 결과, 수식 열은 수식 그대로(구글 시트 업로드와 동일)."""
import json,sys
from openpyxl import load_workbook
src,recalc,out=sys.argv[1:4]
f=load_workbook(src); v=load_workbook(recalc,data_only=True); dump={}
for ws in v.worksheets:
    rows=[]
    for r in range(1,ws.max_row+1):
        row=[]
        for c in range(1,ws.max_column+1):
            fv=f[ws.title].cell(r,c).value
            row.append('' if (fv is None) else (fv if isinstance(fv,str) and fv.startswith('=') else ('' if ws.cell(r,c).value is None else ws.cell(r,c).value)))
        rows.append(row)
    while rows and all(x=='' for x in rows[-1]): rows.pop()
    dump[ws.title]=rows
json.dump(dump,open(out,'w',encoding='utf-8'),ensure_ascii=False,default=str)
print('수식 보존 가져오기:',{t:len(r)-1 for t,r in dump.items()}, '| 마스터 F2 =',dump['품목 마스터'][1][5])
