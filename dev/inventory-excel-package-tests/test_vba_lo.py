"""LibreOffice(VBA 호환 모드)에서 재고관리매크로.bas 를 실제로 실행해 결과를 검증한다.
시험용 사본에서만 MsgBox 를 기록용 함수(TestMsg)로 바꾼다. 매크로 본문 로직은 그대로다."""
import subprocess, time, sys, os, re, datetime, uno
from com.sun.star.beans import PropertyValue
bas_path, xlsx_path = sys.argv[1], sys.argv[2]
code = open(bas_path,'rb').read().decode('utf-8-sig').replace('\r\n','\n')
assert 'MsgBox' in code
test_code = ("Option VBASupport 1\n" + code.replace('Option Explicit\n','Option Explicit\n',1)).replace('MsgBox','TestMsg')
test_code += '''
Function TestMsg(ByVal prompt As String, Optional buttons, Optional title) As Long
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("사용방법")
    ws.Cells(1, 10).Value = ws.Cells(1, 10).Value & prompt & " || "
    TestMsg = 6
End Function
'''
p = subprocess.Popen(['soffice','--headless','--invisible','--norestore','--accept=socket,host=localhost,port=2002;urp;'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    local = uno.getComponentContext(); resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    for _ in range(60):
        try: ctx = resolver.resolve("uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext"); break
        except Exception: time.sleep(1)
    else: sys.exit('LibreOffice 연결 실패')
    smgr = ctx.ServiceManager; desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    def pv(n,v): x=PropertyValue(); x.Name=n; x.Value=v; return x
    doc = desktop.loadComponentFromURL("file://"+xlsx_path,"_blank",0,(pv("Hidden",True),))
    if not doc.BasicLibraries.hasByName("Standard"): doc.BasicLibraries.createLibrary("Standard")
    doc.BasicLibraries.loadLibrary("Standard"); lib = doc.BasicLibraries.getByName("Standard"); lib.insertByName("StockMacros", test_code)
    factory = smgr.createInstanceWithContext("com.sun.star.script.provider.MasterScriptProviderFactory", ctx)
    sp = factory.createScriptProvider(doc)
    def call(name):
        try:
            sp.getScript("vnd.sun.star.script:Standard.StockMacros.%s?language=Basic&location=document"%name).invoke((),(),())
        except Exception as e:
            print('매크로 실행 예외:', name, str(e)[:400]); raise
        doc.calculateAll()
    S = lambda n: doc.Sheets.getByName(n)
    def cell(sh,c,r): return S(sh).getCellByPosition(c,r)
    def rows(sh,ncol,first=1):
        out=[]; r=first
        while True:
            vals=[cell(sh,c,r) for c in range(ncol)]
            if all(v.String=='' for v in vals): break
            out.append([(v.Value if v.Type.value=='VALUE' else v.String) if False else v.String for v in vals]); r+=1
        return out
    log=lambda: cell('사용방법',9,0).String
    results=[]; ok=lambda m: (results.append(m), print('%2d %s OK'%(len(results),m)))
    today=datetime.date.today().isoformat()

    # 시나리오: 현재재고 일부 변경 + 빈 칸/문자 값(실수 입력) 포함
    master=rows('품목 마스터',6)
    assert len(master)==15
    # 재고 입력 변경: 장갑7.0 4->12(보충), 주사바늘 6->2(부족), 탄력붕대 11 유지, 반창고 현재재고 빈칸, 알코올솜 문자 'N/A'
    def setv(name,val):
        for i,r in enumerate(master,1):
            if r[0]==name:
                c=cell('품목 마스터',4,i)
                if val is None: c.setString('')
                elif isinstance(val,str): c.setString(val)
                else: c.setValue(val)
                return
        raise KeyError(name)
    setv('멸균 수술장갑 7.0',12); setv('주사바늘 23G',2); setv('부직포 반창고',None); setv('알코올 솜','N/A')
    doc.calculateAll()

    # ---- Weekly_Input ----
    call('Weekly_Input')
    w=rows('주간 재고 파악',6); assert len(w)==15, len(w)
    assert all(r[0]==today for r in w), [r[0] for r in w][:3]; ok('Weekly_Input: 15개 품목을 오늘 날짜(%s)로 입력'%today)
    m=dict((r[0],r) for r in rows('품목 마스터',6)); 
    for r in w:
        assert r[1]==m[r[1]][0] and r[2]==m[r[1]][1] and r[3]==m[r[1]][3], r
    assert [r[4] for r in w if r[1]=='멸균 수술장갑 7.0']==['12']; ok('품목명·보관위치·적정재고·실사수량이 품목 마스터와 일치')
    st=dict((r[1],r[5]) for r in w); assert st['멸균 수술장갑 7.0'].endswith('안정') and st['주사바늘 23G'].endswith('재고부족') and st['탄력붕대 4인치'].endswith('재고부족'); ok('상태 수식(❌/✅)이 입력되어 정상 계산됨: '+st['주사바늘 23G'])
    assert '15개 품목을 입력했습니다' in log(); ok('완료 안내 메시지 표시')
    call('Weekly_Input'); assert len(rows('주간 재고 파악',6))==30; ok('다시 실행하면 아래에 이어서 추가(30행), 기존 기록 보존')

    # ---- Request_Generate ----
    call('Request_Generate')
    q=rows('물품 청구서',6)
    exp=[]
    for r in rows('품목 마스터',6):
        try: cur=float(r[4]); par=float(r[3])
        except ValueError: continue          # 빈칸·문자는 건너뜀
        if r[4]!='' and cur<par: exp.append((r[0],int(par-cur)))
    assert sorted((r[2],int(float(r[5]))) for r in q)==sorted(exp), (q,exp); ok('Request_Generate: 재고부족 %d개만 청구, 수량 = 적정재고 − 현재재고'%len(exp))
    assert len({r[0] for r in q})==1 and re.match(r'^R\d{12}-\d{3}$',q[0][0]) and all(r[1]==today for r in q); ok('모든 행이 같은 청구번호(%s)와 오늘 날짜'%q[0][0])
    names=[r[2] for r in q]; assert '부직포 반창고' not in names and '알코올 솜' not in names; ok('현재재고가 빈칸이거나 문자(N/A)인 품목은 오류 없이 건너뜀')
    assert all(r[3] and r[4] for r in q); ok('보관위치·규격이 함께 기록됨')
    time.sleep(1.1); call('Request_Generate'); q2=rows('물품 청구서',6); assert len(q2)==2*len(exp) and len({r[0] for r in q2})==2; ok('다시 실행하면 새 청구번호로 이어서 추가 (총 %d행, 청구 2건)'%len(q2))
    # 부족 품목이 하나도 없을 때
    for i,r in enumerate(rows('품목 마스터',6),1): cell('품목 마스터',4,i).setValue(1000)
    doc.calculateAll(); before=len(rows('물품 청구서',6)); cell('사용방법',9,0).setString(''); call('Request_Generate')
    assert len(rows('물품 청구서',6))==before and '재고부족 품목이 없습니다' in log(); ok('부족 품목이 없으면 행을 추가하지 않고 안내만 표시')
    # 탭 이름이 틀렸을 때
    S('품목 마스터').setName('품목마스터'); cell('사용방법',9,0).setString(''); call('Weekly_Input')
    assert '시트를 찾을 수 없습니다' in log(); ok('탭 이름이 다르면 오류로 멈추지 않고 안내 메시지 표시')
    print('\n전체 %d개 통과'%len(results))
    doc.close(True)
finally:
    p.terminate()
