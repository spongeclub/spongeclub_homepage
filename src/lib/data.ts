// vault에서 멤버 명단과 미션 제출 상태를 읽어와 사이트에서 쓸 수 있는 형태로 변환한다.
// VAULT_PATH 환경변수로 vault 위치 지정 가능. 기본값은 형제 디렉토리(`../spongeclub`).

import fs from 'node:fs';
import path from 'node:path';

export const VAULT_PATH = process.env.VAULT_PATH
  ? path.resolve(process.env.VAULT_PATH)
  : path.resolve(process.cwd(), '../spongeclub');

const TEAM_TOPICS: Record<string, { lead: string; topic: string }> = {
  '1조': { lead: '비비안', topic: 'AX PM · 프로덕트 구조 설계' },
  '2조': { lead: '띵크', topic: '콘텐츠 마케팅 사이트 + Vercel 자동배포' },
  '3조': { lead: '흐민', topic: 'OS 설계 철학 · Sullivan 프로젝트' },
  '4조': { lead: '다다', topic: '레포·자동화·아카이브·OPS 시스템화' },
  '5조': { lead: '오웬', topic: '월 1개 유저 프로덕트 런칭' },
  '6조': { lead: '다니', topic: '운영 총괄 · 콘텐츠 운영 시스템' },
};

export type Member = {
  team: string;
  fullName: string;
  nickname: string;
  isCrew: boolean;
};

export type SubmissionStatus = 'submitted' | 'drafting' | 'empty';

export type Submission = {
  member: Member;
  status: SubmissionStatus;
  hasFile: boolean;
  submittedFlag: boolean;
  filePath?: string;
  noteTitle?: string;
  summary?: string;
  mvp?: boolean;
  mvpReason?: string;
  mvpSummary?: string;
  mvpContent?: string;
};

export type WeekData = {
  weekNumber: number;
  folderName: string;
  dateLabel: string;
  submissions: Submission[];
  totalMembers: number;
  submittedCount: number;
};

const STRIP_CREW = /\s*※셀피쉬크루\s*$/;
const NICKNAME_IN_PAREN = /\(([^)]+)\)/;

export function parseMemberList(): Member[] {
  const filePath = path.join(VAULT_PATH, '99_meta/멤버목록.md');
  const text = fs.readFileSync(filePath, 'utf-8');
  const members: Member[] = [];
  let currentTeam: string | null = null;

  for (const line of text.split('\n')) {
    const teamHeading = line.match(/^##\s+(\d조)\s*\(\d+명\)/);
    if (teamHeading) {
      currentTeam = teamHeading[1];
      continue;
    }
    // 조 헤딩이 아닌 다른 ## 섹션(예: '## 갱신 규칙')이나 수평선(---)을 만나면
    // 팀 컨텍스트를 닫는다. 안 그러면 푸터 규칙 불릿이 직전 조 멤버로 잘못 수집됨.
    if (/^##\s/.test(line) || /^---\s*$/.test(line)) {
      currentTeam = null;
      continue;
    }
    if (!currentTeam) continue;

    const item = line.match(/^-\s+(.+)$/);
    if (!item) continue;

    const raw = item[1].trim();
    const isCrew = STRIP_CREW.test(raw);
    const cleaned = raw.replace(STRIP_CREW, '').trim();
    const parenMatch = cleaned.match(NICKNAME_IN_PAREN);
    // 표기 규칙: 괄호 앞 = 닉네임(공개), 괄호 안 = 본명
    const nickname = parenMatch
      ? cleaned.replace(NICKNAME_IN_PAREN, '').trim()
      : cleaned;
    const fullName = parenMatch ? parenMatch[1].trim() : cleaned;

    members.push({ team: currentTeam, fullName, nickname, isCrew });
  }
  return members;
}

function listWeekFolders(): string[] {
  const missionDir = path.join(VAULT_PATH, '02_mission');
  if (!fs.existsSync(missionDir)) return [];
  return fs
    .readdirSync(missionDir)
    .filter((name) => /\d주차/.test(name))
    .sort();
}

function extractWeekNumber(folderName: string): number {
  const m = folderName.match(/^(\d+)주차/);
  return m ? Number(m[1]) : 0;
}

function extractDateLabel(folderName: string): string {
  const m = folderName.match(/_(\d{4})$/);
  if (!m) return '';
  const mm = m[1].slice(0, 2);
  const dd = m[1].slice(2);
  return `${mm}-${dd}`;
}

function parseFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      let v = kv[2].trim();
      // strip outer matching quotes for friendlier YAML 입력
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[kv[1]] = v;
    }
  }
  return out;
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function extractFirstHeading(text: string): string | undefined {
  const m = text.match(/^#\s+(.+)$/m);
  return m?.[1].trim();
}

// vault 전체에서 이미지 파일을 파일명 단위로 인덱싱한다.
// 옵시디언 wikilink (`![[name.png]]`)는 폴더 위치를 명시하지 않으므로
// 파일명 → vault 상대경로 매핑이 필요하다.
let imageIndexCache: Map<string, string> | null = null;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const SKIP_DIRS = new Set([
  '.git',
  '.obsidian',
  '.claude',
  '.omc',
  'node_modules',
]);

function buildImageIndex(): Map<string, string> {
  if (imageIndexCache) return imageIndexCache;
  const index = new Map<string, string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (IMAGE_EXT.test(entry)) {
        if (!index.has(entry)) {
          index.set(entry, path.relative(VAULT_PATH, full));
        }
      }
    }
  };
  walk(VAULT_PATH);
  imageIndexCache = index;
  return index;
}

