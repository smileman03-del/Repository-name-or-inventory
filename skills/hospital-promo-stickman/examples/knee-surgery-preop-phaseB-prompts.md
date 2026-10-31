# Phase B: 무릎 수술 전 준비 안내 Omni Flash 영상 프롬프트 (6클립)

승인된 Phase A(`knee-surgery-preop-storyboard-phaseA.md`) 기준. 설정: 한국어 나레이션, 여성 음성, 16:9, 60초, Style 1 밝은 테마.

> 프롬프트 본문은 영상 모델용 영어이고, 나레이션만 한국어 원문을 따옴표 안에 그대로 넣었습니다. 각 클립은 단독으로 붙여 넣어 생성할 수 있습니다.

> 무릎관절염 영상과 캐릭터·음성 고정 블록이 같아서, 같은 채널 영상으로 통일감을 줍니다.

## 1. 공통 설정 요약 (검토용)

| 항목 | 내용 |
|---|---|
| 비율/길이 | 16:9, 60초, 약 10초 x 6클립, 720p 목표, 24 FPS |
| 스타일 | Style 1 Classic Minimalist 밝은 테마, 단순한 선 표정 허용 |
| 캐릭터 | 속 빈 원형 머리 검정 스틱맨 (고정 블록, 6클립 동일). 의료진은 같은 스틱맨이 서류판을 든 모습으로 구분 |
| 포인트 색 | 선명한 빨강(주의 표시), 부드러운 파랑(체크리스트·안내 도해), 따뜻한 금색(체크·병원·안심) |
| 나레이터 | 성인 여성, 표준 서울 한국어, 맑고 따뜻한 중저음 (고정 블록) |
| 오디오 흐름 | 클립 1에서 피아노 테마 확립, 클립 2~6은 연속 지시 문구 사용 |

### 고정 블록 (6개 프롬프트에 그대로 반복됨)

**캐릭터 블록**
```text
Use minimalist two-dimensional black line animation. Show the same consistent stick figure with a hollow circular head, occasional simple line expressions, no detailed facial features, no hair, no clothing, no filled body, stable proportions, connected line limbs, and uniform medium line weight. Exactly two arms and two legs are visible per figure. Each limb appears only in its current pose: raising or lowering the right arm replaces that arm's previous line, never leaving a resting arm beneath an active arm. The figure stays black; accent colors affect only props and graphic effects.
```

**음성 블록**
```text
One off-screen adult female narrator throughout, speaking Korean. Standard Seoul Korean accent, clear warm mid-low voice, medium-low pitch, gentle forward resonance, no raspiness or breathiness. Calm conversational delivery, restrained pitch variation, steady speaking pace, and close, dry studio sound. Keep the same vocal timbre, register, accent, pace, and recording quality throughout. Emotional progression belongs to the visuals and music; do not change the narrator's voice or switch to character dialogue.
```

## 2. 클립별 프롬프트

### 클립 1 (0:00-0:10) · 훅 · 수술 날짜가 정해지면

