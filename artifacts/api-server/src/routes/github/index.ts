import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { getOctokitFromSession, createOctokit, requireGithubAuth } from "../../lib/github-client";
import {
  setGithubToken,
  getGithubToken,
  clearGithubToken,
  destroySession,
  generateOauthState,
  verifyOauthState,
  getCallbackUrl,
} from "../../lib/session";
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
  ListGithubReposResponseItem,
  UpdateGithubProfileResponse,
  UpdateGithubRepoResponse,
  GetGithubActivityQueryParams,
  GetGithubActivityResponse,
  DisconnectGithubResponse,
  GetGithubRepoParams,
  GetGithubRepoResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type OctokitError = { status?: number; message?: string };

function handleOctokitError(err: unknown, req: Request, res: Response): boolean {
  const e = err as OctokitError;
  if (e.status === 401 || e.status === 403) {
    clearGithubToken(req);
    res.status(401).json({ error: "GitHub session expired or invalid. Please reconnect." });
    return true;
  }
  if (e.status === 404) {
    res.status(404).json({ error: "Resource not found" });
    return true;
  }
  return false;
}

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
    res.setHeader("Cache-Control", "no-store");
    req.log.info(
      {
        hasSessionCookie: Boolean(req.headers.cookie?.includes("session=")),
        hasSessionObject: Boolean(req.session),
      },
      "Checking GitHub auth status",
    );
    const token = getGithubToken(req);
    if (!token) {
      req.log.info("GitHub auth status: unauthenticated (no token)");
      res.json(GetGithubAuthStatusResponse.parse({ authenticated: false, login: null, avatarUrl: null }));
      return;
    }
    try {
      const octokit = createOctokit(token);
      const { data } = await octokit.rest.users.getAuthenticated();
      req.log.info({ login: data.login }, "GitHub auth status: authenticated");
      res.json(GetGithubAuthStatusResponse.parse({ authenticated: true, login: data.login, avatarUrl: data.avatar_url }));
    } catch {
      req.log.warn("GitHub auth status check failed against GitHub API; clearing session token");
      clearGithubToken(req);
      res.json(GetGithubAuthStatusResponse.parse({ authenticated: false, login: null, avatarUrl: null }));
    }
  },
);

router.get(
  "/github/auth/login",
  (req: Request, res: Response): void => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(503).send("GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.");
      return;
    }
    const state = generateOauthState();

    const callbackUrl = getCallbackUrl(req);
    req.log.info(
      {
        callbackUrl,
        forwardedProto: req.headers["x-forwarded-proto"],
        host: req.headers.host,
      },
      "Starting GitHub OAuth login redirect",
    );
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: "repo user delete_repo",
      state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  },
);