function rawGithubUrl(relPath: string): string {
  const segments = relPath.split('/').map((s) => encodeURIComponent(s));
  return `https://raw.githubusercontent.com/spongeclub/spongeclub_1/main/${segments.join('/')}`;
}

// 옵시디언 콜아웃 (`> [!type] ...` + 이어지는 `>` 라인들) 통째 제거
function stripCallouts(md: string): string {
  return md.replace(
    /^[ \t]*>[ \t]*\[![\w-]+\][+-]?[^\n]*(?:\n[ \t]*>[^\n]*)*\n?/gm,
    ''
  );
}

// `![[filename]]` 형태의 wikilink 임베드 → 표준 markdown image
function rewriteWikilinkImages(md: string, imageIndex: Map<string, string>): string {
  return md.replace(/!\[\[([^\]\|]+?)(?:\|[^\]]*)?\]\]/g, (_match, raw) => {
    const filename = String(raw).trim();
    if (!IMAGE_EXT.test(filename)) {
      return '';
    }
    const rel = imageIndex.get(filename);
    if (!rel) return '';
    return `![${filename}](${rawGithubUrl(rel)})`;
  });
}

// 일반 wikilink (`[[노트]]`) → 단순 텍스트 (사이트에는 해당 노트 페이지가 없음)
function rewriteWikilinkNotes(md: string): string {
  return md.replace(/\[\[([^\]\|]+?)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => {
    return alias || target;
  });
}

export function transformObsidianMarkdown(md: string): string {
  const imageIndex = buildImageIndex();
  let out = stripCallouts(md);
  out = rewriteWikilinkImages(out, imageIndex);
  out = rewriteWikilinkNotes(out);
  return out;
}

export function readSubmissionMarkdown(filePath: string): string {
  const text = fs.readFileSync(filePath, 'utf-8');
  return transformObsidianMarkdown(stripFrontmatter(text));
}

function buildWeekFromFolder(folderName: string, members: Member[]): WeekData {
  const weekDir = path.join(VAULT_PATH, '02_mission', folderName);

  const filesByNick = new Map<string, string>();
  if (fs.existsSync(weekDir)) {
    for (const team of fs.readdirSync(weekDir)) {
      const teamPath = path.join(weekDir, team);
      if (!fs.statSync(teamPath).isDirectory()) continue;
      for (const fname of fs.readdirSync(teamPath)) {
        if (!fname.endsWith('.md')) continue;
        const m = fname.match(/^(\d조)_(.+?)_/);
        if (!m) continue;
        // 파일명은 `닉네임(본명)` 형태가 섞임 — 괄호를 떼고 닉네임으로 매칭
        const nick = m[2].replace(/\s*\([^)]*\)\s*/g, '').trim();
        filesByNick.set(`${m[1]}::${nick}`, path.join(teamPath, fname));
      }
    }
  }

  const submissions: Submission[] = members.map((member) => {
    const key = `${member.team}::${member.nickname}`;
    const filePath = filesByNick.get(key);
    if (!filePath) {
      return { member, status: 'empty', hasFile: false, submittedFlag: false };
    }
    const text = fs.readFileSync(filePath, 'utf-8');
    const fm = parseFrontmatter(text);
    const submittedFlag = fm.submitted === 'true';
    return {
      member,
      status: submittedFlag ? 'submitted' : 'drafting',
      hasFile: true,
      submittedFlag,
      filePath,
      noteTitle: extractFirstHeading(text) ?? path.basename(filePath, '.md'),
      mvp: fm.mvp === 'true',
      mvpReason: fm.mvp_reason,
      mvpSummary: fm.mvp_summary,
      mvpContent: fm.mvp_content,
    };
  });

  return {
    weekNumber: extractWeekNumber(folderName),
    folderName,
    dateLabel: extractDateLabel(folderName),
    submissions,
    totalMembers: members.length,
    submittedCount: submissions.filter((s) => s.status === 'submitted').length,
  };
}

