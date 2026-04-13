import type { Request, Response, NextFunction } from "express";
import { getOctokitFromSession } from "../lib/github-client";

export async function requireGithubAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const octokit = getOctokitFromSession(req);
  if (!octokit) {
    res.status(401).json({ error: "Not authenticated with GitHub" });
    return;
  }
  next();
}