```text
**Output specification:** Approximately ten seconds, 16:9 aspect ratio, 720p target, 24 FPS, synchronized audio.
**Visual style:** Style 1 Classic Minimalist, light theme. Environment: a flat, uniform, digitally pure-white canvas with no shading, gradients, textures, shadows or 3D depth. Any trees, buildings or furniture are drawn only as simple black line icons on the white canvas.
**Character lock:** Use minimalist two-dimensional black line animation. Show the same consistent stick figure with a hollow circular head, occasional simple line expressions, no detailed facial features, no hair, no clothing, no filled body, stable proportions, connected line limbs, and uniform medium line weight. Exactly two arms and two legs are visible per figure. Each limb appears only in its current pose: raising or lowering the right arm replaces that arm's previous line, never leaving a resting arm beneath an active arm. The figure stays black; accent colors affect only props and graphic effects.
**Palette and accent roles:** black line art on pure white, with at most three saturated accent colors used only on props and graphic effects: vivid red for the small caution marks (exclamation mark and prohibition slash), soft blue for the checklist and guide diagrams, warm gold for checkmarks, the clinic and reassurance.
**Composition:** 16:9 left-center-right staging with lateral tracking, horizontal match cuts and deliberate clean negative space, with the lower third and a central area kept empty for later overlays.
**Style language:** Rapid scene changes, kinetic motion-graphic transformations, and frequent visual events, while preserving an identical stick-figure design, constant line weight, and strict temporal consistency.
**First frame (inherited):** Clean empty white canvas with a simple black line wall calendar icon (a blank grid, no numbers) at the center-right; the stick figure is entering from the far left edge.
**Timed beats:**
- [0–3s] A warm gold circle is drawn around one square of the blank calendar icon while the stick figure walks in from the left in a smooth lateral tracking shot.
- [3–7s] Above the figure's head a small black line question mark and a blank checklist card icon (empty checkbox rows, no writing) float up; the figure tilts its head with a puzzled simple line expression and scratches the head with one hand.
- [7–10s] The blank checklist card grows and glides to the center of the frame while the calendar slides out of frame to the right.
**Dialogue (Korean, audio-only):** "수술 날짜가 정해지면 무엇을 준비해야 할지 막막하시죠?" Audio voiceover only, strictly no speech bubbles, no dialogue boxes. Speak the quoted Korean line exactly once, without adding, omitting, paraphrasing, repeating, reordering, captioning, subtitling or visually transcribing any word.
**Narrator voice lock:** One off-screen adult female narrator throughout, speaking Korean. Standard Seoul Korean accent, clear warm mid-low voice, medium-low pitch, gentle forward resonance, no raspiness or breathiness. Calm conversational delivery, restrained pitch variation, steady speaking pace, and close, dry studio sound. Keep the same vocal timbre, register, accent, pace, and recording quality throughout. Emotional progression belongs to the visuals and music; do not change the narrator's voice or switch to character dialogue.
**Audio:** a quiet, thoughtful, gentle acoustic piano with subtle soft ambient synth establishes the musical theme for the whole video, calm and reassuring, with synchronized crisp SFX on physical actions. The narrator stays voice-first in the mix. Clip-specific SFX: A soft pen-drawing sound on the gold circle, light footsteps, a gentle pop as the question mark appears.
**Final frame (inherited by next clip):** A large blank checklist card with empty checkbox rows is centered on the white canvas, with the stick figure at its left edge.
**Negative constraints:** no photorealism, no 3D humanoid rendering, no pupils, realistic eyes or lips, no hair, no extra limbs, no malformed anatomy, no disconnected lines, no changing proportions, no changing line weight, no filled head, no body silhouette, no separate hand or foot shapes, no inverted theme polarity, no unexplained colors, no unintended characters, no irrelevant spectacle, no visible words, letters, numbers, captions, subtitles, interface copy, logos or watermarks (all signs, calendars, charts and screens are icon-only), no speech bubbles, no dialogue boxes, no gore, no blood, no surgical incision imagery, no abstract liquid or shape morphing, no altered, repeated or added dialogue.
```

### 클립 2 (0:10-0:20) · 통념 깨기 · 당일에 준비하면?

