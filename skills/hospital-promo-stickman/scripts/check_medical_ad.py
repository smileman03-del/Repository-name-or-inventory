#!/usr/bin/env python3
"""병원 홍보 문구 자동 검사 (보조 도구, 법률 자문 아님).

사용법:
    python3 check_medical_ad.py 파일.txt [파일2.txt ...]
    echo "문구" | python3 check_medical_ad.py -

종료 코드: 0 = 금지 표현 없음, 1 = 금지/주의 표현 발견, 2 = 입력 오류
"""
import re
import sys

# (분류, 정규식, 설명)
RULES = [
    ("치료효과 보장", r"완치|100\s*%|백\s*퍼센트|반드시\s*(낫|호전|좋아)|확실(히|한)\s*(효과|치료)|부작용\s*(이\s*)?(전혀\s*)?없|통증\s*제로|재발\s*(은\s*)?없", "효과 보장·단정 표현"),
    ("최상급/유일", r"최고|최초|유일|국내\s*1위|1\s*위|넘버\s*원|최첨단|최신\s*(기술|장비)\s*(보유\s*)?유일|명의|독보적|완벽", "최상급·유일성 표현"),
    ("타 병원 비교", r"타\s*(병원|의원)|다른\s*(병원|의원)(과|보다|와)|경쟁\s*병원|보다\s*(저렴|우수|뛰어)", "타 의료기관 비교"),
    ("치료경험담/후기", r"후기|경험담|치료\s*사례|제가\s*(수술|치료)|(수술|치료)\s*받고\s*(나서\s*)?(좋아|나았|호전)|환자\s*인터뷰|만족도", "치료경험담·후기"),
    ("전후 비교", r"전\s*/\s*후|전후\s*비교|before\s*/?\s*after|치료\s*(전|후)\s*(비교|사진|모습)|수술\s*(전|후)\s*(비교|사진|모습)", "전후 비교"),
    ("공포 조장", r"방치(하면|시)|평생\s*(못|고생)|큰일|돌이킬\s*수\s*없|늦으면|수술\s*안\s*하면", "공포·불안 조장"),
    ("환자 유인", r"무료|공짜|할인|이벤트\s*가|경품|사은품|증정|0\s*원|특가", "환자 유인 소지"),
    ("통계/수치 주의", r"성공률|\d+\s*(%|퍼센트)|만\s*(건|명)\s*(이상\s*)?(수술|시술|치료)", "출처 없는 수치·통계"),
]

# 권장 문구 (없으면 경고만, 실패 아님)
RECOMMENDED = [
    ("상담 권유", r"상담|문의|진료|내원"),
    ("개인차 고지", r"개인(에|차)|사람마다|다를\s*수"),
]


def check(text):
    findings = []
    for idx, line in enumerate(text.splitlines(), 1):
        for category, pattern, desc in RULES:
            for m in re.finditer(pattern, line, flags=re.IGNORECASE):
                findings.append((idx, category, m.group(0), desc, line.strip()))
    warnings = [name for name, pat in RECOMMENDED if not re.search(pat, text)]
    return findings, warnings


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    exit_code = 0
    for path in argv[1:]:
        try:
            text = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
        except OSError as e:
            print(f"[오류] {path}: {e}")
            return 2
        findings, warnings = check(text)
        name = "stdin" if path == "-" else path
        print(f"=== {name} ===")
        if findings:
            exit_code = 1
            for idx, cat, word, desc, line in findings:
                print(f"  ✗ {idx}행 [{cat}] '{word}' - {desc}\n      > {line}")
        else:
            print("  ✓ 금지 표현이 발견되지 않았습니다. (사람의 최종 검수는 여전히 필요)")
        for w in warnings:
            print(f"  ! 권장 요소 없음: {w}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
