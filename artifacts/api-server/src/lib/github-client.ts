import { Octokit } from "@octokit/rest";
import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    githubToken?: string;
  }
}

export function getOctokitFromSession(req: Request): Octokit | null {
  const token = req.session?.githubToken;
  if (!token) return null;
  return new Octokit({ auth: token });
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

export function requireGithubAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.githubToken) {
    res.status(401).json({ error: "Not authenticated with GitHub" });
    return;
  }
  next();
}
