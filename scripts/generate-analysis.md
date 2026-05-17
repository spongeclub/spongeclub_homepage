# analysis.json 재생성 절차

`src/data/analysis.json` 은 멤버별 성장기록과 주차별 키워드의 원천 데이터다.
미션 노트를 AI로 분석해 **빌드 전에 1회 생성**하고 커밋한다. 사이트 빌드 자체는
이 JSON 만 읽으므로 결정적이다(런타임/빌드 중 API 호출 없음).

## 언제 다시 생성하나

- 새 주차 제출이 마감됐을 때
- 멤버가 노트를 크게 수정했을 때

## 절차

vault: `~/Documents/spongeclub_1` · 제출 노트: `02_mission/<주차>/<조>/*.md`
(frontmatter `submitted: true` 인 노트만 분석 대상. 빈 템플릿은 제외.)

1. **조별 분석.** 6개 조 각각에 대해 AI 에이전트(또는 Claude 세션)로 그 조의 제출
   노트를 읽고 멤버별 분석 객체 배열을 만든다. 조별 결과를
   `.omc/analysis-fragments/<조>.json` 에 저장한다.

   각 멤버 객체 스키마:
   ```json
   {
     "team": "1조",
     "nickname": "Amy",
     "fullName": "임유영",
     "growthNarrative": "0주차→최신주차 성장 서사 (3-5문장)",
     "keywords": ["스킬 제작", "인터뷰 자동화", "..."],
     "weeklyHighlights": [
       { "week": 0, "title": "...", "summary": "1-2문장", "keywords": ["..."] }
     ]
   }
   ```
   - `weeklyHighlights` 는 실제 제출한 주차만.
   - `keywords` 는 재사용 가능한 간결한 명사구로 — 멤버 간 집계가 잘 되도록.

2. **병합.** 6개 fragment 를 `src/data/analysis.json` 으로 합친다:
   ```bash
   cd ~/PJ/spongeclub_homepage
   python3 - <<'PY'
   import json, glob, os
   members = []
   for f in sorted(glob.glob('.omc/analysis-fragments/*조.json')):
       members.extend(json.load(open(f, encoding='utf-8')))
   order = {f'{i}조': i for i in range(1, 7)}
   members.sort(key=lambda m: (order.get(m['team'], 9), m['nickname']))
   out = {'generatedAt': '<YYYY-MM-DD>', 'memberCount': len(members), 'members': members}
   json.dump(out, open('src/data/analysis.json', 'w', encoding='utf-8'),
             ensure_ascii=False, indent=2)
   print(f'{len(members)} members written')
   PY
   ```

3. **검증.** `VAULT_PATH=~/Documents/spongeclub_1 npm run build` 가 통과하는지 확인.

## 소비처

- `src/lib/analysis.ts` — `loadAnalysis()`, `getMemberAnalysis()`,
  `buildWeekKeywords()`, `buildOverallTopics()`
- `src/pages/member/[team]/[nickname].astro` — 개인별 성장기록
- `src/pages/keywords.astro` — 주차별·종합 키워드 분석

> 주차별 키워드 집계(`buildWeekKeywords`)는 `analysis.json` 에서 결정적으로 파생되므로
> JSON 에 따로 저장하지 않는다.
