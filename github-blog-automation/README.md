# 🤖 GitHub 블로그 자동화 프로젝트

Claude AI + GitHub Actions로 매일 자동으로 블로그 포스트를 생성하는 프로젝트입니다.

## ✨ 주요 기능

- 🕘 **매일 자동 포스팅**: 매일 오전 9시(KST)에 자동으로 블로그 글 생성
- 🎯 **주제 자동 선택**: 미리 설정한 주제 목록에서 랜덤 선택
- ✍️ **수동 실행 지원**: GitHub Actions에서 원하는 주제로 즉시 생성 가능
- 📱 **완전 무료**: GitHub Pages + GitHub Actions 무료 플랜 활용

## 🚀 빠른 시작 (5단계)

### 1단계: 레포지토리 생성

GitHub에서 새 레포지토리를 생성합니다.
- 이름: `yourusername.github.io` (GitHub Pages 블로그용)
- 또는 일반 이름으로 생성 후 Pages 설정

### 2단계: 파일 업로드

이 프로젝트의 모든 파일을 레포지토리에 업로드합니다.

```bash
git clone https://github.com/yourusername/yourusername.github.io
# 파일들을 복사한 뒤
git add .
git commit -m "초기 설정"
git push
```

### 3단계: API 키 설정 (중요!)

1. [Anthropic Console](https://console.anthropic.com)에서 API 키 발급
2. GitHub 레포지토리 → **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** 클릭
4. Name: `ANTHROPIC_API_KEY`, Value: 발급받은 API 키 입력

### 4단계: GitHub Pages 활성화

1. 레포지토리 **Settings** → **Pages**
2. Source: `Deploy from a branch`
3. Branch: `main` / `(root)` 선택
4. **Save** 클릭

### 5단계: 확인

- Actions 탭에서 워크플로우가 정상 등록되었는지 확인
- 수동 실행 테스트: Actions → `Auto Blog Post Generator` → `Run workflow`

## ⚙️ 커스터마이즈

### 자동 주제 변경 (`scripts/generate_post.py`)

```python
AUTO_TOPICS = [
    "최신 기술 트렌드",    # ← 원하는 주제로 교체
    "개발 팁과 노하우",
    # ... 원하는 주제 추가
]
```

### 포스팅 시간 변경 (`.github/workflows/auto-post.yml`)

```yaml
schedule:
  - cron: '0 0 * * *'  # UTC 기준, 한국시간 오전 9시
  # 예시: 오후 2시(KST) = UTC 5시 → '0 5 * * *'
```

### 블로그 정보 변경 (`_config.yml`)

```yaml
title: "내 블로그 이름"
description: "블로그 설명"
author: "내 이름"
url: "https://yourusername.github.io"
```

## 💰 비용

| 항목 | 비용 |
|------|------|
| GitHub Pages | 무료 |
| GitHub Actions | 무료 (월 2,000분) |
| Claude API | 사용량에 따라 과금 (매일 1포스트 ≈ 약 $0.01 미만) |

## 📁 프로젝트 구조

```
├── .github/
│   └── workflows/
│       └── auto-post.yml    # 자동화 워크플로우
├── _posts/                  # 블로그 포스트 저장소
├── scripts/
│   └── generate_post.py     # Claude API 포스트 생성 스크립트
├── _config.yml              # Jekyll 설정
├── Gemfile                  # Ruby 의존성
└── index.html               # 홈페이지
```

## 🛠️ 문제 해결

**Actions가 실패할 때:**
- Secrets에 `ANTHROPIC_API_KEY`가 올바르게 설정되었는지 확인
- Actions 탭에서 에러 로그 확인

**블로그가 표시되지 않을 때:**
- Settings → Pages에서 활성화 여부 확인
- `_config.yml`의 `url` 설정 확인

## 📞 지원

문제가 있으면 Issues 탭에 남겨주세요!
