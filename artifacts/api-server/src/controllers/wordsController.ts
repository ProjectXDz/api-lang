import { type Request, type Response } from "express";
import {
  getWords,
  getLangInfo,
  SUPPORTED_LANGS,
  type Lang,
} from "../services/wordsService";

export async function listWords(req: Request, res: Response): Promise<void> {
  const { lang, level, limit = "10", page = "1" } = req.query as Record<string, string>;

  if (!lang || !SUPPORTED_LANGS.includes(lang as Lang)) {
    res.status(400).json({
      error: "Invalid or missing lang",
      message: `lang must be one of: ${SUPPORTED_LANGS.join(", ")}`,
    });
    return;
  }

  const parsedLevel = Number(level);
  if (!level || isNaN(parsedLevel) || parsedLevel < 1 || parsedLevel > 6) {
    res.status(400).json({
      error: "Invalid or missing level",
      message: "level must be an integer between 1 and 6",
    });
    return;
  }

  const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const parsedPage = Math.max(Number(page) || 1, 1);

  const result = await getWords({
    lang: lang as Lang,
    level: parsedLevel,
    limit: parsedLimit,
    page: parsedPage,
  });

  res.json(result);
}

export async function listLanguages(_req: Request, res: Response): Promise<void> {
  const info = SUPPORTED_LANGS.map((lang) => ({
    lang,
    levels: getLangInfo(lang),
  }));
  res.json({ languages: info });
}