```text
**Output specification:** Approximately ten seconds, 16:9 aspect ratio, 720p target, 24 FPS, synchronized audio.
**Visual style:** Style 1 Classic Minimalist, light theme. Environment: a flat, uniform, digitally pure-white canvas with no shading, gradients, textures, shadows or 3D depth. Any trees, buildings or furniture are drawn only as simple black line icons on the white canvas.
**Character lock:** Use minimalist two-dimensional black line animation. Show the same consistent stick figure with a hollow circular head, occasional simple line expressions, no detailed facial features, no hair, no clothing, no filled body, stable proportions, connected line limbs, and uniform medium line weight. Exactly two arms and two legs are visible per figure. Each limb appears only in its current pose: raising or lowering the right arm replaces that arm's previous line, never leaving a resting arm beneath an active arm. The figure stays black; accent colors affect only props and graphic effects.
**Palette and accent roles:** black line art on pure white, with at most three saturated accent colors used only on props and graphic effects: vivid red for the small caution marks (exclamation mark and prohibition slash), soft blue for the checklist and guide diagrams, warm gold for checkmarks, the clinic and reassurance.
**Composition:** 16:9 left-center-right staging with lateral tracking, horizontal match cuts and deliberate clean negative space, with the lower third and a central area kept empty for later overlays.
**Style language:** Rapid scene changes, kinetic motion-graphic transformations, and frequent visual events, while preserving an identical stick-figure design, constant line weight, and strict temporal consistency.
**First frame (inherited):** A large blank checklist card with empty checkbox rows centered on the white canvas, the stick figure at its left edge.
**Timed beats:**
- [0–3s] The checklist card sharpens and settles at center while the stick figure steps beside it and turns toward it.
- [3–7s] The figure waves one hand dismissively in an easygoing "it will be fine" gesture; a small calendar square marker slides from a day-before square to the day-of square, and a vivid red exclamation mark rises above the checklist card.
- [7–10s] The dot of the red exclamation mark drops down, lands, and bounces as a simple capsule pill icon that bounces to the center of the frame.
**Dialogue (Korean, audio-only):** "당일에 준비하면 된다고 생각하기 쉽지만, 미리 확인할 것이 있습니다." Audio voiceover only, strictly no speech bubbles, no dialogue boxes. Speak the quoted Korean line exactly once, without adding, omitting, paraphrasing, repeating, reordering, captioning, subtitling or visually transcribing any word.
**Narrator voice lock:** One off-screen adult female narrator throughout, speaking Korean. Standard Seoul Korean accent, clear warm mid-low voice, medium-low pitch, gentle forward resonance, no raspiness or breathiness. Calm conversational delivery, restrained pitch variation, steady speaking pace, and close, dry studio sound. Keep the same vocal timbre, register, accent, pace, and recording quality throughout. Emotional progression belongs to the visuals and music; do not change the narrator's voice or switch to character dialogue.
**Audio:** Voiceover seamlessly continues the identical quiet, thoughtful piano and subtle soft ambient synth from clip 1, maintaining identical tempo, instrumentation, and optimistic narrative momentum. Synchronized crisp SFX on physical actions. The narrator stays voice-first in the mix. Clip-specific SFX: A light notification chime, a bouncy pop as the pill icon lands and bounces.
**Final frame (inherited by next clip):** A single simple capsule pill icon is centered on the white canvas, with the stick figure standing at the left looking at it.
**Negative constraints:** no photorealism, no 3D humanoid rendering, no pupils, realistic eyes or lips, no hair, no extra limbs, no malformed anatomy, no disconnected lines, no changing proportions, no changing line weight, no filled head, no body silhouette, no separate hand or foot shapes, no inverted theme polarity, no unexplained colors, no unintended characters, no irrelevant spectacle, no visible words, letters, numbers, captions, subtitles, interface copy, logos or watermarks (all signs, calendars, charts and screens are icon-only), no speech bubbles, no dialogue boxes, no gore, no blood, no surgical incision imagery, no abstract liquid or shape morphing, no altered, repeated or added dialogue.
```

### 클립 3 (0:20-0:30) · 약 확인

