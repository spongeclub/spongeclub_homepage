// AI 분석 데이터 로더.
// src/data/analysis.json 은 빌드 전 1회 생성되는 정적 파일이다 (scripts/generate-analysis.md 참고).
// 사이트 빌드 자체는 이 JSON 만 읽으므로 결정적이다 (런타임 API 호출 없음).

import analysisData from '../data/analysis.json';

export type WeeklyHighlight = {
  week: number;
  title: string;
  summary: string;
  keywords: string[];
};

export type MemberAnalysis = {
  team: string;
  nickname: string;
  fullName: string;
  growthNarrative: string;
  keywords: string[];
  weeklyHighlights: WeeklyHighlight[];
};

export type AnalysisData = {
  generatedAt: string;
  memberCount: number;
  members: MemberAnalysis[];
};

export function loadAnalysis(): AnalysisData {
  return analysisData as AnalysisData;
}

export function getMemberAnalysis(
  team: string,
  nickname: string
): MemberAnalysis | undefined {
  return loadAnalysis().members.find(
    (m) => m.team === team && m.nickname === nickname
  );
}

// 주차 라벨
const WEEK_LABELS: Record<number, string> = {
  0: '0주차 · OT',
  1: '1주차',
  2: '2주차',
  3: '3주차',
  4: '4주차',
  5: '5주차',
  6: '6주차',
};

export function weekLabel(week: number): string {
  return WEEK_LABELS[week] ?? `${week}주차`;
}

export type TopicMember = { team: string; nickname: string };

export type Topic = {
  keyword: string;
  count: number;
  members: TopicMember[];
};

export type WeekKeywords = {
  week: number;
  label: string;
  topics: Topic[];
};

// 키워드 → 그 키워드를 다룬 멤버 목록으로 집계 (한 멤버는 한 번만 카운트)
function tally(
  pairs: { keyword: string; member: TopicMember }[]
): Topic[] {
  const map = new Map<string, TopicMember[]>();
  for (const { keyword, member } of pairs) {
    const key = keyword.trim();
    if (!key) continue;
    const arr = map.get(key) ?? [];
    if (!arr.some((m) => m.team === member.team && m.nickname === member.nickname)) {
      arr.push(member);
    }
    map.set(key, arr);
  }
  return [...map.entries()]
    .map(([keyword, members]) => ({ keyword, count: members.length, members }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
}

// 주차별 키워드 집계 — 각 멤버 weeklyHighlights[].keywords 를 주차 단위로 묶는다.
export function buildWeekKeywords(): WeekKeywords[] {
  const byWeek = new Map<number, { keyword: string; member: TopicMember }[]>();
  for (const m of loadAnalysis().members) {
    const member: TopicMember = { team: m.team, nickname: m.nickname };
    for (const wh of m.weeklyHighlights) {
      const arr = byWeek.get(wh.week) ?? [];
      for (const kw of wh.keywords ?? []) arr.push({ keyword: kw, member });
      byWeek.set(wh.week, arr);
    }
  }
  return [...byWeek.keys()]
    .sort((a, b) => a - b)
    .map((week) => ({
      week,
      label: weekLabel(week),
      topics: tally(byWeek.get(week)!),
    }));
}

// 전체 기간 종합 키워드 — 멤버 단위 keywords[] 를 집계한다.
export function buildOverallTopics(): Topic[] {
  const pairs: { keyword: string; member: TopicMember }[] = [];
  for (const m of loadAnalysis().members) {
    const member: TopicMember = { team: m.team, nickname: m.nickname };
    for (const kw of m.keywords ?? []) pairs.push({ keyword: kw, member });
  }
  return tally(pairs);
}
