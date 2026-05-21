// 06_unit/데굴데굴/스킬인사이트/skills_md/ 의 큐레이션된 스킬 후기/공유 노트를 읽어 사이트에 노출한다.
// 파일은 frontmatter + 본문(써본 상황, 결과·인사이트 / 주요 내용, 참고) 구조.

import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { VAULT_PATH } from './data';

export type CuratedQuote = { quote: string; author: string };

export type CuratedSkill = {
  slug: string;        // skill_01 ... skill_16
  title: string;
  skillName: string;
  summary: string;
  authors: string[];
  postType: '써본후기' | '공유' | string;
  type: string;        // 스킬 / 가이드
  category: string;    // 클로드코드 / 콘텐츠마케팅 / 개발도구 / 생산성
  audience: string[];
  difficulty: string;  // 설치만하면됨 / 설정좀필요 / 코드만져야함
  inspiredBy: string;
  keywords: string[];
  links: string[];
  featured: boolean;
  bodyHtml: string;
  quotes: CuratedQuote[];
  userCount: number;   // 🔥 N명이 써봄 — authors 길이 또는 inspired_by의 "N명"
  created: string;     // frontmatter `created` (YYYY-MM-DD), 신규 정렬용
};

// ───────────────────────────────────────────────
// frontmatter 파서 (간이) — 본 파일 스키마 전용
// ───────────────────────────────────────────────

function parseFrontmatter(text: string): { fm: Record<string, any>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const fmText = m[1];
  const body = m[2];
  const fm: Record<string, any> = {};
  const lines = fmText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    i++;
    if (line.trim().startsWith('#')) continue; // 섹션 주석
    if (line.trim() === '') continue;
    const kv = line.match(/^([a-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val === '') {
      // 다음 줄들이 `  - item` 이면 배열
      const arr: string[] = [];
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        arr.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
        i++;
      }
      fm[key] = arr.length > 0 ? arr : '';
    } else if (val.startsWith('[') && val.endsWith(']')) {
      fm[key] = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      fm[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return { fm, body };
}

function toArr(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function toStr(v: any): string {
  if (Array.isArray(v)) return v.join(', ');
  return typeof v === 'string' ? v : '';
}

// ───────────────────────────────────────────────
// 메인 export
// ───────────────────────────────────────────────

const SKILLS_DIR = path.join(VAULT_PATH, '06_unit/데굴데굴/스킬인사이트/skills_md');

export function loadCuratedSkills(): CuratedSkill[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];

  const files = fs.readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const skills: CuratedSkill[] = [];
  for (const file of files) {
    const full = path.join(SKILLS_DIR, file);
    let text: string;
    try { text = fs.readFileSync(full, 'utf-8'); } catch { continue; }
    const { fm, body } = parseFrontmatter(text);

    const slug = file.replace(/\.md$/, '');
    const bodyHtml = marked.parse(body || '', { async: false }) as string;
    const quotes = extractQuotes(body || '');
    const authors = toArr(fm.author);
    const inspiredBy = toStr(fm.inspired_by);
    const userCount = computeUserCount(authors, inspiredBy);

    skills.push({
      slug,
      title: toStr(fm.title) || slug,
      skillName: toStr(fm.skill_name),
      summary: toStr(fm.summary),
      authors,
      postType: toStr(fm.post_type),
      type: toStr(fm.type),
      category: toStr(fm.category) || '기타',
      audience: toArr(fm.audience),
      difficulty: toStr(fm.difficulty),
      inspiredBy,
      keywords: toArr(fm.keywords),
      links: toArr(fm.links),
      featured: fm.featured === true || fm.featured === 'true',
      bodyHtml,
      quotes,
      userCount,
      created: toStr(fm.created),
    });
  }

  return skills;
}

// 가장 최근 등록된 스킬 N개 (created 내림차순)
export function getLatestSkills(skills: CuratedSkill[], n: number = 3): CuratedSkill[] {
  return [...skills]
    .sort((a, b) => (b.created || '').localeCompare(a.created || ''))
    .slice(0, n);
}

// 본문의 `> "내용" — 작성자` 패턴에서 인용 추출
function extractQuotes(body: string): CuratedQuote[] {
  const out: CuratedQuote[] = [];
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith('>')) continue;
    const text = line.replace(/^>\s*/, '').trim();
    if (!text) continue;
    // "내용" — 작성자  /  "내용" - 작성자  /  내용 — 작성자
    const m = text.match(/^["“"]?(.+?)["”"]?\s*[—–-]\s*(.+)$/);
    if (m) {
      out.push({ quote: m[1].trim(), author: m[2].trim() });
    } else {
      out.push({ quote: text.replace(/^["“"]|["”"]$/g, '').trim(), author: '' });
    }
  }
  return out;
}

// authors 우선, 없으면 inspired_by에서 "N명" 추출
function computeUserCount(authors: string[], inspiredBy: string): number {
  if (authors.length > 0) return authors.length;
  const m = inspiredBy.match(/(\d+)\s*명/);
  return m ? parseInt(m[1], 10) : 0;
}

export function groupByCategory(skills: CuratedSkill[]): Array<{ category: string; items: CuratedSkill[] }> {
  const order = ['클로드코드', '콘텐츠마케팅', '개발도구', '생산성'];
  const map = new Map<string, CuratedSkill[]>();
  for (const s of skills) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category)!.push(s);
  }
  const groups: Array<{ category: string; items: CuratedSkill[] }> = [];
  for (const cat of order) {
    if (map.has(cat)) groups.push({ category: cat, items: map.get(cat)! });
  }
  // 나머지(예: '기타')
  for (const [cat, items] of map) {
    if (!order.includes(cat)) groups.push({ category: cat, items });
  }
  return groups;
}
