import { Octokit } from "@octokit/rest";
import type { Request, Response, NextFunction } from "express";

export function getOctokitFromSession(req: Request): Octokit | null {
  const token = req.session?.githubToken as string | undefined | null;
  if (!token) return null;
  return new Octokit({ auth: token });
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

export function requireGithubAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.session?.githubToken as string | undefined | null;
  if (!token) {
    res.status(401).json({ error: "Not authenticated with GitHub" });
    return;
  }
  next();
}