```text
**Output specification:** Approximately ten seconds, 16:9 aspect ratio, 720p target, 24 FPS, synchronized audio.
**Visual style:** Style 1 Classic Minimalist, light theme. Environment: a flat, uniform, digitally pure-white canvas with no shading, gradients, textures, shadows or 3D depth. Any trees, buildings or furniture are drawn only as simple black line icons on the white canvas.
**Character lock:** Use minimalist two-dimensional black line animation. Show the same consistent stick figure with a hollow circular head, occasional simple line expressions, no detailed facial features, no hair, no clothing, no filled body, stable proportions, connected line limbs, and uniform medium line weight. Exactly two arms and two legs are visible per figure. Each limb appears only in its current pose: raising or lowering the right arm replaces that arm's previous line, never leaving a resting arm beneath an active arm. The figure stays black; accent colors affect only props and graphic effects.
**Palette and accent roles:** black line art on pure white, with at most three saturated accent colors used only on props and graphic effects: vivid red for the small caution marks (exclamation mark and prohibition slash), soft blue for the checklist and guide diagrams, warm gold for checkmarks, the clinic and reassurance.
**Composition:** 16:9 left-center-right staging with lateral tracking, horizontal match cuts and deliberate clean negative space, with the lower third and a central area kept empty for later overlays.
**Style language:** Rapid scene changes, kinetic motion-graphic transformations, and frequent visual events, while preserving an identical stick-figure design, constant line weight, and strict temporal consistency.
**First frame (inherited):** A single simple capsule pill icon centered on the white canvas, with the stick figure standing at the left looking at it.
**Timed beats:**
- [0–3s] More capsule and round pill icons tumble in and settle around the first one, then gather together into a simple medicine bag icon held by the stick figure.
- [3–7s] A second identical stick figure holding a black line clipboard (the medical staff) steps in from the right; the first figure hands over the medicine bag, the clipboard figure nods, and a vivid red exclamation mark above the bag turns into a warm gold checkmark.
- [7–10s] The bag and checkmark shrink and slide to the right into the first row of a soft blue checklist card that appears, where the first checkbox is ticked in warm gold.
**Dialogue (Korean, audio-only):** "드시는 약은 모두 알려 주세요. 약에 따라 조정이 필요할 수 있어, 임의로 끊거나 계속 드시지 마세요." Audio voiceover only, strictly no speech bubbles, no dialogue boxes. Speak the quoted Korean line exactly once, without adding, omitting, paraphrasing, repeating, reordering, captioning, subtitling or visually transcribing any word.
**Narrator voice lock:** One off-screen adult female narrator throughout, speaking Korean. Standard Seoul Korean accent, clear warm mid-low voice, medium-low pitch, gentle forward resonance, no raspiness or breathiness. Calm conversational delivery, restrained pitch variation, steady speaking pace, and close, dry studio sound. Keep the same vocal timbre, register, accent, pace, and recording quality throughout. Emotional progression belongs to the visuals and music; do not change the narrator's voice or switch to character dialogue.
**Audio:** Voiceover seamlessly continues the identical quiet, thoughtful piano and subtle soft ambient synth from clip 1, maintaining identical tempo, instrumentation, and optimistic narrative momentum. Synchronized crisp SFX on physical actions. The narrator stays voice-first in the mix. Clip-specific SFX: Pills clattering softly, paper-handover rustle, a bright tick sound on the gold checkmark.
**Final frame (inherited by next clip):** A soft blue checklist card is centered on the white canvas with its first row ticked in warm gold, and the two stick figures stand at either side of it.
**Negative constraints:** no photorealism, no 3D humanoid rendering, no pupils, realistic eyes or lips, no hair, no extra limbs, no malformed anatomy, no disconnected lines, no changing proportions, no changing line weight, no filled head, no body silhouette, no separate hand or foot shapes, no inverted theme polarity, no unexplained colors, no unintended characters, no irrelevant spectacle, no visible words, letters, numbers, captions, subtitles, interface copy, logos or watermarks (all signs, calendars, charts and screens are icon-only), no speech bubbles, no dialogue boxes, no gore, no blood, no surgical incision imagery, no abstract liquid or shape morphing, no altered, repeated or added dialogue.
```

### 클립 4 (0:30-0:40) · 금식·검사 일정