export function buildAllWeeks(): WeekData[] {
  const folders = listWeekFolders();
  if (folders.length === 0) return [];
  const members = parseMemberList();
  return folders.map((f) => buildWeekFromFolder(f, members));
}

export function buildLatestWeek(): WeekData | null {
  const all = buildAllWeeks();
  return all.length === 0 ? null : all[all.length - 1];
}

export function getTeamTopic(team: string) {
  return TEAM_TOPICS[team];
}

export function groupByTeam(submissions: Submission[]): Map<string, Submission[]> {
  const out = new Map<string, Submission[]>();
  for (const s of submissions) {
    const arr = out.get(s.member.team) ?? [];
    arr.push(s);
    out.set(s.member.team, arr);
  }
  return out;
}

export function vaultGithubUrl(filePath: string): string {
  const rel = path.relative(VAULT_PATH, filePath);
  return `https://github.com/spongeclub/spongeclub_1/blob/main/${rel}`;
}

// ─── 조별 분석 (90_analysis/teams/Week_0N_조M.md) ─────────────────────
export type TeamAnalysis = {
  team: string;
  weekNumber: number;
  theme: string;
  title: string;
  subtitle: string;
  tagline: string;
  mvp: string;
  summary: string;
  insight: string;
};

// 요약 문단의 앞 1~2문장만 — frontmatter tagline 이 없을 때의 폴백.
function firstSentences(text: string, count = 2): string {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
  return parts.slice(0, count).join(' ');
}

function extractH2Section(body: string, heading: string): string {
  const re = new RegExp(`##\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
  const m = body.match(re);
  return m ? m[1].trim() : '';
}

export function loadTeamAnalyses(weekNumber: number): TeamAnalysis[] {
  const teamsDir = path.join(VAULT_PATH, '90_analysis/teams');
  if (!fs.existsSync(teamsDir)) return [];
  const out: TeamAnalysis[] = [];
  const ww = String(weekNumber).padStart(2, '0');
  for (const team of ['1조', '2조', '3조', '4조', '5조', '6조']) {
    const fp = path.join(teamsDir, `Week_${ww}_${team}.md`);
    if (!fs.existsSync(fp)) continue;
    const text = fs.readFileSync(fp, 'utf-8');
    const fm = parseFrontmatter(text);
    const body = stripFrontmatter(text);
    const summary = extractH2Section(body, '요약');
    out.push({
      team,
      weekNumber,
      theme: fm.theme || '',
      title: fm.title || fm.theme || '',
      subtitle: fm.subtitle || '',
      tagline: fm.tagline || firstSentences(summary),
      mvp: fm.mvp || '',
      summary,
      insight:
        extractH2Section(body, '★ 스폰지 인사이트') ||
        extractH2Section(body, '스폰지 인사이트') ||
        extractH2Section(body, '★ 클로드 인사이트') ||
        extractH2Section(body, '클로드 인사이트'),
    });
  }
  return out;
}

// 닉네임은 영문/한글 혼재 — URL safe slug 생성을 위해 encodeURIComponent로 wrap
export function noteSlug(weekNumber: number, team: string, nickname: string): string {
  return `${weekNumber}/${encodeURIComponent(team)}/${encodeURIComponent(nickname)}`;
}

export function noteUrl(s: Submission, weekNumber: number): string {
  if (!s.filePath) return '#';
  return `/w/${noteSlug(weekNumber, s.member.team, s.member.nickname)}/`;
}

// ───────────────────────────────────────────────────────────────
// 매거진용 — 미션 노트에서 섹션을 발췌한다.
// 표준 헤딩(### Summary / ### 공유할만한 인사이트)을 따르는 노트는 ~60%.
// 나머지는 폴백(첫 문단)으로 처리한다.
// ───────────────────────────────────────────────────────────────

export type Mission = {
  title: string;
  summary: string;
  insight: string;
};

export type Article = {
  member: Member;
  weekNumber: number;
  url: string;
  noteTitle: string;
  missions: Mission[];
  excerpt: string;
  bodyLength: number;
};

// 마크다운 → 평문 (카드 발췌용)
function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/!\[\[[^\]]*\]\]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, '$2$1')
    .replace(/^[ \t]*>[ \t]?/gm, ' ')
    .replace(/^[ \t]*[-*+][ \t]+/gm, ' ')
    .replace(/^[ \t]*\d+\.[ \t]+/gm, ' ')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*\|.*\|[ \t]*$/gm, ' ')
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, ' ')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s[-—–]{1,3})+\s*$/, '')
    .trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

// "### 헤딩" 아래 본문을 다음 동급/상위 헤딩 전까지 추출
function extractSection(block: string, names: string[]): string | null {
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,6})\s+(.+?)\s*$/);
    if (!m) continue;
    const heading = m[2].replace(/[*_`]/g, '').trim();
    if (names.some((n) => heading === n || heading.startsWith(n))) {
      const level = m[1].length;
      const out: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const hm = lines[j].match(/^(#{2,6})\s+/);
        if (hm && hm[1].length <= level) break;
        out.push(lines[j]);
      }
      return out.join('\n').trim();
    }
  }
  return null;
}

