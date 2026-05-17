# spongeclub_homepage

스폰지클럽 과제 현황판 · Astro + Vercel.

## 데이터 소스

vault 레포(`spongeclub/spongeclub_1`)의 `02_mission/`, `99_meta/멤버목록.md`를 빌드 시 스캔한다.

- 로컬: 형제 디렉토리 `../spongeclub`을 자동 사용
- Vercel: 빌드 시 vault를 `./vault`로 shallow clone (`vercel.json` 참고)
- 환경변수 `VAULT_PATH`로 임의 경로 지정 가능

## 로컬 개발

```bash
npm install
npm run dev          # http://localhost:4321
npm run build
```

## 배포

Vercel에 GitHub 레포를 import 하면 `vercel.json`이 자동 인식된다.

- main 브랜치 push → Production
- PR push → Preview

vault 콘텐츠가 변경되어도 사이트 레포가 변하지 않으면 자동 빌드는 트리거되지 않는다 (다음 단계: vault → 사이트 자동 트리거).

## 라우트

- `/` — 매거진 랜딩 (이번 호 표지 + 지난 호 아카이브)
- `/issue/[week]/` — 주차별 이슈 (조별 기록 모음)
- `/board/` — 주차 탭 + 조별/전체 토글 과제 현황판
- `/w/[week]/[team]/[member]/` — 멤버별 주차 노트 (vault md 렌더링)
- `/member/[team]/[nickname]/` — 개인별 성장기록 (AI 성장 서사 + 주차 타임라인)
- `/keywords/` — 키워드·공유내용 분석 (주차별 + 종합)
- `/skills/` — 미션 노트에서 추출한 유용한 스킬·사이트 모음
- `/gallery/` — 완성된 산출물 큐레이션 갤러리

## AI 분석 데이터

`/member`·`/keywords` 는 `src/data/analysis.json` 을 읽는다. 이 파일은 미션 노트를
AI로 분석해 **빌드 전 1회 생성**하고 커밋하는 정적 데이터다 — 사이트 빌드 자체는
API 호출 없이 결정적으로 동작한다. 재생성 절차는 [`scripts/generate-analysis.md`](scripts/generate-analysis.md) 참고.
