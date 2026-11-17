"""판매 패키지 정적 점검: 파일 구성, 개인정보·실제 주소 노출, 설명서와 코드의 일치, 인코딩."""
import os, re, sys
pk = sys.argv[1]
fails, warns = [], []
def fail(m): fails.append(m); print('  ✗', m)
def good(m): print('  ✓', m)

files = sorted(f for f in os.listdir(pk) if os.path.isfile(os.path.join(pk, f)))
expect = ['Code.gs', 'README.md', 'index.html']
if files == expect: good('파일 구성 = Code.gs, README.md, index.html (엑셀·매크로 없음)')
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
if all(f in txt for f in expect): good('3개 파일 모두 UTF-8(BOM 없음, LF), 깨진 문자 없음')

# 개인정보 / 실제 주소
pats = {'병원명·지역': r'천안|본\s?정형|병원명', '전화번호': r'\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b', '이메일': r'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}',
        '실제 Apps Script 주소': r'script\.google\.com/macros/s/[A-Za-z0-9_-]{15,}', '시트·드라이브 주소': r'docs\.google\.com/\S+|drive\.google\.com/\S+|spreadsheets/d/[A-Za-z0-9_-]{20,}',
        '계정명': r'smileman', 'base64 내장': r'data:[a-z]+/[a-z+.-]+;base64,', 'API 키': r'AKfy[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}'}
hit = 0
for f, s in txt.items():
    for k, p in pats.items():
        for m in re.finditer(p, s): fail(f'{f}: {k} 검출 → {m.group(0)[:50]}'); hit += 1
if not hit: good('병원명·전화번호·이메일·실제 주소·계정명·키 검출 없음')
ext = [u for u in re.findall(r'https?://[A-Za-z0-9][^\s"\'<>)\]]*', txt.get('index.html', ''))]   # 호스트 이름이 있는 실제 주소만(주석 속 'https://...' 제외)
if ext: fail(f'index.html 에 외부 주소: {ext[:3]}')
else: good('index.html 은 외부 서버를 호출하지 않음(추적·CDN 없음)')

code, readme, app = txt.get('Code.gs', ''), txt.get('README.md', ''), txt.get('index.html', '')
# 설명서 ↔ 코드
funcs = set(re.findall(r'function (\w+)\(', code))
named = set(re.findall(r'`(\w+)`', readme)) & {'setupSheets', 'loadSampleData', 'onOpen', 'clearSampleData'}
miss = [n for n in named if n not in funcs]
if not miss and {'setupSheets', 'loadSampleData', 'onOpen'} <= named: good(f'설명서가 안내하는 함수 {sorted(named)} 가 Code.gs 에 모두 있음')
else: fail(f'설명서가 안내하는 함수가 없음: {miss}')
tabs = re.findall(r"var TAB_\w+ = '([^']+)'", code)
for t in tabs:
    if f'`{t}`' not in readme: fail(f'설명서에 탭 "{t}" 설명 없음')
if len(tabs) == 4 and all(f'`{t}`' in readme for t in tabs): good('Code.gs 의 탭 4개가 모두 설명서에 설명되어 있음')
menu = re.findall(r"addItem\('([^']+)'", code)
for label in ['예제 데이터 지우기', '실시간 재고 대장 새로고침', '물품 청구서 생성']:
    if not any(label in m for m in menu): fail(f'설명서가 안내하는 메뉴 "{label}" 가 Code.gs 메뉴에 없음')
if all(any(l in m for m in menu) for l in ['예제 데이터 지우기', '실시간 재고 대장 새로고침', '물품 청구서 생성']): good('설명서가 안내하는 메뉴 이름이 Code.gs 메뉴와 일치')
handlers = re.findall(r"addItem\('[^']+',\s*'(\w+)'\)", code)
bad = [h for h in handlers if h not in funcs]
if bad: fail(f'메뉴가 호출하는 함수가 정의되지 않음: {bad}')
else: good(f'메뉴 {len(handlers)}개가 호출하는 함수가 모두 정의되어 있음')
for w in ['.xlsx', '.xlsm', '.bas', '매크로', 'VBA', 'Alt + F11']:
    if w in readme: fail(f'설명서에 제외된 엑셀/매크로 관련 문구 남음: {w}')
if not any(w in readme for w in ['.xlsx', '.xlsm', '.bas', '매크로', 'VBA']): good('설명서에 엑셀 파일·매크로 안내가 남아 있지 않음')
if 'SCRIPT_URL_HERE' in readme and len(re.findall(r'var SCRIPT_URL = "SCRIPT_URL_HERE";', app)) == 1: good('설명서의 SCRIPT_URL_HERE 안내와 index.html 의 위치가 일치(1곳)')
else: fail('SCRIPT_URL_HERE 안내와 index.html 이 맞지 않음')
for w in ['중복', '정수', '시간대', '보안 안내', '주소 교체', '예제 데이터 지우기', '실시간 재고 대장']:
    if w not in readme: fail(f'설명서에 "{w}" 안내 없음')
if all(w in readme for w in ['중복', '정수', '시간대', '보안 안내', '주소 교체']): good('설명서 필수 안내(품목명 중복·정수·시간대·보안·주소 교체) 모두 포함')
for w in ['New repository', 'Public', 'Upload files', 'Settings', 'Pages', 'Deploy from a branch', 'github.io', '내 저장소를 새로 만듭니다']:
    if w not in readme: fail(f'설명서의 GitHub 배포 안내에 "{w}" 없음')
if all(w in readme for w in ['New repository', 'Public', 'Upload files', 'Settings', 'Pages', 'Deploy from a branch', 'github.io']): good('구매자용 GitHub 저장소 만들기·배포(Pages) 단계별 안내 포함')
steps = re.findall(r'^### (\d+)\. ', readme, re.M)
if steps == [str(i) for i in range(1, len(steps) + 1)] and len(steps) == 6: good('설치 단계 번호가 1~6으로 연속')
else: fail(f'설치 단계 번호가 이상함: {steps}')
print()
sys.exit(1 if fails else 0)
