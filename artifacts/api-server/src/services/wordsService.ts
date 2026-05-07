import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

export type Lang = "ko" | "jp" | "cn";

export interface Word {
  word: string;
  meaning: string;
  example: string;
}

type LevelData = Record<string, Word[]>;
type VocabStore = Record<Lang, LevelData>;

const DATA_DIR = process.env["DATA_DIR"]
  ? path.join(process.cwd(), process.env["DATA_DIR"])
  : path.join(process.cwd(), "data");

function loadJson(lang: Lang): LevelData {
  const filePath = path.join(DATA_DIR, `${lang}.json`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as LevelData;
}

const store: VocabStore = {
  ko: loadJson("ko"),
  jp: loadJson("jp"),
  cn: loadJson("cn"),
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface PoolEntry {
  remaining: Set<number>;
  lastBatch: number[];
}

const pools = new Map<string, PoolEntry>();

function poolKey(lang: Lang, level: number): string {
  return `${lang}:${level}`;
}

function getPool(lang: Lang, level: number): PoolEntry {
  const key = poolKey(lang, level);
  if (!pools.has(key)) {
    const words = store[lang]?.[String(level)] ?? [];
    pools.set(key, {
      remaining: new Set(words.map((_, i) => i)),
      lastBatch: [],
    });
  }
  return pools.get(key)!;
}

function resetPool(lang: Lang, level: number): void {
  const key = poolKey(lang, level);
  const words = store[lang]?.[String(level)] ?? [];
  const entry = pools.get(key);
  const lastBatch = entry?.lastBatch ?? [];
  const remaining = new Set(
    words
      .map((_, i) => i)
      .filter((i) => !lastBatch.includes(i)),
  );
  if (remaining.size === 0) {
    pools.set(key, { remaining: new Set(words.map((_, i) => i)), lastBatch: [] });
  } else {
    pools.set(key, { remaining, lastBatch });
  }
}

export interface GetWordsOptions {
  lang: Lang;
  level: number;
  limit: number;
  page: number;
}

export interface GetWordsResult {
  lang: Lang;
  level: number;
  total: number;
  page: number;
  limit: number;
  words: Word[];
}

export async function getWords(opts: GetWordsOptions): Promise<GetWordsResult> {
  const { lang, level, limit, page } = opts;

  const allWords: Word[] = store[lang]?.[String(level)] ?? [];
  const total = allWords.length;

  let pool = getPool(lang, level);

  if (pool.remaining.size < limit) {
    logger.info({ lang, level }, "Pool exhausted — resetting");
    resetPool(lang, level);
    pool = getPool(lang, level);
  }

  const available = shuffle([...pool.remaining]);
  const offset = (page - 1) * limit;
  const picked = available.slice(offset, offset + limit);

  const words = picked.map((i) => allWords[i]);

  pool.lastBatch = picked;
  picked.forEach((i) => pool.remaining.delete(i));

  return {
    lang,
    level,
    total,
    page,
    limit,
    words,
  };
}

export function getLangInfo(lang: Lang) {
  const levels = Object.keys(store[lang]).map(Number).sort((a, b) => a - b);
  return levels.map((level) => ({
    level,
    wordCount: (store[lang][String(level)] ?? []).length,
  }));
}

export const SUPPORTED_LANGS: Lang[] = ["ko", "jp", "cn"];