```text
**Output specification:** Approximately ten seconds, 16:9 aspect ratio, 720p target, 24 FPS, synchronized audio.
**Visual style:** Style 1 Classic Minimalist, light theme. Environment: a flat, uniform, digitally pure-white canvas with no shading, gradients, textures, shadows or 3D depth. Any trees, buildings or furniture are drawn only as simple black line icons on the white canvas.
**Character lock:** Use minimalist two-dimensional black line animation. Show the same consistent stick figure with a hollow circular head, occasional simple line expressions, no detailed facial features, no hair, no clothing, no filled body, stable proportions, connected line limbs, and uniform medium line weight. Exactly two arms and two legs are visible per figure. Each limb appears only in its current pose: raising or lowering the right arm replaces that arm's previous line, never leaving a resting arm beneath an active arm. The figure stays black; accent colors affect only props and graphic effects.
**Palette and accent roles:** black line art on pure white, with at most three saturated accent colors used only on props and graphic effects: vivid red for the small caution marks (exclamation mark and prohibition slash), soft blue for the checklist and guide diagrams, warm gold for checkmarks, the clinic and reassurance.
**Composition:** 16:9 left-center-right staging with lateral tracking, horizontal match cuts and deliberate clean negative space, with the lower third and a central area kept empty for later overlays.
**Style language:** Rapid scene changes, kinetic motion-graphic transformations, and frequent visual events, while preserving an identical stick-figure design, constant line weight, and strict temporal consistency.
**First frame (inherited):** A soft blue checklist card centered with its first row ticked in warm gold; the two stick figures stand at either side of it.
**Timed beats:**
- [0–3s] The medical-staff figure walks out of frame as the second row of the checklist card opens, revealing a simple clock icon and an icon of food and a water cup side by side.
- [3–7s] The remaining stick figure reaches toward the food icon and stops its hand in mid-air; a vivid red prohibition circle with a diagonal slash appears over the food and water cup icons while the clock hands sweep around.
- [7–10s] The red prohibition mark turns into a warm gold checkmark and a folded guide paper icon rises from the checklist card, gliding to the center of the frame.
**Dialogue (Korean, audio-only):** "금식 시간과 검사 일정은 안내문에 적힌 대로 꼭 지켜 주세요." Audio voiceover only, strictly no speech bubbles, no dialogue boxes. Speak the quoted Korean line exactly once, without adding, omitting, paraphrasing, repeating, reordering, captioning, subtitling or visually transcribing any word.
**Narrator voice lock:** One off-screen adult female narrator throughout, speaking Korean. Standard Seoul Korean accent, clear warm mid-low voice, medium-low pitch, gentle forward resonance, no raspiness or breathiness. Calm conversational delivery, restrained pitch variation, steady speaking pace, and close, dry studio sound. Keep the same vocal timbre, register, accent, pace, and recording quality throughout. Emotional progression belongs to the visuals and music; do not change the narrator's voice or switch to character dialogue.
**Audio:** Voiceover seamlessly continues the identical quiet, thoughtful piano and subtle soft ambient synth from clip 1, maintaining identical tempo, instrumentation, and optimistic narrative momentum. Synchronized crisp SFX on physical actions. The narrator stays voice-first in the mix. Clip-specific SFX: A gentle ticking of the clock, a soft rising tone, a short stop-tap as the hand halts, a bright tick on the gold checkmark.
**Final frame (inherited by next clip):** A folded guide paper icon is centered on the white canvas, with the stick figure beside it.
**Negative constraints:** no photorealism, no 3D humanoid rendering, no pupils, realistic eyes or lips, no hair, no extra limbs, no malformed anatomy, no disconnected lines, no changing proportions, no changing line weight, no filled head, no body silhouette, no separate hand or foot shapes, no inverted theme polarity, no unexplained colors, no unintended characters, no irrelevant spectacle, no visible words, letters, numbers, captions, subtitles, interface copy, logos or watermarks (all signs, calendars, charts and screens are icon-only), no speech bubbles, no dialogue boxes, no gore, no blood, no surgical incision imagery, no abstract liquid or shape morphing, no altered, repeated or added dialogue.
```

