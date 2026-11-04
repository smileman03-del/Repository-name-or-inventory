#!/usr/bin/env bash
# 프로 패키지 전체 시험: bash dev/inventory-app-tests/run_all.sh
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; D="$ROOT/dev/inventory-app-tests"; PK="$ROOT/product/inventory-app"
W="$(mktemp -d)"; fail=0
step(){ echo; echo "■ $1"; shift; "$@" || { echo "  ✗ 실패"; fail=1; }; }
syntax(){ cp "$PK/Code.gs" "$W/code_chk.js" && node --check "$W/code_chk.js" && python3 - "$PK/index.html" "$W/app_chk.js" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8').read(); open(sys.argv[2],'w').write(re.findall(r'<script>(.*?)</script>',s,re.S)[-1])
if re.search(r'onclick\s*=',s): sys.exit('금지 패턴 onclick= 사용')
PY
node --check "$W/app_chk.js" && echo "  Code.gs / 앱 JS 문법 OK, onclick 금지 패턴 없음"; }
rebuilt(){ python3 "$D/build_index.py" "$D" "$W/index_rebuilt.html" >/dev/null && cmp -s "$W/index_rebuilt.html" "$PK/index.html" && echo "  index.html 이 템플릿과 일치(수동 수정 흔적 없음)"; }
step "1/8 패키지 정적 점검(파일 구성·개인정보·앱↔백엔드·설명서↔코드)" python3 "$D/check_package.py" "$PK"
step "2/8 문법 검사" syntax
step "3/8 앱이 템플릿과 일치" rebuilt
step "4/8 백엔드(Code.gs) 시험" node "$D/test_backend.js" "$PK/Code.gs"
step "5/8 앱 4개 화면 + 백엔드 연동 시험(한국 시간대)" node "$D/test_app.js" "$PK" "$W"
step "6/8 신규 구매자 전체 흐름(설명서 그대로)" node "$D/test_buyer_flow.js" "$PK" "$W"
step "7/8 URL 교체 방식별 연결 시험" node "$D/test_url_replace.js" "$PK/index.html"
step "8/8 거친 입력·HTML 주입·좁은 화면 시험" node "$D/test_robust.js" "$PK" "$W"
echo; [ $fail -eq 0 ] && echo "★ 전체 통과" || echo "✗ 실패 항목 있음"; exit $fail
