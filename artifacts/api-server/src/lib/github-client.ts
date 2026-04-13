import { Octokit } from "@octokit/rest";
import type { Request, Response, NextFunction } from "express";
import { getGithubToken } from "./session";

export function getOctokitFromSession(req: Request): Octokit | null {
  const token = getGithubToken(req);
  if (!token) return null;
  return new Octokit({ auth: token });
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

export function requireGithubAuth(req: Request, res: Response, next: NextFunction): void {
  if (!getGithubToken(req)) {
    res.status(401).json({ error: "Not authenticated with GitHub" });
    return;
  }
  next();
}