### 클립 5 (0:40-0:50) · 입원 준비물

```text
**Output specification:** Approximately ten seconds, 16:9 aspect ratio, 720p target, 24 FPS, synchronized audio.
**Visual style:** Style 1 Classic Minimalist, light theme. Environment: a flat, uniform, digitally pure-white canvas with no shading, gradients, textures, shadows or 3D depth. Any trees, buildings or furniture are drawn only as simple black line icons on the white canvas.
**Character lock:** Use minimalist two-dimensional black line animation. Show the same consistent stick figure with a hollow circular head, occasional simple line expressions, no detailed facial features, no hair, no clothing, no filled body, stable proportions, connected line limbs, and uniform medium line weight. Exactly two arms and two legs are visible per figure. Each limb appears only in its current pose: raising or lowering the right arm replaces that arm's previous line, never leaving a resting arm beneath an active arm. The figure stays black; accent colors affect only props and graphic effects.
**Palette and accent roles:** black line art on pure white, with at most three saturated accent colors used only on props and graphic effects: vivid red for the small caution marks (exclamation mark and prohibition slash), soft blue for the checklist and guide diagrams, warm gold for checkmarks, the clinic and reassurance.
**Composition:** 16:9 left-center-right staging with lateral tracking, horizontal match cuts and deliberate clean negative space, with the lower third and a central area kept empty for later overlays.
**Style language:** Rapid scene changes, kinetic motion-graphic transformations, and frequent visual events, while preserving an identical stick-figure design, constant line weight, and strict temporal consistency.
**First frame (inherited):** A folded guide paper icon centered on the white canvas, with the stick figure beside it.
**Timed beats:**
- [0–3s] The guide paper unfolds and lifts out three simple icons that float in a neat row: an ID card, a medicine list sheet, and a folded set of comfortable clothes.
- [3–7s] The stick figure picks the icons one by one into a simple black line bag, and sets a ring icon and a wristwatch icon down beside the bag, leaving them out.
- [7–10s] The figure slings the bag over one shoulder and begins walking toward the right edge of the frame in a smooth lateral tracking shot.
**Dialogue (Korean, audio-only):** "신분증과 복용 약 목록, 편한 옷을 챙기고, 장신구는 빼고 오세요." Audio voiceover only, strictly no speech bubbles, no dialogue boxes. Speak the quoted Korean line exactly once, without adding, omitting, paraphrasing, repeating, reordering, captioning, subtitling or visually transcribing any word.
**Narrator voice lock:** One off-screen adult female narrator throughout, speaking Korean. Standard Seoul Korean accent, clear warm mid-low voice, medium-low pitch, gentle forward resonance, no raspiness or breathiness. Calm conversational delivery, restrained pitch variation, steady speaking pace, and close, dry studio sound. Keep the same vocal timbre, register, accent, pace, and recording quality throughout. Emotional progression belongs to the visuals and music; do not change the narrator's voice or switch to character dialogue.
**Audio:** Voiceover seamlessly continues the identical quiet, thoughtful piano and subtle soft ambient synth from clip 1, maintaining identical tempo, instrumentation, and optimistic narrative momentum. Synchronized crisp SFX on physical actions. The narrator stays voice-first in the mix. Clip-specific SFX: Paper unfolding, soft zipper and rustle sounds as items go in, light rhythmic footsteps.
**Final frame (inherited by next clip):** The stick figure with the bag on one shoulder walks toward the right of the frame in a continuous lateral tracking shot, with clean white space ahead.
**Negative constraints:** no photorealism, no 3D humanoid rendering, no pupils, realistic eyes or lips, no hair, no extra limbs, no malformed anatomy, no disconnected lines, no changing proportions, no changing line weight, no filled head, no body silhouette, no separate hand or foot shapes, no inverted theme polarity, no unexplained colors, no unintended characters, no irrelevant spectacle, no visible words, letters, numbers, captions, subtitles, interface copy, logos or watermarks (all signs, calendars, charts and screens are icon-only), no speech bubbles, no dialogue boxes, no gore, no blood, no surgical incision imagery, no abstract liquid or shape morphing, no altered, repeated or added dialogue.
```

