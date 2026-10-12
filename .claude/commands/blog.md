---
description: 주제를 받아 조사→분석→작성→이미지→검수 5팀 파이프라인으로 블로그 글 패키지를 만든다
argument-hint: <블로그 주제>
---
주제: $ARGUMENTS

주제에서 영문 소문자 slug를 정하고 blog/output/<slug>/ 를 만든 뒤 다음 순서로 서브에이전트를 호출하세요.
1. blog-research → 2. blog-analysis → 3. blog-writer → 4. blog-image → 5. blog-review
검수가 반려하면 지적된 팀으로 돌려 수정 후 재검수 (최대 3회). 각 단계 끝에 산출물 파일이 실제로 생성됐는지 확인하세요.
완료 후 사용자에게 blog/output/<slug>/06_publish.md 위치와 검수 결과를 보고하고, 병원 담당자 최종 확인 전에는 발행하지 마세요.
