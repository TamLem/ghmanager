import { Octokit } from "@octokit/rest";
import type { Request } from "express";

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