### 클립 6 (0:50-1:00) · 마무리 · 문의 안내

```text
**Output specification:** Approximately ten seconds, 16:9 aspect ratio, 720p target, 24 FPS, synchronized audio.
**Visual style:** Style 1 Classic Minimalist, light theme. Environment: a flat, uniform, digitally pure-white canvas with no shading, gradients, textures, shadows or 3D depth. Any trees, buildings or furniture are drawn only as simple black line icons on the white canvas.
**Character lock:** Use minimalist two-dimensional black line animation. Show the same consistent stick figure with a hollow circular head, occasional simple line expressions, no detailed facial features, no hair, no clothing, no filled body, stable proportions, connected line limbs, and uniform medium line weight. Exactly two arms and two legs are visible per figure. Each limb appears only in its current pose: raising or lowering the right arm replaces that arm's previous line, never leaving a resting arm beneath an active arm. The figure stays black; accent colors affect only props and graphic effects.
**Palette and accent roles:** black line art on pure white, with at most three saturated accent colors used only on props and graphic effects: vivid red for the small caution marks (exclamation mark and prohibition slash), soft blue for the checklist and guide diagrams, warm gold for checkmarks, the clinic and reassurance.
**Composition:** 16:9 left-center-right staging with lateral tracking, horizontal match cuts and deliberate clean negative space, with the lower third and a central area kept empty for later overlays.
**Style language:** Rapid scene changes, kinetic motion-graphic transformations, and frequent visual events, while preserving an identical stick-figure design, constant line weight, and strict temporal consistency.
**First frame (inherited):** The stick figure with the bag on one shoulder walks toward the right of the frame in a continuous lateral tracking shot.
**Timed beats:**
- [0–3s] A simple black line clinic door appears at the right end of the path and the stick figure keeps walking toward it with the same direction and pace.
- [3–7s] The figure reaches the door, where a second identical stick figure holding a black line clipboard (the medical staff) waves a friendly greeting; a soft warm gold light spreads from the doorway.
- [7–10s] The gold light and both figures fade out gently, leaving a clean, empty, digitally pure-white frame with generous negative space in the center, held calmly for the final moment.
**Dialogue (Korean, audio-only):** "궁금한 점은 병원으로 문의해 주세요. 개인 상태에 따라 다를 수 있으니 담당 의료진의 안내를 따라 주세요." Audio voiceover only, strictly no speech bubbles, no dialogue boxes. Speak the quoted Korean line exactly once, without adding, omitting, paraphrasing, repeating, reordering, captioning, subtitling or visually transcribing any word.
**Narrator voice lock:** One off-screen adult female narrator throughout, speaking Korean. Standard Seoul Korean accent, clear warm mid-low voice, medium-low pitch, gentle forward resonance, no raspiness or breathiness. Calm conversational delivery, restrained pitch variation, steady speaking pace, and close, dry studio sound. Keep the same vocal timbre, register, accent, pace, and recording quality throughout. Emotional progression belongs to the visuals and music; do not change the narrator's voice or switch to character dialogue.
**Audio:** Voiceover seamlessly continues the identical quiet, thoughtful piano and subtle soft ambient synth from clip 1, maintaining identical tempo, instrumentation, and optimistic narrative momentum. Synchronized crisp SFX on physical actions. The narrator stays voice-first in the mix. Clip-specific SFX: Soft footsteps, a door-open chime, a warm resolving glow.
**Final frame (inherited by next clip):** A clean, empty, pure-white canvas with generous central negative space, held still for the post-production information card, with the piano resolving on a final soft chord.
**Negative constraints:** no photorealism, no 3D humanoid rendering, no pupils, realistic eyes or lips, no hair, no extra limbs, no malformed anatomy, no disconnected lines, no changing proportions, no changing line weight, no filled head, no body silhouette, no separate hand or foot shapes, no inverted theme polarity, no unexplained colors, no unintended characters, no irrelevant spectacle, no visible words, letters, numbers, captions, subtitles, interface copy, logos or watermarks (all signs, calendars, charts and screens are icon-only), no speech bubbles, no dialogue boxes, no gore, no blood, no surgical incision imagery, no abstract liquid or shape morphing, no altered, repeated or added dialogue.
```