router.get(
  "/github/auth/callback",
  async (req: Request, res: Response): Promise<void> => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.redirect("/?error=oauth_not_configured");
      return;
    }

    const { code, state, error } = req.query;
    req.log.info(
      {
        hasCode: typeof code === "string" && code.length > 0,
        hasState: typeof state === "string" && state.length > 0,
        oauthError: error ? String(error) : null,
      },
      "Received GitHub OAuth callback",
    );

    if (error) {
      res.redirect(`/?error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!state || !verifyOauthState(String(state))) {
      req.log.warn("GitHub OAuth callback failed state verification");
      res.redirect("/?error=state_mismatch");
      return;
    }

    if (!code || typeof code !== "string") {
      res.redirect("/?error=no_code");
      return;
    }

    try {
      const callbackUrl = getCallbackUrl(req);
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
      });

      const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
      req.log.info(
        {
          tokenExchangeStatus: tokenRes.status,
          hasAccessToken: Boolean(tokenData.access_token),
          oauthError: tokenData.error ?? null,
        },
        "Processed GitHub OAuth token exchange response",
      );

      if (!tokenData.access_token) {
        const msg = tokenData.error_description ?? tokenData.error ?? "token_exchange_failed";
        res.redirect(`/?error=${encodeURIComponent(msg)}`);
        return;
      }

      setGithubToken(req, tokenData.access_token);
      req.log.info(
        {
          hasSessionObject: Boolean(req.session),
          hasSessionCookie: Boolean(req.headers.cookie?.includes("session=")),
        },
        "Stored GitHub token in session during callback",
      );
      res.status(200).type("html").send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signing in\u2026</title>' +
        '<script>window.location.replace("/")</script></head>' +
        '<body>Authentication successful. <a href="/">Click here if not redirected.</a></body></html>',
      );
    } catch {
      req.log.error("GitHub OAuth callback failed unexpectedly");
      res.redirect("/?error=auth_failed");
    }
  },
);

router.post(
  "/github/auth/disconnect",
  async (req: Request, res: Response): Promise<void> => {
    destroySession(req);
    res.json(DisconnectGithubResponse.parse({ success: true }));
  },
);

router.get(
  "/github/profile",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    try {
      const { data } = await octokit.rest.users.getAuthenticated();
      res.json(GetGithubProfileResponse.parse({
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
      }));
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

router.patch(
  "/github/profile",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    const parsed = UpdateGithubProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const { data } = await octokit.rest.users.updateAuthenticated({
        name: parsed.data.name,
        email: parsed.data.email,
        blog: parsed.data.blog,
        location: parsed.data.location,
        bio: parsed.data.bio,
        twitter_username: parsed.data.twitterUsername,
        company: parsed.data.company,
      });
      res.json(UpdateGithubProfileResponse.parse({
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
      }));
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

router.get(
  "/github/repos",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    const params = ListGithubReposQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    try {
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: params.data.sort as "created" | "updated" | "pushed" | "full_name" | undefined,
        direction: params.data.direction as "asc" | "desc" | undefined,
        per_page: params.data.per_page ? Number(params.data.per_page) : 100,
        page: params.data.page ? Number(params.data.page) : 1,
        visibility: "all",
      });
      res.json(ListGithubReposResponse.parse(data.map(mapRepo)));
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

router.post(
  "/github/repos",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    const parsed = CreateGithubRepoBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name: parsed.data.name,
        description: parsed.data.description,
        private: parsed.data.private ?? false,
        auto_init: parsed.data.autoInit ?? true,
        gitignore_template: parsed.data.gitignoreTemplate,
        license_template: parsed.data.licenseTemplate,
      });
      res.status(201).json(ListGithubReposResponseItem.parse(mapRepo(data as Parameters<typeof mapRepo>[0])));
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

router.get(
  "/github/repos/:owner/:repo",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    const rawOwner = Array.isArray(req.params.owner) ? req.params.owner[0] : req.params.owner;
    const rawRepo = Array.isArray(req.params.repo) ? req.params.repo[0] : req.params.repo;
    const paramsParsed = GetGithubRepoParams.safeParse({ owner: rawOwner, repo: rawRepo });
    if (!paramsParsed.success) {
      res.status(400).json({ error: paramsParsed.error.message });
      return;
    }
    try {
      const { data } = await octokit.rest.repos.get({
        owner: paramsParsed.data.owner,
        repo: paramsParsed.data.repo,
      });
      res.json(GetGithubRepoResponse.parse(mapRepo(data as Parameters<typeof mapRepo>[0])));
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

router.delete(
  "/github/repos/:owner/:repo",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    const rawOwner = Array.isArray(req.params.owner) ? req.params.owner[0] : req.params.owner;
    const rawRepo = Array.isArray(req.params.repo) ? req.params.repo[0] : req.params.repo;
    const paramsParsed = UpdateGithubRepoParams.safeParse({ owner: rawOwner, repo: rawRepo });
    if (!paramsParsed.success) {
      res.status(400).json({ error: paramsParsed.error.message });
      return;
    }
    try {
      await octokit.rest.repos.delete({
        owner: paramsParsed.data.owner,
        repo: paramsParsed.data.repo,
      });
      res.json({ success: true });
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

router.patch(
  "/github/repos/:owner/:repo",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    const rawOwner = Array.isArray(req.params.owner) ? req.params.owner[0] : req.params.owner;
    const rawRepo = Array.isArray(req.params.repo) ? req.params.repo[0] : req.params.repo;
    const paramsParsed = UpdateGithubRepoParams.safeParse({ owner: rawOwner, repo: rawRepo });
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
      res.json(UpdateGithubRepoResponse.parse(mapRepo(data as Parameters<typeof mapRepo>[0])));
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

router.get(
  "/github/stats",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    try {
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
        if ((repo.stargazers_count ?? 0) > (mostStarred?.stargazers_count ?? 0)) {
          mostStarred = repo;
        }
      }

      const totalWithLang = Array.from(langMap.values()).reduce((a, b) => a + b, 0);
      const languageBreakdown = Array.from(langMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([language, count]) => ({
          language,
          count,
          percentage: totalWithLang > 0 ? Math.round((count / totalWithLang) * 100) : 0,
        }));

      res.json(GetGithubStatsResponse.parse({
        totalRepos: repos.length,
        totalStars,
        totalForks,
        totalWatchers,
        publicRepos,
        privateRepos,
        archivedRepos,
        languageBreakdown,
        mostStarredRepo: mostStarred
          ? mapRepo(mostStarred as Parameters<typeof mapRepo>[0])
          : undefined,
      }));
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

router.get(
  "/github/activity",
  requireGithubAuth,
  async (req: Request, res: Response): Promise<void> => {
    const octokit = getOctokitFromSession(req)!;
    const params = GetGithubActivityQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const perPage = params.data.per_page ? Number(params.data.per_page) : 20;

    try {
      const { data: user } = await octokit.rest.users.getAuthenticated();
      const { data: events } = await octokit.rest.activity.listEventsForAuthenticatedUser({
        username: user.login,
        per_page: perPage,
      });

      type GithubEvent = typeof events[number];

      function describeEvent(event: GithubEvent): string {
        const payload = event.payload as Record<string, unknown>;
        switch (event.type) {
          case "PushEvent": {
            const commits = (payload.commits as unknown[]) ?? [];
            return `Pushed ${commits.length} commit${commits.length !== 1 ? "s" : ""}`;
          }
          case "PullRequestEvent":
            return `${String(payload.action ?? "").replace(/_/g, " ")} pull request`;
          case "IssuesEvent":
            return `${String(payload.action ?? "").replace(/_/g, " ")} issue`;
          case "CreateEvent":
            return `Created ${String(payload.ref_type ?? "repository")}${payload.ref ? ` "${String(payload.ref)}"` : ""}`;
          case "DeleteEvent":
            return `Deleted ${String(payload.ref_type ?? "branch")} "${String(payload.ref ?? "")}"`;
          case "ForkEvent":
            return `Forked repository`;
          case "WatchEvent":
            return `Starred repository`;
          case "IssueCommentEvent":
            return `Commented on issue`;
          case "PullRequestReviewEvent":
            return `Reviewed pull request`;
          case "ReleaseEvent":
            return `${String(payload.action ?? "published")} release`;
          case "MemberEvent":
            return `${String(payload.action ?? "added")} member`;
          default:
            return event.type?.replace(/Event$/, "") ?? "Activity";
        }
      }

      const mapped = events.map((event) => ({
        id: event.id,
        type: event.type ?? null,
        repoName: event.repo?.name ?? "",
        repoUrl: `https://github.com/${event.repo?.name ?? ""}`,
        createdAt: event.created_at ?? new Date().toISOString(),
        description: describeEvent(event),
      }));

      res.json(GetGithubActivityResponse.parse(mapped));
    } catch (err) {
      if (handleOctokitError(err, req, res)) return;
      throw err;
    }
  },
);

export default router;
