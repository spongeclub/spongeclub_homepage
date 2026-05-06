// vault에서 멤버 명단과 미션 제출 상태를 읽어와 사이트에서 쓸 수 있는 형태로 변환한다.
// VAULT_PATH 환경변수로 vault 위치 지정 가능. 기본값은 형제 디렉토리(`../spongeclub`).

import fs from 'node:fs';
import path from 'node:path';

const VAULT_PATH = process.env.VAULT_PATH
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
    if (!currentTeam) continue;

    const item = line.match(/^-\s+(.+)$/);
    if (!item) continue;

    const raw = item[1].trim();
    const isCrew = STRIP_CREW.test(raw);
    const cleaned = raw.replace(STRIP_CREW, '').trim();
    const parenMatch = cleaned.match(NICKNAME_IN_PAREN);
    const nickname = parenMatch
      ? parenMatch[1].trim()
      : cleaned;
    const fullName = parenMatch
      ? cleaned.replace(NICKNAME_IN_PAREN, '').trim()
      : cleaned;

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
    if (kv) out[kv[1]] = kv[2].trim();
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
        filesByNick.set(`${m[1]}::${m[2]}`, path.join(teamPath, fname));
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

// 닉네임은 영문/한글 혼재 — URL safe slug 생성을 위해 encodeURIComponent로 wrap
export function noteSlug(weekNumber: number, team: string, nickname: string): string {
  return `${weekNumber}/${encodeURIComponent(team)}/${encodeURIComponent(nickname)}`;
}

export function noteUrl(s: Submission, weekNumber: number): string {
  if (!s.filePath) return '#';
  return `/w/${noteSlug(weekNumber, s.member.team, s.member.nickname)}/`;
}
