import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { getOctokitFromSession, createOctokit } from "../../lib/github-client";
import {
  GetGithubProfileResponse,
  UpdateGithubProfileBody,
  ListGithubReposQueryParams,
  CreateGithubRepoBody,
  UpdateGithubRepoParams,
  UpdateGithubRepoBody,
  GetGithubStatsResponse,
  GetGithubAuthStatusResponse,
  ListGithubReposResponse,
  UpdateGithubProfileResponse,
  UpdateGithubRepoResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapRepo(r: {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  archived: boolean;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  has_issues: boolean;
  has_wiki: boolean;
  has_projects: boolean;
  default_branch: string;
  html_url: string;
  clone_url: string;
  pushed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  topics?: string[];
  visibility?: string;
}) {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    private: r.private,
    archived: r.archived,
    fork: r.fork,
    language: r.language,
    stargazersCount: r.stargazers_count,
    forksCount: r.forks_count,
    watchersCount: r.watchers_count,
    openIssuesCount: r.open_issues_count,
    hasIssues: r.has_issues,
    hasWiki: r.has_wiki,
    hasProjects: r.has_projects,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    cloneUrl: r.clone_url,
    pushedAt: r.pushed_at,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
    topics: r.topics ?? [],
    visibility: r.visibility ?? (r.private ? "private" : "public"),
  };
}

router.get(
  "/github/auth/status",
  async (req: Request, res: Response): Promise<void> => {
    const token = req.session?.githubToken;
    if (!token) {
      const parsed = GetGithubAuthStatusResponse.parse({
        authenticated: false,
        login: null,
        avatarUrl: null,
      });
      res.json(parsed);
      return;
    }
    try {
      const octokit = createOctokit(token);
      const { data } = await octokit.rest.users.getAuthenticated();
      const parsed = GetGithubAuthStatusResponse.parse({
        authenticated: true,
        login: data.login,
        avatarUrl: data.avatar_url,
      });
      res.json(parsed);
    } catch {
      req.session.githubToken = undefined;
      const parsed = GetGithubAuthStatusResponse.parse({
        authenticated: false,
        login: null,
        avatarUrl: null,
      });
      res.json(parsed);
    }
  },
);

router.post(
  "/github/auth/connect",
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "token is required" });
      return;
    }
    try {
      const octokit = createOctokit(token);
      const { data } = await octokit.rest.users.getAuthenticated();
      req.session.githubToken = token;
      res.json({
        authenticated: true,
        login: data.login,
        avatarUrl: data.avatar_url,
      });
    } catch {
      res.status(401).json({ error: "Invalid GitHub token" });
    }
  },
);

router.post(
  "/github/auth/disconnect",
  async (req: Request, res: Response): Promise<void> => {
    req.session.githubToken = undefined;
    res.json({ success: true });
  },
);

router.get(
  "/github/profile",
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req);
    if (!octokit) {
      res.status(401).json({ error: "Not authenticated with GitHub" });
      return;
    }
    const { data } = await octokit.rest.users.getAuthenticated();
    const parsed = GetGithubProfileResponse.parse({
      login: data.login,
      id: data.id,
      avatarUrl: data.avatar_url,
      name: data.name ?? null,
      company: data.company ?? null,
      blog: data.blog ?? null,
      location: data.location ?? null,
      email: data.email ?? null,
      bio: data.bio ?? null,
      twitterUsername: data.twitter_username ?? null,
      publicRepos: data.public_repos,
      followers: data.followers,
      following: data.following,
      createdAt: data.created_at,
      htmlUrl: data.html_url,
    });
    res.json(parsed);
  },
);

router.patch(
  "/github/profile",
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req);
    if (!octokit) {
      res.status(401).json({ error: "Not authenticated with GitHub" });
      return;
    }
    const parsed = UpdateGithubProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { data } = await octokit.rest.users.updateAuthenticated({
      name: parsed.data.name,
      email: parsed.data.email,
      blog: parsed.data.blog,
      location: parsed.data.location,
      bio: parsed.data.bio,
      twitter_username: parsed.data.twitterUsername,
      company: parsed.data.company,
    });
    const response = UpdateGithubProfileResponse.parse({
      login: data.login,
      id: data.id,
      avatarUrl: data.avatar_url,
      name: data.name ?? null,
      company: data.company ?? null,
      blog: data.blog ?? null,
      location: data.location ?? null,
      email: data.email ?? null,
      bio: data.bio ?? null,
      twitterUsername: data.twitter_username ?? null,
      publicRepos: data.public_repos,
      followers: data.followers,
      following: data.following,
      createdAt: data.created_at,
      htmlUrl: data.html_url,
    });
    res.json(response);
  },
);

