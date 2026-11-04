"""프로 판매 패키지 정적 점검: 파일 구성, 개인정보·실제 주소 노출, 설명서와 코드의 일치, 인코딩."""
import os, re, sys
pk = sys.argv[1]
fails = []
def fail(m): fails.append(m); print('  ✗', m)
def good(m): print('  ✓', m)

files = sorted(f for f in os.listdir(pk) if os.path.isfile(os.path.join(pk, f)))
if files == ['Code.gs', 'README.md', 'index.html']: good('파일 구성 = Code.gs, README.md, index.html')
else: fail(f'파일 구성이 다릅니다: {files}')
txt = {}
for f in files:
    raw = open(os.path.join(pk, f), 'rb').read()
    try: s = raw.decode('utf-8')
    except Exception: fail(f'{f}: UTF-8 이 아님'); continue
    if raw[:3] == b'\xef\xbb\xbf': fail(f'{f}: 불필요한 BOM')
    if '�' in s: fail(f'{f}: 깨진 문자(U+FFFD)')
    if '\r\n' in s: fail(f'{f}: CRLF 줄바꿈')
    txt[f] = s
if len(txt) == 3: good('3개 파일 모두 UTF-8(BOM 없음, LF), 깨진 문자 없음')

pats = {'병원명·지역': r'천안|본\s?정형|정형외과', '전화번호': r'\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b', '이메일': r'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}',
        '실제 Apps Script 주소': r'script\.google\.com/macros/s/[A-Za-z0-9_-]{15,}', '시트·드라이브 주소': r'docs\.google\.com/\S+|drive\.google\.com/\S+|spreadsheets/d/[A-Za-z0-9_-]{20,}',
        '계정명': r'smileman', 'base64 내장': r'data:[a-z]+/[a-z+.-]+;base64,', 'API 키': r'AKfy[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}'}
hit = 0
for f, s in txt.items():
    for k, p in pats.items():
        for m in re.finditer(p, s): fail(f'{f}: {k} 검출 → {m.group(0)[:50]}'); hit += 1
if not hit: good('병원명·전화번호·이메일·실제 주소·계정명·내장 이미지·키 검출 없음')
code, readme, app = txt.get('Code.gs', ''), txt.get('README.md', ''), txt.get('index.html', '')
ext = re.findall(r'https?://[A-Za-z0-9][^\s"\'<>)\]]*', app)
if ext: fail(f'index.html 에 외부 주소: {ext[:3]}')
else: good('index.html 은 외부 서버를 호출하지 않음(추적·CDN 없음)')

# 앱 ↔ 백엔드 계약
actions = set(re.findall(r"action:\s*'(\w+)'", app)) | set(re.findall(r"apiGet\('(\w+)'\)", app))
served = set(re.findall(r"(?:p\.action|action) === '(\w+)'", code))
if actions and actions <= served: good(f'앱이 호출하는 API {sorted(actions)} 를 Code.gs 가 모두 처리함')
else: fail(f'앱이 호출하지만 Code.gs 가 처리하지 않는 API: {sorted(actions - served)}')
# 설명서 ↔ 코드
funcs = set(re.findall(r'function (\w+)\(', code))
named = set(re.findall(r'`(\w+)`', readme)) & {'setupSheets', 'loadSampleData', 'onOpen'}
if named == {'setupSheets', 'loadSampleData', 'onOpen'} and named <= funcs: good(f'설명서가 안내하는 함수 {sorted(named)} 가 Code.gs 에 모두 있음')
else: fail('설명서가 안내하는 함수가 Code.gs 에 없음')
tabs = re.findall(r"var TAB_\w+ = '([^']+)'", code)
if len(tabs) == 4 and all(f'`{t}`' in readme for t in tabs): good('Code.gs 의 탭 4개(입고 기록 포함)가 모두 설명서에 설명되어 있음')
else: fail(f'탭 설명 누락: {tabs}')
menu = re.findall(r"addItem\('([^']+)'", code)
need = ['현황 대시보드', '물품 청구서 생성', '실사 완료 기록', '품목번호 채우기', '예제 데이터 지우기']
if all(any(k in m for m in menu) and k in readme for k in need): good('설명서가 안내하는 메뉴 5개가 Code.gs 메뉴와 일치')
else: fail('메뉴 이름이 설명서와 Code.gs 에서 다름')
handlers = re.findall(r"addItem\('[^']+',\s*'(\w+)'\)", code)
if all(h in funcs for h in handlers): good(f'메뉴 {len(handlers)}개가 호출하는 함수가 모두 정의되어 있음')
else: fail('메뉴가 호출하는 함수가 정의되지 않음')
# 설정값
for const in ['ORG_NAME', 'AUDIT_INTERVAL_DAYS']:
    if re.search(rf'const {const} = ', app) and const in readme: pass
    else: fail(f'설정값 {const} 가 앱 또는 설명서에 없음')
else: good('설정값(ORG_NAME, AUDIT_INTERVAL_DAYS)이 앱과 설명서에 모두 있음')
decl = re.findall(r'const SCRIPT_URL = "SCRIPT_URL_HERE";', app)
if len(decl) == 1 and 'isConfigured' in app and re.search(r'/\^https\?:', app): good('SCRIPT_URL 선언 1곳 + URL 형태 검사(모두 바꾸기에도 안전)')
else: fail('SCRIPT_URL 선언/검사 구조가 다름')
bad = [w for w in ['DEPTS', 'DEPT_MERGE_MAP', 'normalizeDept', 'toISOString().slice'] if w in app]
if not bad: good('옛 고정 상수·UTC 날짜 계산 코드가 남아 있지 않음')
else: fail(f'앱에 남아 있으면 안 되는 코드: {bad}')
for w in ['.xlsx', '.xlsm', '.bas', '매크로', 'VBA']:
    if w in readme: fail(f'설명서에 엑셀/매크로 문구: {w}')
for w in ['New repository', 'Public', 'Upload files', 'Settings', 'Pages', 'Deploy from a branch', 'github.io', '내 저장소를 새로 만듭니다', '보안 안내', '주소 교체', '시간대', '정수']:
    if w not in readme: fail(f'설명서에 "{w}" 안내 없음')
else: good('설명서 필수 안내(GitHub 배포 단계·보안·주소 교체·시간대·정수) 모두 포함')
steps = re.findall(r'^### (\d+)\. ', readme, re.M)
if steps == [str(i) for i in range(1, 7)]: good('설치 단계 번호가 1~6으로 연속')
else: fail(f'설치 단계 번호가 이상함: {steps}')
screens = ['재고현황', '재고파악', '물품청구', '입고', '품목관리']
if all(k in readme for k in screens) and all(k in app for k in screens): good('앱 화면 5개 이름이 설명서와 앱에서 일치')
else: fail('앱 화면 이름이 설명서와 다름')
for w in ['입고 기록', '청구서 기준', '직접 입고', '일부 입고', '입고 완료', '더해', '덮어', '다크 모드', '부족만', '결재']:
    if w not in readme: fail(f'설명서에 입고·디자인 기능 안내 "{w}" 없음')
else: good('설명서에 입고(청구서 기준·직접·일부/완료)·재고파악과의 차이·다크 모드·결재용 인쇄 안내가 모두 있음')
ext_res = re.findall(r'(?:src|href)\s*=\s*["\'](?!#)[^"\']+["\']', app)
if ext_res: fail(f'앱이 외부 자원을 불러옴: {ext_res[:3]}')
else: good('앱이 외부 글꼴·이미지·스크립트를 불러오지 않음(오프라인·추적 없음)')
print(); sys.exit(1 if fails else 0)
