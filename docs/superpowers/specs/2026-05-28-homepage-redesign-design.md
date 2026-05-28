# 스폰지클럽 홈페이지 리디자인 (디자인 시스템 적용)

> 작성: 2026-05-28 · 다다 + Claude
> 적용 대상: `spongeclub/spongeclub_homepage` (spongeclub-homepage.vercel.app)
> 형태: 라우트 8개 유지 · **디자인 스킨만 신규**

---

## 1. 배경

- 기존 홈페이지는 Astro 매거진으로 시작해 `[feat] Bauhaus 디자인` (커밋 `baba800`, 2026-05-21)으로 첫 비주얼 정리됨.
- 이번 리뉴얼은 인스타 매거진(@spongeclub, 스폰지타임즈)과 결을 맞추기 위해 **스폰지클럽 공식 디자인 토큰**으로 일원화하는 것이 목적.
- 라우트·정보구조는 그대로 유지. 토큰·컴포넌트·페이지 마크업만 신규.

자매 사이트와의 역할 분리는 그대로:
- `spongeclub_homepage` = **매거진** (이번 호 표지·MVP·조별 분석·아카이브)
- `selfishclub/spongeclub-community` = **셸 시스템** (로그인·세션·랭킹·게시판)

## 2. 디자인 토큰

### 컬러
| 변수 | 값 | 역할 |
|---|---|---|
| `--sc-bg-base` | `#FFFBED` | 페이지 기본 배경 (크림) |
| `--sc-bg-signature` | `#FFE67A` | 시그니처 옐로우 — 표지/배너 한정 |
| `--sc-surface-white` | `#FFFFFF` | 본문 카드 |
| `--sc-surface-dark` | `#1A1F36` | CTA / 구독 박스 (한 페이지 1~2번) |
| `--sc-text-primary` | `#1A1F36` | 본문 텍스트 |
| `--sc-text-on-dark` | `#FFE67A` | 다크네이비 위 텍스트 |
| `--sc-text-muted-low` | `rgba(26,31,54,.35)` | 캡션·placeholder |
| `--sc-text-muted-mid` | `rgba(26,31,54,.55)` | 보조 텍스트 |
| `--sc-text-muted-high` | `rgba(26,31,54,.70)` | 본문 보조 |
| `--sc-highlight-orange` | `rgba(255,152,0,.55)` | 형광펜 강조 (1~2단어) |
| `--sc-accent-yellow` | `#FFE200` | **신규** 포인트 — 도형/마커 |
| `--sc-accent-red` | `#E53330` | **신규** 포인트 — 도형/마커 |
| `--sc-accent-blue` | `#1756E8` | **신규** 포인트 — 도형/마커 |

### 모서리
| 변수 | 값 | 어디 |
|---|---|---|
| `--sc-radius-card` | `12px` | 카드 |
| `--sc-radius-small` | `8px` | 작은 카드·뱃지 |
| `--sc-radius-pill` | `999px` | 알약 라벨·CTA |

## 3. 폰트

| 변수 | 값 |
|---|---|
| `--sc-font-display` | `'NostalgicKiteDrifting', Pretendard, "Noto Sans KR", sans-serif` |
| `--sc-font-body` | `Pretendard, "Noto Sans KR", sans-serif` |

`NostalgicKiteDrifting`은 weight 400 단일 (한국 손글씨 둥둥체). 가짜 굵게(faux bold) 방지를 위해 제목에도 `font-weight: 400` 명시.

```css
@font-face {
  font-family: 'NostalgicKiteDrifting';
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2604-1@1.0/Griun_InaDoongdoong-Rg.woff2') format('woff2');
  font-weight: normal;
  font-display: swap;
}
```

**적용 규칙**
- 제목 (h1~h3, 표지 헤드, 섹션 헤딩) → `--sc-font-display`, weight 400, `letter-spacing: -0.01em`
- 본문 / 캡션 / UI 텍스트 → `--sc-font-body`, weight 400 / 500 / 700만 사용

## 4. 도형 ●■▲ — 섹션 성격별 매핑

| 도형 | 컬러 | 어디에 |
|---|---|---|
| ● 원 | `--sc-accent-blue` | **사람 섹션** — 멤버·성장기록·MVP·인사이트 |
| ■ 사각 | `--sc-accent-red` | **기록 섹션** — 주차·이슈·목차·미션 노트 |
| ▲ 삼각 | `--sc-accent-yellow` | **탐색 섹션** — 키워드·스킬·갤러리·신규 |

도형은 섹션 헤딩 좌측에 18~24px. 색은 도형에만 들어가고 헤딩 텍스트는 `--sc-text-primary`.

## 5. 메인 (/) 표지형 와이어

```
┌───────────────────────────────────────────────────────────────┐
│  spongeclub                  ISSUE · MEMBER · KEYWORDS · ☰    │ ← 크림
├───────────────────────────────────────────────────────────────┤
│   [ 파인애플 마을 풀-블리드 일러스트 — 6채(=6조) ]            │
│                                                               │
│   WEEK 04                           ← 둥둥체 라벨             │
│   이번 호 주제           ← 둥둥체 거대 헤드 (60~80px)        │
│   한 줄 부제             ← Pretendard Medium 500              │
│                                                               │
│   [ 목차 보기 → ]   [ 지난 호 ]   ← 다크네이비 pill / 텍스트 │
└───────────────────────────────────────────────────────────────┘

옐로우 #FFE67A 풀-블리드 띠 ── ■ 이번 호 목차 ── 조 6장
크림 ──────────────── ● 이번 호 MVP ──── 3장 (형광펜 1개 강조)
크림 ──────────────── ▲ 신규 스킬·발견 ── 4장
크림 ──────────────── ■ 지난 호 ──────── 가로 스크롤
다크네이비 #1A1F36 ─── "매주 한 호씩, 스폰지클럽." [구독하기 →]
푸터 ─── © spongeclub · 운영팀 · GitHub · Community
```

