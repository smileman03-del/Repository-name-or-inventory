import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import FormulaRule
sp=sys.argv[1]; out=sys.argv[2]
data=json.load(open(sp+'/sample.json',encoding='utf-8'))
wb=Workbook()
hdr_fill=PatternFill('solid',fgColor='0E5C56'); hdr_font=Font(bold=True,color='FFFFFF')
thin=Side(style='thin',color='CCCCCC'); box=Border(left=thin,right=thin,top=thin,bottom=thin)
def head(ws,cols,widths):
    ws.append(cols)
    for i,(c,w) in enumerate(zip(cols,widths),1):
        cell=ws.cell(1,i); cell.fill=hdr_fill; cell.font=hdr_font; cell.alignment=Alignment(horizontal='center'); cell.border=box
        ws.column_dimensions[cell.column_letter].width=w
    ws.freeze_panes='A2'
# 1. 품목 마스터
m=wb.active; m.title='품목 마스터'
head(m,['품목명','보관위치','규격/단위','적정재고','현재재고','상태'],[26,14,16,11,11,14])
for i,d in enumerate(data,2):
    m.append([d['name'],d['loc'],d['spec'],d['par'],d['stock'],f'=IF(E{i}="","",IF(E{i}<D{i},"❌ 재고부족","✅ 안정"))'])
for r in range(2,m.max_row+1):
    for c in range(1,7): m.cell(r,c).border=box
red=PatternFill('solid',bgColor='F7E6E2')
m.conditional_formatting.add('A2:F500',FormulaRule(formula=['AND($E2<>"",$E2<$D2)'],fill=red))
# 2. 주간 재고 파악
w=wb.create_sheet('주간 재고 파악')
head(w,['실사일','품목명','보관위치','적정재고','실사수량','상태'],[13,26,14,11,11,14])
# 3. 실시간 재고 대장 (부족 품목만 자동 표시)
r=wb.create_sheet('실시간 재고 대장')
head(r,['품목명','보관위치','규격/단위','적정재고','현재재고','부족수량'],[26,14,16,11,11,11])
# 4. 물품 청구서
q=wb.create_sheet('물품 청구서')
head(q,['청구번호','청구일','품목명','보관위치','규격/단위','청구수량'],[16,13,26,14,16,11])
# 안내 시트
g=wb.create_sheet('사용방법')
for line in ['병원 소모품 재고관리 템플릿','',
 '1. [품목 마스터]에 품목을 입력합니다. (예시 12개는 가상 데이터이니 지우고 사용하세요)',
 '2. 현재재고는 [주간 재고 파악]에서 실사한 값으로 갱신합니다.',
 '3. 상태 열은 수식입니다. 현재재고가 적정재고보다 작으면 재고부족으로 표시됩니다.',
 '4. 매크로(재고관리매크로.bas)를 쓰려면 .xlsm으로 저장하되, 구글 시트에 올릴 때는 .xlsx로 저장하세요.',
 '5. 구글 시트 연동은 README의 설치 순서를 따르세요.']:
    g.append([line])
g.column_dimensions['A'].width=90; g['A1'].font=Font(bold=True,size=14)
wb.save(out); print('saved',out)
