import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { 
  useGetGithubAuthStatus, 
  useListGithubRepos,
  useCreateGithubRepo,
  useUpdateGithubRepo,
  useDeleteGithubRepo,
  getListGithubReposQueryKey,
  getGetGithubAuthStatusQueryKey
} from "@workspace/api-client-react";
import type { GithubRepo } from "@workspace/api-zod";
import { UpdateGithubRepoBody } from "@workspace/api-zod";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Star, GitFork, Lock, Globe, Archive, 
  CircleDot, MoreVertical, Plus, BookOpen, Bug, Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

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

export default function Repositories() {
  const [, setLocation] = useLocation();
  const { data: auth, error: authError } = useGetGithubAuthStatus({ query: { retry: false, queryKey: getGetGithubAuthStatusQueryKey() }});
  
  useEffect(() => {
    if (authError || (auth && !auth.authenticated)) {
      setLocation("/");
    }
  }, [auth, authError, setLocation]);

  const { data: repos, isLoading } = useListGithubRepos({ sort: "updated", direction: "desc", per_page: 100 }, { query: { enabled: !!auth?.authenticated, queryKey: getListGithubReposQueryKey({ sort: "updated", direction: "desc", per_page: 100 }) } });
  const updateRepo = useUpdateGithubRepo();
  const createRepo = useCreateGithubRepo();
  const deleteRepo = useDeleteGithubRepo();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    description: "",
    private: false,
    autoInit: true
  });

  const [deleteTarget, setDeleteTarget] = useState<GithubRepo | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const repoQueryKey = getListGithubReposQueryKey({ sort: "updated", direction: "desc", per_page: 100 });

  const handleUpdate = (repoId: number, owner: string, name: string, updates: RepoUpdate) => {
    const prevRepos = queryClient.getQueryData<GithubRepo[]>(repoQueryKey);
    if (prevRepos) {
      queryClient.setQueryData<GithubRepo[]>(
        repoQueryKey,
        prevRepos.map(r => r.id === repoId ? { ...r, ...updates } : r)
      );
    }
    
    updateRepo.mutate({ owner, repo: name, data: updates }, {
      onSuccess: () => {
        toast({ title: "Repository updated" });
      },
      onError: () => {
        toast({ title: "Update failed", variant: "destructive" });
        if (prevRepos) {
          queryClient.setQueryData<GithubRepo[]>(repoQueryKey, prevRepos);
        }
      }
    });
  };

  const handleCreate = () => {
    createRepo.mutate({ data: newForm }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListGithubReposQueryKey() });
        setIsNewOpen(false);
        setNewForm({ name: "", description: "", private: false, autoInit: true });
        toast({ title: "Repository created", description: `Successfully created ${data.fullName}` });
      },
      onError: (err: Error) => {
        toast({ title: "Creation failed", description: err.message || "Could not create repo", variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const owner = deleteTarget.fullName.split("/")[0];
    deleteRepo.mutate({ owner, repo: deleteTarget.name }, {
      onSuccess: () => {
        queryClient.setQueryData<GithubRepo[]>(
          repoQueryKey,
          (prev) => prev?.filter(r => r.id !== deleteTarget.id) ?? []
        );
        toast({ title: "Repository deleted", description: `${deleteTarget.fullName} has been permanently deleted.` });
        setDeleteTarget(null);
        setDeleteConfirmName("");
      },
      onError: () => {
        toast({ title: "Delete failed", description: "Could not delete repository. Make sure your token has the delete_repo scope.", variant: "destructive" });
      }
    });
  };

  const filteredRepos = repos?.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase()));

  return (
    <SidebarLayout>
      <div className="flex-1 flex flex-col h-full">
        <div className="p-6 border-b border-border bg-card/50 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Find a repository..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          
          <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0 w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> New Repository</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new repository</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Repository Name *</Label>
                  <Input value={newForm.name} onChange={e => setNewForm(f => ({...f, name: e.target.value}))} autoFocus />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={newForm.description} onChange={e => setNewForm(f => ({...f, description: e.target.value}))} />
                </div>
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div className="space-y-0.5">
                    <Label>Private</Label>
                    <div className="text-xs text-muted-foreground">Only you can see this repository.</div>
                  </div>
                  <Switch checked={newForm.private} onCheckedChange={c => setNewForm(f => ({...f, private: c}))} />
                </div>
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div className="space-y-0.5">
                    <Label>Initialize with README</Label>
                    <div className="text-xs text-muted-foreground">Add a README.md file.</div>
                  </div>
                  <Switch checked={newForm.autoInit} onCheckedChange={c => setNewForm(f => ({...f, autoInit: c}))} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createRepo.isPending || !newForm.name}>
                  {createRepo.isPending ? "Creating..." : "Create Repository"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="flex flex-col gap-3 max-w-5xl mx-auto">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)
            ) : filteredRepos?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No repositories found matching your search.</div>
            ) : (
              filteredRepos?.map(repo => {
                const owner = repo.fullName.split('/')[0];
                return (
                  <Card key={repo.id} className="flex flex-col sm:flex-row gap-4 p-5 hover:border-primary/50 transition-colors border-border bg-card">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/repos/${owner}/${repo.name}`} className="text-lg font-semibold text-primary hover:underline truncate">
                          {repo.name}
                        </Link>
                        <Badge variant="outline" className={`shrink-0 ${repo.private ? 'text-amber-500 border-amber-500/30' : 'text-emerald-500 border-emerald-500/30'}`}>
                          {repo.private ? <Lock className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                          {repo.private ? "Private" : "Public"}
                        </Badge>
                        {repo.fork && (
                          <Badge variant="outline" className="shrink-0 text-sky-400 border-sky-400/30">
                            <GitFork className="w-3 h-3 mr-1" />
                            Forked
                          </Badge>
                        )}
                        {repo.archived && <Badge variant="secondary" className="shrink-0"><Archive className="w-3 h-3 mr-1" /> Archived</Badge>}
                      </div>
                      
                      <p className="text-muted-foreground text-sm line-clamp-2">
                        {repo.description || <span className="italic opacity-50">No description provided.</span>}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                        {repo.language && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: languageColors[repo.language] || "#ccc" }} />
                            {repo.language}
                          </div>
                        )}
                        {repo.stargazersCount > 0 && <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-muted-foreground" /> {repo.stargazersCount}</div>}
                        {repo.forksCount > 0 && <div className="flex items-center gap-1"><GitFork className="w-3.5 h-3.5 text-muted-foreground" /> {repo.forksCount}</div>}
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1" title={repo.hasIssues ? "Issues enabled" : "Issues disabled"}><Bug className={`w-3.5 h-3.5 ${repo.hasIssues ? 'text-primary' : 'opacity-30'}`} /></span>
                          <span className="flex items-center gap-1" title={repo.hasWiki ? "Wiki enabled" : "Wiki disabled"}><BookOpen className={`w-3.5 h-3.5 ${repo.hasWiki ? 'text-primary' : 'opacity-30'}`} /></span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 flex sm:flex-col items-center justify-end gap-2 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8 self-end">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {!repo.fork ? (
                            <DropdownMenuItem onClick={() => handleUpdate(repo.id, owner, repo.name, { private: !repo.private })}>
                              {repo.private ? "Make Public" : "Make Private"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled className="text-muted-foreground/50 cursor-not-allowed">
                              <Lock className="w-3.5 h-3.5 mr-2 opacity-40" />
                              Can't make fork private
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleUpdate(repo.id, owner, repo.name, { archived: !repo.archived })}>
                            {repo.archived ? "Unarchive" : "Archive"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleUpdate(repo.id, owner, repo.name, { hasIssues: !repo.hasIssues })}>
                            {repo.hasIssues ? "Disable Issues" : "Enable Issues"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdate(repo.id, owner, repo.name, { hasWiki: !repo.hasWiki })}>
                            {repo.hasWiki ? "Disable Wiki" : "Enable Wiki"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                            onClick={() => { setDeleteTarget(repo); setDeleteConfirmName(""); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete repository
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Delete repository</DialogTitle>
            <DialogDescription>
              This action <strong>cannot be undone</strong>. This will permanently delete the{" "}
              <strong>{deleteTarget?.fullName}</strong> repository, including all its content, issues, and history.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{deleteTarget?.name}</span> to confirm deletion
            </Label>
            <Input
              value={deleteConfirmName}
              onChange={e => setDeleteConfirmName(e.target.value)}
              placeholder={deleteTarget?.name}
              className="font-mono"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== deleteTarget?.name || deleteRepo.isPending}
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