**제약**
- 시그니처 옐로우 풀 배너는 메인의 "이번 호 목차" **한 띠만**
- 다크네이비 풀 박스는 메인의 구독 CTA **하나만**
- 일러스트는 메인 1곳에만 사용

## 6. 페이지별 적용 패턴

| 라우트 | 헤딩 도형 | 컬러 | 헤더 패턴 |
|---|:---:|:---:|---|
| `/` | 섹션마다 변동 | 변동 | 풀-블리드 일러스트 표지 |
| `/board` | ■ | 빨강 | "현황판" 타이틀 + 주차 탭 |
| `/issue/[week]` | ■ | 빨강 | "Week N" 거대 헤드 + 조별 섹션 6개 |
| `/w/[week]/[team]/[member]` | ● | 파랑 | 멤버 이름 헤더 + md 본문 |
| `/member/[team]/[nickname]` | ● | 파랑 | 멤버 표지 + 성장 서사 + 주차 타임라인 |
| `/keywords` | ▲ | 노랑 | "키워드" 타이틀 + 종합/주차 토글 |
| `/skills` | ▲ | 노랑 | "스킬·발견" 타이틀 + 검색 + 카드 그리드 |
| `/gallery` | ▲ | 노랑 | "갤러리" 타이틀 + 큐레이션 그리드 |

> 메인 외 페이지에서는 시그니처 옐로우 풀 배너 X. 페이지 배경은 크림 통일.

## 7. 공통 컴포넌트

| 컴포넌트 | 스펙 |
|---|---|
| `<MagazineHeader>` | 크림, 좌상 `spongeclub`(둥둥체), 우상 글로벌 nav 4~5개 + 모바일 햄버거 |
| `<SectionHeading shape color>` | 좌측 도형 18~24px + 둥둥체 헤드 36~48px |
| `<Card>` | 화이트 + radius 12 + 그림자 `0 1px 2px rgba(26,31,54,.05)` |
| `<Pill>` | radius 999. 디폴트 라이트, `dark` variant는 다크네이비 + 옐로우 텍스트 |
| `<DarkCTA>` | 다크네이비 박스 + 옐로우 헤드 + 옐로우 pill. **한 페이지 1개** |
| `<Highlight>` | `linear-gradient(transparent 55%, var(--sc-highlight-orange) 55%)`. 한 화면 1~2개 |
| `<MemberAvatar>` | 원형 80px, 빈 이미지면 닉네임 이니셜 + 옐로우 배경 |
| `<WeekBadge>` | pill 라이트, "WEEK 04" 둥둥체 작게 |
| `<MagazineFooter>` | 크림 + muted 텍스트 |

## 8. 반응형

| 폭 | 컬럼 | 비고 |
|---|---|---|
| ≥1280 | 12-col · 카드 3~4 | 표지 텍스트 좌하단 큰 사이즈 |
| 768~1279 | 8-col · 카드 2~3 | nav 일부 햄버거 |
| <768 | 4-col · 카드 1 | 표지 일러스트 위/텍스트 아래 스택, 헤더 햄버거 |

## 9. 모션

- 스크롤 진입 카드 fade-in 200ms
- 다크네이비 CTA 호버 — 옐로우 텍스트 살짝 밝아짐
- 형광펜 정적
- 마스코트 정적 이미지 (애니메이션 X)
- `prefers-reduced-motion: reduce`에서 모두 off

## 10. 구현 순서

1. `src/styles/global.css` 상단에 SC 토큰 + `@font-face` 추가 (Bauhaus 토큰은 일단 유지 — 다른 페이지 호환)
2. **`/skills` 먼저 리스킨** — 디자인 시스템 검증 + 패턴 굳히기 (이번 PR)
3. `/`(메인) — 파인애플 일러스트 표지 + 매거진 섹션 흐름
4. `/board`, `/issue/[week]` — ■ 빨강 헤딩
5. `/w/[week]/[team]/[member]`, `/member/[team]/[nickname]` — ● 파랑 헤딩
6. `/keywords`, `/gallery` — ▲ 노랑 헤딩
7. Bauhaus 토큰 일괄 제거 (마지막)

## 11. 검증

- 각 페이지 리스킨 후 `VAULT_PATH=../spongeclub npm run build` 통과 확인
- 시각 검증: 데스크탑 + 모바일(<768px)
- 본문 대비비 ≥ 4.5:1, 미만이면 muted-mid → muted-high로 강화
- 콘텐츠 데이터 소스는 변경 없음 — `src/lib/*.ts` 그대로

## 12. 참고

- 디자인 토큰 원본: 대화 (2026-05-28)
- 포인트 컬러 3색은 다다 요청 (`#FFE200 / #E53330 / #1756E8`)
- 도형 ●■▲ 섹션별 다르게 — 다다 의견 제안
- 표지 일러스트: 파인애플 마을 6채 = 6조 자연 매칭
- 자매 사이트 운영 규칙: [[reference-homepage-and-community-split]]
