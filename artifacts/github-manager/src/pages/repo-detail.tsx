import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetGithubAuthStatus,
  useGetGithubRepo,
  useUpdateGithubRepo,
  useDeleteGithubRepo,
  getGetGithubAuthStatusQueryKey,
  getGetGithubRepoQueryKey,
  getListGithubReposQueryKey,
} from "@workspace/api-client-react";
import type { GithubRepo } from "@workspace/api-zod";
import { UpdateGithubRepoBody } from "@workspace/api-zod";
import type { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Star,
  GitFork,
  Eye,
  CircleDot,
  Lock,
  Globe,
  Archive,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  GitBranch,
  Tag,
  Calendar,
} from "lucide-react";

type RepoUpdate = z.infer<typeof UpdateGithubRepoBody>;

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Ruby: "#701516",
  Java: "#b07219",
  "C++": "#b07219",
  C: "#555555",
  "C#": "#f34b7d",
  Shell: "#89e051",
  Vue: "#41b883",
  PHP: "#4F5D95",
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 rounded-lg border border-border bg-card/60">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function RepoDetail() {
  const { owner, name } = useParams<{ owner: string; name: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: auth, error: authError } = useGetGithubAuthStatus({
    query: { retry: false, queryKey: getGetGithubAuthStatusQueryKey() },
  });

  useEffect(() => {
    if (authError || (auth && !auth.authenticated)) {
      setLocation("/");
    }
  }, [auth, authError, setLocation]);

  const repoQueryKey = getGetGithubRepoQueryKey(owner, name);
  const { data: repo, isLoading, error: repoError } = useGetGithubRepo(owner, name, {
    query: { enabled: !!auth?.authenticated, queryKey: repoQueryKey },
  });

  const updateRepo = useUpdateGithubRepo();
  const deleteRepo = useDeleteGithubRepo();

  const [copied, setCopied] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleCopyCloneUrl = () => {
    if (!repo) return;
    navigator.clipboard.writeText(repo.cloneUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleUpdate = (updates: RepoUpdate) => {
    if (!repo) return;
    const prevData = queryClient.getQueryData<GithubRepo>(repoQueryKey);
    queryClient.setQueryData<GithubRepo>(repoQueryKey, (prev) => prev ? { ...prev, ...updates } : prev);
    queryClient.setQueryData<GithubRepo[]>(
      getListGithubReposQueryKey({ sort: "updated", direction: "desc", per_page: 100 }),
      (prev) => prev?.map((r) => r.id === repo.id ? { ...r, ...updates } : r)
    );
    updateRepo.mutate({ owner, repo: name, data: updates }, {
      onSuccess: (updated) => {
        queryClient.setQueryData<GithubRepo>(repoQueryKey, updated);
        toast({ title: "Repository updated" });
      },
      onError: () => {
        if (prevData) queryClient.setQueryData<GithubRepo>(repoQueryKey, prevData);
        toast({ title: "Update failed", variant: "destructive" });
      },
    });
  };

  const handleDelete = () => {
    if (!repo) return;
    deleteRepo.mutate({ owner, repo: name }, {
      onSuccess: () => {
        queryClient.setQueryData<GithubRepo[]>(
          getListGithubReposQueryKey({ sort: "updated", direction: "desc", per_page: 100 }),
          (prev) => prev?.filter((r) => r.id !== repo.id) ?? []
        );
        toast({ title: "Repository deleted", description: `${repo.fullName} has been permanently deleted.` });
        setLocation("/repos");
      },
      onError: () => {
        toast({
          title: "Delete failed",
          description: "Could not delete repository. Make sure your token has the delete_repo scope.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <SidebarLayout>
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background">
        <div className="p-6 border-b border-border bg-card/50 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground mb-4 -ml-2"
            onClick={() => setLocation("/repos")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to repositories
          </Button>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-5 w-96" />
            </div>
          ) : repoError ? (
            <div className="text-destructive">Failed to load repository. It may not exist or you may not have access.</div>
          ) : repo ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{repo.fullName}</h1>
                <Badge
                  variant="outline"
                  className={repo.private ? "text-amber-500 border-amber-500/30" : "text-emerald-500 border-emerald-500/30"}
                >
                  {repo.private ? <Lock className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                  {repo.private ? "Private" : "Public"}
                </Badge>
                {repo.fork && (
                  <Badge variant="outline" className="text-sky-400 border-sky-400/30">
                    <GitFork className="w-3 h-3 mr-1" />
                    Forked
                  </Badge>
                )}
                {repo.archived && (
                  <Badge variant="secondary">
                    <Archive className="w-3 h-3 mr-1" />
                    Archived
                  </Badge>
                )}
                {repo.language && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: languageColors[repo.language] || "#ccc" }}
                    />
                    {repo.language}
                  </div>
                )}
              </div>
              {repo.description && (
                <p className="text-muted-foreground">{repo.description}</p>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={repo.htmlUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    View on GitHub
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {repo && (
          <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile icon={<Star className="w-5 h-5" />} label="Stars" value={repo.stargazersCount} />
              <StatTile icon={<GitFork className="w-5 h-5" />} label="Forks" value={repo.forksCount} />
              <StatTile icon={<Eye className="w-5 h-5" />} label="Watchers" value={repo.watchersCount} />
              <StatTile icon={<CircleDot className="w-5 h-5" />} label="Issues" value={repo.openIssuesCount} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GitBranch className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-foreground">Default branch:</span>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{repo.defaultBranch}</code>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-foreground">Created:</span>
                    {formatDate(repo.createdAt)}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-foreground">Last updated:</span>
                    {formatDate(repo.updatedAt)}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-foreground">Last pushed:</span>
                    {formatDate(repo.pushedAt)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Clone URL</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={repo.cloneUrl}
                    className="font-mono text-xs bg-muted border-muted"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyCloneUrl} className="shrink-0">
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {repo.topics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Topics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {repo.topics.map((topic) => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Private</Label>
                    <div className="text-xs text-muted-foreground">
                      {repo.fork
                        ? "Visibility cannot be changed for forked repositories."
                        : "Only you and collaborators can view this repository."}
                    </div>
                  </div>
                  <Switch
                    checked={repo.private}
                    disabled={repo.fork || updateRepo.isPending}
                    onCheckedChange={(checked) => handleUpdate({ private: checked })}
                  />
                </div>

                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Archived</Label>
                    <div className="text-xs text-muted-foreground">
                      Archived repositories are read-only and hidden from contribution graphs.
                    </div>
                  </div>
                  <Switch
                    checked={repo.archived}
                    disabled={updateRepo.isPending}
                    onCheckedChange={(checked) => handleUpdate({ archived: checked })}
                  />
                </div>

                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Issues</Label>
                    <div className="text-xs text-muted-foreground">
                      Allow contributors to track and discuss bugs and feature requests.
                    </div>
                  </div>
                  <Switch
                    checked={repo.hasIssues}
                    disabled={updateRepo.isPending}
                    onCheckedChange={(checked) => handleUpdate({ hasIssues: checked })}
                  />
                </div>

                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Wiki</Label>
                    <div className="text-xs text-muted-foreground">
                      Allow contributors to add and edit wiki pages.
                    </div>
                  </div>
                  <Switch
                    checked={repo.hasWiki}
                    disabled={updateRepo.isPending}
                    onCheckedChange={(checked) => handleUpdate({ hasWiki: checked })}
                  />
                </div>

                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Projects</Label>
                    <div className="text-xs text-muted-foreground">
                      Organize and prioritize work with project boards.
                    </div>
                  </div>
                  <Switch
                    checked={repo.hasProjects}
                    disabled={updateRepo.isPending}
                    onCheckedChange={(checked) => handleUpdate({ hasProjects: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between border border-destructive/30 rounded-lg p-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Delete this repository</div>
                    <div className="text-xs text-muted-foreground">
                      Once deleted, there is no going back. All content, history, and issues will be lost.
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setDeleteConfirmName(""); setShowDeleteDialog(true); }}
                    className="shrink-0 ml-4"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setDeleteConfirmName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Delete repository</DialogTitle>
            <DialogDescription>
              This action <strong>cannot be undone</strong>. This will permanently delete the{" "}
              <strong>{repo?.fullName}</strong> repository, including all its content, issues, and history.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{repo?.name}</span> to confirm deletion
            </Label>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={repo?.name}
              className="font-mono"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteConfirmName(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== repo?.name || deleteRepo.isPending}
              onClick={handleDelete}
            >
              {deleteRepo.isPending ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
