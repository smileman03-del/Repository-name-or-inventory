#!/usr/bin/env python3
"""운영 중인 재고관리 HTML을 판매용 템플릿으로 변환한다.

사용:
  python3 sanitize.py --src 원본.html --out product/inventory-template \
      --name "천안 본 정형외과" --name 천안본

변환 후 잔존 검사에 걸리면 종료 코드 1로 끝나며 결과 파일은 지워진다.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")

NEUTRAL_LOGO = (
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#0E5C56" '
    'stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
)

# 잔존하면 안 되는 패턴 (병원명 외 공통)
RESIDUE_PATTERNS = {
    "실제 Apps Script 주소": r"script\.google\.com/macros/s/[A-Za-z0-9_-]{20,}",
    "base64 이미지": r"data:image/[a-z]+;base64,",
    "전화번호": r"\b0\d{1,2}-\d{3,4}-\d{4}\b",
    "이메일": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--name", action="append", default=[], help="지울 병원명 표기(여러 번 지정 가능)")
    a = ap.parse_args()

    s = open(a.src, encoding="utf-8").read()
    log = []

    # 1) 제목
    s, c = re.subn(r"<title>.*?</title>", "<title>병원 재고 관리</title>", s, flags=re.S)
    log.append(("제목 교체", c))

    # 2) 병원명 (긴 표기부터 먼저 바꿔야 짧은 표기가 남지 않는다)
    total = 0
    for n in sorted(set(a.name), key=len, reverse=True):
        total += s.count(n)
        s = s.replace(n, "(병원명)")
    log.append(("병원명 교체", total))

    # 3) base64 로고 -> 중립 아이콘
    s, c = re.subn(r'<img[^>]*src="data:image/[a-z]+;base64,[^"]+"[^>]*>', NEUTRAL_LOGO, s)
    log.append(("로고 교체", c))

    # 4) 운영 URL 제거
    s, c = re.subn(r'const SCRIPT_URL\s*=\s*"[^"]*";', 'const SCRIPT_URL = "SCRIPT_URL_HERE";', s)
    log.append(("SCRIPT_URL 교체", c))

    if log[3][1] != 1:
        sys.exit("오류: SCRIPT_URL 선언을 정확히 1개 찾지 못했습니다. 원본 구조를 확인하세요.")

    # 5) 잔존 검사
    problems = []
    for label, pat in RESIDUE_PATTERNS.items():
        for m in re.finditer(pat, s):
            problems.append(f"{label}: {m.group(0)[:60]}")
    for n in a.name:
        if n in s:
            problems.append(f"병원명 잔존: {n}")

    # 6) 화면 JS 문법 검사
    scripts = re.findall(r"<script>(.*?)</script>", s, flags=re.S)
    if not scripts:
        problems.append("script 블록을 찾지 못함")
    else:
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(scripts[-1])
            tmp = f.name
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        os.unlink(tmp)
        if r.returncode != 0:
            problems.append("JS 문법 오류: " + r.stderr.strip()[:200])

    for k, v in log:
        print(f"  {k}: {v}건")
    if problems:
        print("\n[실패] 아래 문제 때문에 결과물을 만들지 않았습니다:")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    os.makedirs(a.out, exist_ok=True)
    open(os.path.join(a.out, "index.html"), "w", encoding="utf-8").write(s)
    for fn in ("Code.gs", "설치안내.md"):
        shutil.copy(os.path.join(ASSETS, fn), os.path.join(a.out, fn))
    print(f"\n[성공] {a.out} 에 index.html, Code.gs, 설치안내.md 생성 · 잔존 검사 통과 · JS 문법 OK")


if __name__ == "__main__":
    main()
