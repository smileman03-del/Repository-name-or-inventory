#!/usr/bin/env python3
"""
GitHub 블로그 자동 포스트 생성기
Claude API를 활용하여 블로그 글을 자동으로 생성합니다.
"""

import os
import re
import json
import anthropic
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 한국 시간대
KST = timezone(timedelta(hours=9))

# ============================================================
# 설정 영역 - 필요에 맞게 수정하세요
# ============================================================
BLOG_NAME = "내 GitHub 블로그"
BLOG_LANGUAGE = "ko"  # 'ko' 한국어, 'en' 영어

# 자동 선택될 주제 목록 (TOPIC 환경변수 없을 때 사용)
AUTO_TOPICS = [
    "최신 기술 트렌드",
    "개발 팁과 노하우",
    "오픈소스 프로젝트 소개",
    "프로그래밍 언어 비교",
    "클라우드 서비스 활용법",
    "AI 도구 활용 가이드",
    "웹 개발 베스트 프랙티스",
    "데이터 분석 입문",
    "보안 기초 지식",
    "개발자 생산성 도구",
]

# 카테고리별 태그 매핑
CATEGORY_TAGS = {
    "기술": ["tech", "technology", "development"],
    "개발": ["dev", "coding", "programming"],
    "AI": ["ai", "machine-learning", "claude"],
    "일반": ["general", "blog"],
}
# ============================================================


def get_topic_and_category():
    """환경변수에서 주제와 카테고리를 가져오거나 자동 선택"""
    topic = os.environ.get("TOPIC", "").strip()
    category = os.environ.get("CATEGORY", "일반").strip()

    if not topic:
        import random
        topic = random.choice(AUTO_TOPICS)
        print(f"🎲 자동 선택된 주제: {topic}")
    else:
        print(f"📝 지정된 주제: {topic}")

    return topic, category


def generate_post_with_claude(topic: str, category: str) -> dict:
    """Claude API를 사용하여 블로그 포스트 생성"""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    prompt = f"""당신은 전문 기술 블로그 작가입니다.
다음 주제로 GitHub Pages Jekyll 블로그에 올릴 마크다운 포스트를 작성해주세요.

주제: {topic}
카테고리: {category}

반드시 아래 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):

{{
  "title": "블로그 포스트 제목",
  "description": "포스트 요약 (1-2문장)",
  "tags": ["태그1", "태그2", "태그3"],
  "content": "## 소개\\n\\n내용...\\n\\n## 본문\\n\\n내용...\\n\\n## 결론\\n\\n내용..."
}}

작성 규칙:
- 제목: 명확하고 흥미로운 한국어 제목
- 내용: 실용적이고 가치 있는 정보 위주, 최소 800자 이상
- 마크다운 문법 활용 (##, ###, **, *, ` ` `, - 등)
- 코드 예시가 있으면 코드블록 사용
- 독자가 실제로 도움이 되는 내용으로 작성
"""

    print(f"🤖 Claude API로 포스트 생성 중...")
    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text.strip()

    # JSON 파싱
    # 코드블록 안의 JSON 처리
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
    if json_match:
        response_text = json_match.group(1)

    post_data = json.loads(response_text)
    print(f"✅ 포스트 생성 완료: {post_data['title']}")
    return post_data


def create_jekyll_post(post_data: dict, category: str) -> Path:
    """Jekyll 형식의 마크다운 파일 생성"""
    now = datetime.now(KST)
    date_str = now.strftime("%Y-%m-%d")
    datetime_str = now.strftime("%Y-%m-%d %H:%M:%S +0900")

    # 파일명용 제목 (영문/숫자/하이픈만)
    title_slug = post_data['title']
    title_slug = re.sub(r'[^\w\s-]', '', title_slug)
    title_slug = re.sub(r'\s+', '-', title_slug.strip())
    title_slug = title_slug[:50]  # 최대 50자

    filename = f"{date_str}-{title_slug}.md"
    filepath = Path("_posts") / filename

    # 태그 합치기
    all_tags = post_data.get('tags', [])
    category_tags = CATEGORY_TAGS.get(category, CATEGORY_TAGS["일반"])
    all_tags = list(set(all_tags + category_tags))

    # Jekyll front matter 작성
    front_matter = f"""---
layout: post
title: "{post_data['title']}"
date: {datetime_str}
categories: [{category}]
tags: [{', '.join(all_tags)}]
description: "{post_data.get('description', '')}"
author: auto-generated
---

"""

    full_content = front_matter + post_data['content']

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(full_content)

    print(f"📄 파일 생성: {filepath}")
    return filepath


def main():
    print("=" * 50)
    print("🚀 GitHub 블로그 자동 포스트 생성기 시작")
    print("=" * 50)

    # API 키 확인
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise ValueError("❌ ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")

    # 주제 및 카테고리 가져오기
    topic, category = get_topic_and_category()

    # Claude로 포스트 생성
    post_data = generate_post_with_claude(topic, category)

    # Jekyll 포스트 파일 생성
    filepath = create_jekyll_post(post_data, category)

    print("=" * 50)
    print(f"✨ 완료! 새 포스트가 생성되었습니다.")
    print(f"   제목: {post_data['title']}")
    print(f"   파일: {filepath}")
    print("=" * 50)


if __name__ == "__main__":
    main()