function firstParagraph(md: string): string {
  const cleaned = md.replace(/^[ \t]*#{1,6}\s+.*$/gm, '').trim();
  for (const para of cleaned.split(/\n\s*\n/)) {
    if (toPlainText(para).length > 24) return para;
  }
  return cleaned.split(/\n\s*\n/)[0] ?? '';
}

function isPlaceholderTitle(t: string): boolean {
  return !t || /^<.*>$/.test(t) || t === '제목' || t === '제목 입력';
}

function extractMissions(body: string): Mission[] {
  const lines = body.split('\n');
  const heads: { title: string; start: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+미션\s*\d+\s*[:：.]?\s*(.*)$/);
    if (m) heads.push({ title: m[1].trim(), start: i });
  }
  const missions: Mission[] = [];
  for (let b = 0; b < heads.length; b++) {
    const end = b + 1 < heads.length ? heads[b + 1].start : lines.length;
    const block = lines.slice(heads[b].start + 1, end).join('\n');
    const title = isPlaceholderTitle(heads[b].title) ? '' : heads[b].title;
    const summaryRaw =
      extractSection(block, ['Summary', '요약']) ?? firstParagraph(block);
    const insightRaw =
      extractSection(block, [
        '공유할만한 인사이트',
        '공유할 만한 인사이트',
        '인사이트',
      ]) ?? '';
    missions.push({
      title,
      summary: truncate(toPlainText(summaryRaw), 360),
      insight: truncate(toPlainText(insightRaw), 360),
    });
  }
  return missions;
}

export function buildArticle(s: Submission, weekNumber: number): Article | null {
  if (!s.filePath || s.status !== 'submitted') return null;
  const raw = fs.readFileSync(s.filePath, 'utf-8');
  const body = stripCallouts(stripFrontmatter(raw));
  const missions = extractMissions(body);

  let excerpt = missions.find((m) => m.insight)?.insight ?? '';
  if (!excerpt) excerpt = missions.find((m) => m.summary)?.summary ?? '';
  if (!excerpt) excerpt = truncate(toPlainText(firstParagraph(body)), 360);

  return {
    member: s.member,
    weekNumber,
    url: noteUrl(s, weekNumber),
    noteTitle: s.noteTitle ?? path.basename(s.filePath, '.md'),
    missions,
    excerpt,
    bodyLength: toPlainText(body).length,
  };
}

// 한 주차의 제출 노트 전체를 매거진 기사 형태로
export function buildWeekArticles(week: WeekData): Article[] {
  return week.submissions
    .filter((s) => s.status === 'submitted' && s.filePath)
    .map((s) => buildArticle(s, week.weekNumber))
    .filter((a): a is Article => a !== null);
}

// 그 주의 대표 기사 — 본문이 가장 두툼한 노트 (에디터 픽 자리)
export function pickFeature(articles: Article[]): Article | null {
  if (articles.length === 0) return null;
  return [...articles].sort((a, b) => b.bodyLength - a.bodyLength)[0];
}

// 그 주의 공통 미션 = 매거진 호의 주제 (가장 많이 등장한 미션 제목)
export function weekTheme(articles: Article[]): string {
  const counts = new Map<string, number>();
  for (const a of articles) {
    const t = a.missions.find((m) => m.title)?.title;
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best = '';
  let max = 0;
  for (const [t, c] of counts) {
    if (c > max) {
      max = c;
      best = t;
    }
  }
  return best;
}

// 멤버 개인 기사 제목 — 공통 미션명이 아니라 본인 서술(Summary 첫 문장)에서
export function cardTitle(a: Article): string {
  const sum = a.missions.find((m) => m.summary)?.summary ?? '';
  if (sum) {
    const sentence = sum.split(/(?<=[.!?。])\s+/)[0].trim();
    if (sentence.length >= 10) {
      return sentence.length > 52
        ? sentence.slice(0, 52).replace(/\s+\S*$/, '') + '…'
        : sentence;
    }
  }
  const cleaned = a.noteTitle.replace(/^\d+\s*주차\s*과제\s*[—–-]\s*/, '').trim();
  return cleaned || `${a.member.nickname}의 기록`;
}
