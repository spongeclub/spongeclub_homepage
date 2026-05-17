// vault의 02_mission/**/*submit.md 를 스캔해 외부 링크를 추출·분류한다.

import fs from 'node:fs';
import path from 'node:path';
import { VAULT_PATH } from './data';

export type LinkCategory = 'skill' | 'tool' | 'content' | 'showcase';

export type SharedLink = {
  url: string;
  title: string;
  category: LinkCategory;
  sharedBy: string[];
  weeks: number[];
};

// ───────────────────────────────────────────────
// URL 추출
// ───────────────────────────────────────────────

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)(\?[^)\s]*)?$/i;
const LOCALHOST = /^https?:\/\/localhost/i;

// markdown link: [text](url)
const MD_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
// bare URL (not already inside a markdown link)
const BARE_URL = /(?<!\()(https?:\/\/[^\s\)\]"'<>]+)/g;

function extractUrls(text: string): Array<{ url: string; title: string }> {
  const results: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();

  // markdown links first (capture title)
  for (const m of text.matchAll(MD_LINK)) {
    const rawUrl = m[2].replace(/[)\s]+$/, '');
    const title = m[1].trim();
    if (!seen.has(rawUrl)) {
      seen.add(rawUrl);
      results.push({ url: rawUrl, title });
    }
  }

  // bare URLs (no title)
  for (const m of text.matchAll(BARE_URL)) {
    const rawUrl = m[1].replace(/[)\].,;:!?]+$/, '');
    if (!seen.has(rawUrl)) {
      seen.add(rawUrl);
      results.push({ url: rawUrl, title: '' });
    }
  }

  return results.filter(({ url }) => !LOCALHOST.test(url) && !IMAGE_EXT.test(url));
}

// ───────────────────────────────────────────────
// URL 정규화 (dedup)
// ───────────────────────────────────────────────

const UTM_PARAMS = /[?&](utm_[^&=]+=([^&]*))(&|$)/g;

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // strip utm params
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'igsh' || key === 'xmt') {
        u.searchParams.delete(key);
      }
    }
    // strip trailing slash from pathname (keep root slash)
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    // fallback: strip trailing slash
    return raw.replace(/\/$/, '').replace(UTM_PARAMS, '');
  }
}

// ───────────────────────────────────────────────
// 분류
// ───────────────────────────────────────────────

function classify(url: string): LinkCategory {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const pathStr = u.pathname.toLowerCase();

    // showcase: deployed member sites
    if (
      host.endsWith('.vercel.app') ||
      host.endsWith('.netlify.app') ||
      host.endsWith('.github.io')
    ) {
      return 'showcase';
    }

    // skill: GitHub skill/plugin repos, anthropic skills
    if (host === 'github.com') {
      const p = pathStr;
      if (
        p.includes('/skill') ||
        p.includes('/plugin') ||
        p.includes('anthropic') ||
        p.includes('claude') ||
        p.includes('oh-my-claude') ||
        p.includes('selfishclub') ||
        p.includes('spongeclub') ||
        p.includes('/skills/') ||
        p.includes('/claude-code')
      ) {
        return 'skill';
      }
      // github issues/repos that are not skill-related → content
      return 'content';
    }

    // tool: known SaaS/tools
    if (
      host === 'habitica.com' ||
      host.includes('notion.so') ||
      host.includes('notion.site') ||
      host === 'vercel.com' ||
      host === 'netlify.com' ||
      host === 'cursor.sh' ||
      host === 'cursor.com' ||
      host.includes('claude.ai') ||
      host.includes('anthropic.com') ||
      host === 'openai.com' ||
      host === 'figma.com' ||
      host === 'linear.app' ||
      host === 'airtable.com' ||
      host === 'zapier.com' ||
      host === 'make.com' ||
      host === 'replit.com' ||
      host === 'bolt.new' ||
      host === 'v0.dev' ||
      host === 'lovable.dev' ||
      host === 'perplexity.ai' ||
      host === 'framer.com' ||
      host === 'webflow.com' ||
      host === 'supabase.com'
    ) {
      return 'tool';
    }

    // content: video/article/social platforms
    if (
      host.includes('youtube.com') ||
      host === 'youtu.be' ||
      host.includes('substack.com') ||
      host === 'brunch.co.kr' ||
      host === 'maily.so' ||
      host.includes('medium.com') ||
      host.includes('linkedin.com') ||
      host.includes('threads.com') ||
      host.includes('twitter.com') ||
      host.includes('x.com') ||
      host.includes('instagram.com') ||
      host === 'toss.im' ||
      host.includes('velog.io') ||
      host.includes('naver.com') ||
      host.includes('tistory.com') ||
      host.includes('kakao.com') ||
      host === 'disquiet.io'
    ) {
      return 'content';
    }

    // default: content
    return 'content';
  } catch {
    return 'content';
  }
}