## 3. 이어붙이기 가이드 (Stitching)

| 컷 | 앞 클립 마지막 상태 | 다음 클립 첫 상태 / 연결 |
|---|---|---|
| 1→2 | 중앙에 커진 빈 체크리스트 카드 | 같은 카드가 선명해지며 시작 |
| 2→3 | 중앙에서 튕기는 알약 아이콘 | 같은 알약 주위로 알약이 더 쏟아져 약 봉투가 됨 |
| 3→4 | 첫 칸에 금색 체크가 된 파랑 체크리스트 | 같은 카드의 둘째 칸이 열려 시계·음식 아이콘 등장 |
| 4→5 | 중앙으로 올라온 접힌 안내문 아이콘 | 같은 안내문이 펼쳐져 준비물 아이콘으로 나뉨 |
| 5→6 | 가방을 메고 오른쪽으로 걷는 스틱맨 | 같은 방향·속도로 걸어 병원 문에 도착 |

- 각 클립 끝 0.3~0.5초를 다듬어 이음새를 확인하고, 이음새마다 0.2초 안팎의 짧은 오디오 크로스페이드를 권장합니다.
- 요청한 전환이 실제 마지막 프레임에 반영됐는지는 생성된 영상으로 직접 확인해야 합니다.

## 4. 음성·음악 연속성 메모

1. 6개 프롬프트의 음성 블록이 글자 하나까지 같은지 검증했고, 충돌하는 음성 지시는 없습니다.
2. 클립 1에서 정한 피아노 테마를 클립 2~6이 같은 템포와 악기로 이어받도록 지시했습니다.
3. 생성 후 **직접 들어서** 화자의 음색, 음높이, 속도가 같은지 확인하세요. 한국어 음성은 이 모델에서 검증된 적이 없습니다.
4. 무릎관절염 영상과 같은 음성이 나오는지도 함께 비교해 보세요. 두 영상이 같은 채널에 올라가므로 화자가 같으면 좋습니다.

## 5. 나레이션 길이 점검

| 클립 | 한글 음절 수 | 판단 |
|---|---|---|
| 1 | 23 | 적정 |
| 2 | 28 | 적정 |
| 3 | 39 | 적정 |
| 4 | 24 | 적정 |
| 5 | 25 | 적정 |
| 6 | 42 | 적정 |

한국어 차분한 속도 기준 10초에 45~55음절이 한계입니다. 생성 결과에서 말이 잘리면 속도를 올리지 말고 문장을 줄여 다시 승인받으세요.

## 6. 후반 편집용 글자 (생성 영상에는 넣지 않음)

| 클립 | 글자 | 위치 |
|---|---|---|
| 1 | 수술 전 준비 | 하단 중앙 |
| 3 | 약은 모두 알려주세요 | 하단 중앙 |
| 4 | 금식·검사 안내문 확인 | 하단 중앙 |
| 6 | 병원 안내 카드 | 중앙, 5초 (카드 내용은 Phase A 문서 5번 참고) |

하단 소형 자막: 일반 안내이며 개인 상태에 따라 다를 수 있습니다.

## 7. 게시 전 반드시 확인

1. `knee-surgery-preop-guide-draft.md`의 `[ ]` 칸을 의료진이 채우고 확인했는지
2. 영상 3클립(약)과 5클립(장신구) 내용이 병원 기준과 맞는지
3. 영상 설명란에 "정확한 안내는 담당 의료진에게 확인하세요"를 넣었는지
4. 사전심의 대상 여부
