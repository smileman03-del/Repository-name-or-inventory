#!/usr/bin/env bash
# 전체 시험 실행: bash dev/inventory-excel-package-tests/run_all.sh
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; D="$ROOT/dev/inventory-excel-package-tests"; PK="$ROOT/product/inventory-excel-package"
W="$(mktemp -d)"; fail=0
step(){ echo; echo "■ $1"; shift; "$@" || { echo "  ✗ 실패"; fail=1; }; }
cp "$D/sample.json" "$W/" ; mkdir -p "$W/build"; cp "$D/sample.json" "$W/build/"
python3 "$D/make_xlsx.py" "$D" "$W/template.xlsx" >/dev/null && cmp -s <(unzip -p "$W/template.xlsx" xl/worksheets/sheet1.xml) <(unzip -p "$PK/소모품관리대장_템플릿.xlsx" xl/worksheets/sheet1.xml) && echo "■ 엑셀 템플릿이 샘플 데이터와 일치" || { echo "■ 엑셀 템플릿 불일치"; fail=1; }
cp "$PK/소모품관리대장_템플릿.xlsx" "$W/in.xlsx"
(cd "$W" && timeout 120 soffice --headless --convert-to xlsx:"Calc MS Excel 2007 XML" --outdir recalc in.xlsx >/dev/null 2>&1)
python3 "$D/dump_xlsx.py" "$W/in.xlsx" "$W/recalc/in.xlsx" "$W/xlsx_dump.json" >/dev/null
step "1/5 백엔드(Code.gs) 시험" node "$D/test_pkg_gs.js" "$PK/Code.gs"
step "2/5 앱 화면 + 백엔드 연동 시험" node "$D/test_e2e.js" "$W"
step "3/5 엑셀 → 재고 파악 → 청구서 전체 흐름" node "$D/test_full.js" "$PK" "$W/xlsx_dump.json" "$W"
step "4/5 최종 시트 수식 재계산 검증" python3 "$D/check_final_formulas.py" "$W"
pgrep -x soffice.bin >/dev/null && pkill -x soffice.bin; sleep 1
step "5/5 VBA 매크로 실행 시험(LibreOffice)" python3 "$D/test_vba_lo.py" "$PK/재고관리매크로.bas" "$W/in.xlsx"
echo; [ $fail -eq 0 ] && echo "★ 전체 통과" || echo "✗ 실패 항목 있음"; exit $fail