router.get(
  "/github/repos",
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req);
    if (!octokit) {
      res.status(401).json({ error: "Not authenticated with GitHub" });
      return;
    }
    const params = ListGithubReposQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: params.data.sort as
        | "created"
        | "updated"
        | "pushed"
        | "full_name"
        | undefined,
      direction: params.data.direction as "asc" | "desc" | undefined,
      per_page: params.data.per_page
        ? Number(params.data.per_page)
        : 100,
      page: params.data.page ? Number(params.data.page) : 1,
      visibility: "all",
    });
    const mapped = data.map(mapRepo);
    const response = ListGithubReposResponse.parse(mapped);
    res.json(response);
  },
);

router.post(
  "/github/repos",
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req);
    if (!octokit) {
      res.status(401).json({ error: "Not authenticated with GitHub" });
      return;
    }
    const parsed = CreateGithubRepoBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name: parsed.data.name,
      description: parsed.data.description,
      private: parsed.data.private ?? false,
      auto_init: parsed.data.autoInit ?? true,
      gitignore_template: parsed.data.gitignoreTemplate,
      license_template: parsed.data.licenseTemplate,
    });
    const response = mapRepo(data as Parameters<typeof mapRepo>[0]);
    res.status(201).json(response);
  },
);

router.patch(
  "/github/repos/:owner/:repo",
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req);
    if (!octokit) {
      res.status(401).json({ error: "Not authenticated with GitHub" });
      return;
    }
    const rawOwner = Array.isArray(req.params.owner)
      ? req.params.owner[0]
      : req.params.owner;
    const rawRepo = Array.isArray(req.params.repo)
      ? req.params.repo[0]
      : req.params.repo;
    const paramsParsed = UpdateGithubRepoParams.safeParse({
      owner: rawOwner,
      repo: rawRepo,
    });
    if (!paramsParsed.success) {
      res.status(400).json({ error: paramsParsed.error.message });
      return;
    }
    const bodyParsed = UpdateGithubRepoBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.message });
      return;
    }
    try {
      const { data } = await octokit.rest.repos.update({
        owner: paramsParsed.data.owner,
        repo: paramsParsed.data.repo,
        name: bodyParsed.data.name,
        description: bodyParsed.data.description,
        private: bodyParsed.data.private,
        archived: bodyParsed.data.archived,
        has_issues: bodyParsed.data.hasIssues,
        has_wiki: bodyParsed.data.hasWiki,
        has_projects: bodyParsed.data.hasProjects,
      });
      const response = UpdateGithubRepoResponse.parse(mapRepo(data as Parameters<typeof mapRepo>[0]));
      res.json(response);
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e.status === 404) {
        res.status(404).json({ error: "Repository not found" });
        return;
      }
      throw err;
    }
  },
);

router.get(
  "/github/stats",
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req);
    if (!octokit) {
      res.status(401).json({ error: "Not authenticated with GitHub" });
      return;
    }
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      visibility: "all",
    });
    const langMap = new Map<string, number>();
    let totalStars = 0;
    let totalForks = 0;
    let totalWatchers = 0;
    let publicRepos = 0;
    let privateRepos = 0;
    let archivedRepos = 0;
    let mostStarred = repos[0];

    for (const repo of repos) {
      totalStars += repo.stargazers_count ?? 0;
      totalForks += repo.forks_count ?? 0;
      totalWatchers += repo.watchers_count ?? 0;
      if (repo.private) privateRepos++;
      else publicRepos++;
      if (repo.archived) archivedRepos++;
      if (repo.language) {
        langMap.set(repo.language, (langMap.get(repo.language) ?? 0) + 1);
      }
      if (
        (repo.stargazers_count ?? 0) >
        (mostStarred?.stargazers_count ?? 0)
      ) {
        mostStarred = repo;
      }
    }

    const totalWithLang = Array.from(langMap.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const languageBreakdown = Array.from(langMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({
        language,
        count,
        percentage:
          totalWithLang > 0
            ? Math.round((count / totalWithLang) * 100)
            : 0,
      }));

    const response = GetGithubStatsResponse.parse({
      totalRepos: repos.length,
      totalStars,
      totalForks,
      totalWatchers,
      publicRepos,
      privateRepos,
      archivedRepos,
      languageBreakdown,
      mostStarredRepo: mostStarred ? mapRepo(mostStarred as Parameters<typeof mapRepo>[0]) : undefined,
    });
    res.json(response);
  },
);

export default router;
