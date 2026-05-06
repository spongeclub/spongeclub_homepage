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

- `/` — 주차 탭 + 조별/전체 토글 현황판
- `/w/[week]/[team]/[member]/` — 멤버별 노트 (vault md 렌더링)