// ───────────────────────────────────────────────
// 파일명 파싱 — {team}조_{nickname}(...)_{week}주차_submit.md
// ───────────────────────────────────────────────

interface FileMeta {
  team: string;
  nickname: string;
  week: number;
}

function parseFilename(fname: string): FileMeta | null {
  // e.g. "2조_띵크(이예성)_6주차_submit.md"
  //      "1조_Amy(임유영)_1주차_submit.md"
  //      "3조_흐민_5주차_submit.md"
  const m = fname.match(/^(\d조)_(.+?)_(\d+)주차_submit\.md$/);
  if (!m) return null;
  const team = m[1];
  const week = Number(m[3]);
  // strip (본명) in parentheses
  const nickname = m[2].replace(/\s*\([^)]*\)\s*/, '').trim();
  return { team, nickname, week };
}

// ───────────────────────────────────────────────
// 제목 생성
// ───────────────────────────────────────────────

function makeTitle(rawTitle: string, url: string): string {
  if (rawTitle && rawTitle.length > 1 && !rawTitle.startsWith('http')) {
    return rawTitle.slice(0, 80);
  }
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const seg = u.pathname.split('/').filter(Boolean);
    if (seg.length === 0) return host;
    // last path segment, decode and clean
    const last = decodeURIComponent(seg[seg.length - 1])
      .replace(/[-_]/g, ' ')
      .replace(/\.\w+$/, '')
      .trim();
    if (last.length > 2 && last.length < 80) return `${host} — ${last}`;
    return host;
  } catch {
    return url.slice(0, 60);
  }
}

// ───────────────────────────────────────────────
// 메인 export
// ───────────────────────────────────────────────

export function extractSharedLinks(): SharedLink[] {
  const missionDir = path.join(VAULT_PATH, '02_mission');
  if (!fs.existsSync(missionDir)) return [];

  // normalized URL → accumulator
  const map = new Map<
    string,
    { url: string; title: string; category: LinkCategory; sharedBy: Set<string>; weeks: Set<number> }
  >();

  const walkDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith('_')) continue;
      const full = path.join(dir, entry);
      let stat: fs.Stats;
      try { stat = fs.statSync(full); } catch { continue; }

      if (stat.isDirectory()) {
        walkDir(full);
      } else if (entry.endsWith('.md') && !entry.startsWith('_')) {
        const meta = parseFilename(entry);
        if (!meta) continue;

        let text: string;
        try { text = fs.readFileSync(full, 'utf-8'); } catch { continue; }

        const extracted = extractUrls(text);
        for (const { url: rawUrl, title: rawTitle } of extracted) {
          const norm = normalizeUrl(rawUrl);
          // skip internal github issues of the vault repo (noise)
          if (norm.includes('github.com/spongeclub/spongeclub_1/issues')) continue;

          const existing = map.get(norm);
          if (existing) {
            existing.sharedBy.add(meta.nickname);
            existing.weeks.add(meta.week);
            // prefer non-empty title
            if (!existing.title && rawTitle) existing.title = rawTitle;
          } else {
            const category = classify(norm);
            const title = makeTitle(rawTitle, norm);
            map.set(norm, {
              url: norm,
              title,
              category,
              sharedBy: new Set([meta.nickname]),
              weeks: new Set([meta.week]),
            });
          }
        }
      }
    }
  };

  walkDir(missionDir);

  const links: SharedLink[] = [...map.values()].map((v) => ({
    url: v.url,
    title: v.title,
    category: v.category,
    sharedBy: [...v.sharedBy].sort(),
    weeks: [...v.weeks].sort((a, b) => a - b),
  }));

  // 카테고리 순서 → 공유자 수 내림차순 → 제목 오름차순
  const order: LinkCategory[] = ['skill', 'tool', 'content', 'showcase'];
  links.sort((a, b) => {
    const ci = order.indexOf(a.category) - order.indexOf(b.category);
    if (ci !== 0) return ci;
    const diff = b.sharedBy.length - a.sharedBy.length;
    return diff !== 0 ? diff : a.title.localeCompare(b.title, 'ko');
  });

  return links;
}
