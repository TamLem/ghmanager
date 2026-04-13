import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { 
  useGetGithubAuthStatus, 
  useGetGithubProfile, 
  useGetGithubStats,
  useGetGithubActivity,
  useUpdateGithubProfile,
  getGetGithubProfileQueryKey,
  getGetGithubAuthStatusQueryKey,
  getGetGithubStatsQueryKey,
  getGetGithubActivityQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Users, GitFork, Star, BookMarked, MapPin, Link as LinkIcon, Building2, Twitter, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: auth, isLoading: isLoadingAuth, error: authError } = useGetGithubAuthStatus({ query: { retry: false, queryKey: getGetGithubAuthStatusQueryKey() }});
  
  useEffect(() => {
    if (authError || (auth && !auth.authenticated)) {
      setLocation("/");
    }
  }, [auth, authError, setLocation]);

  const { data: profile, isLoading: isLoadingProfile } = useGetGithubProfile({ query: { enabled: !!auth?.authenticated, queryKey: getGetGithubProfileQueryKey() }});
  const { data: stats, isLoading: isLoadingStats } = useGetGithubStats({ query: { enabled: !!auth?.authenticated, queryKey: getGetGithubStatsQueryKey() }});
  const { data: activity, isLoading: isLoadingActivity } = useGetGithubActivity({ per_page: 20 }, { query: { enabled: !!auth?.authenticated, queryKey: getGetGithubActivityQueryKey({ per_page: 20 }) }});
  
  const updateProfile = useUpdateGithubProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    location: "",
    blog: "",
    twitterUsername: "",
    company: ""
  });

  useEffect(() => {
    if (profile) {
      setEditForm({
        name: profile.name || "",
        bio: profile.bio || "",
        location: profile.location || "",
        blog: profile.blog || "",
        twitterUsername: profile.twitterUsername || "",
        company: profile.company || ""
      });
    }
  }, [profile]);

  const handleSaveProfile = () => {
    updateProfile.mutate({ data: editForm }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetGithubProfileQueryKey(), data);
        setIsEditOpen(false);
        toast({ title: "Profile updated" });
      },
      onError: () => {
        toast({ title: "Update failed", variant: "destructive" });
      }
    });
  };

  if (isLoadingAuth || !auth?.authenticated) return <div className="h-screen bg-background" />;

  return (
    <SidebarLayout>
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        </div>

        {isLoadingProfile ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 flex gap-6 items-start">
              <Skeleton className="w-24 h-24 rounded-full" />
              <div className="space-y-4 flex-1">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </CardContent>
          </Card>
        ) : profile ? (
          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-6 flex flex-col md:flex-row gap-8 items-start relative">
              <img src={profile.avatarUrl} alt="Avatar" className="w-32 h-32 rounded-xl shadow-lg border border-border" />
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{profile.name || profile.login}</h2>
                  <p className="text-muted-foreground font-mono text-sm">{profile.login}</p>
                </div>
                {profile.bio && <p className="text-foreground max-w-2xl">{profile.bio}</p>}
                
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {profile.followers} followers · {profile.following} following</div>
                  {profile.location && <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {profile.location}</div>}
                  {profile.company && <div className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> {profile.company}</div>}
                  {profile.blog && <div className="flex items-center gap-1.5"><LinkIcon className="w-4 h-4" /> <a href={profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`} target="_blank" rel="noreferrer" className="hover:text-primary">{profile.blog}</a></div>}
                  {profile.twitterUsername && <div className="flex items-center gap-1.5"><Twitter className="w-4 h-4" /> @{profile.twitterUsername}</div>}
                </div>
              </div>
              
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="md:absolute md:top-6 md:right-6">Edit Profile</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Name</Label>
                      <Input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Bio</Label>
                      <Textarea value={editForm.bio} onChange={e => setEditForm(f => ({...f, bio: e.target.value}))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Location</Label>
                        <Input value={editForm.location} onChange={e => setEditForm(f => ({...f, location: e.target.value}))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Company</Label>
                        <Input value={editForm.company} onChange={e => setEditForm(f => ({...f, company: e.target.value}))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Website</Label>
                        <Input value={editForm.blog} onChange={e => setEditForm(f => ({...f, blog: e.target.value}))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Twitter</Label>
                        <Input value={editForm.twitterUsername} onChange={e => setEditForm(f => ({...f, twitterUsername: e.target.value}))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                      {updateProfile.isPending ? "Saving..." : "Save changes"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : null}

        {isLoadingStats ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : stats ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><BookMarked className="w-4 h-4 text-primary" /> Total Repos</CardDescription>
                  <CardTitle className="text-3xl">{stats.totalRepos}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Total Stars</CardDescription>
                  <CardTitle className="text-3xl">{stats.totalStars}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><GitFork className="w-4 h-4 text-muted-foreground" /> Total Forks</CardDescription>
                  <CardTitle className="text-3xl">{stats.totalForks}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">Public / Private</CardDescription>
                  <CardTitle className="text-3xl">{stats.publicRepos} <span className="text-muted-foreground text-lg">/ {stats.privateRepos}</span></CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Top Languages</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {stats.languageBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.languageBreakdown.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 40 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="language" type="category" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          cursor={{ fill: 'hsl(var(--muted)/0.5)' }} 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} 
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                          {stats.languageBreakdown.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(var(--primary))`}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">No language data</div>
                  )}
                </CardContent>
              </Card>

              {stats.mostStarredRepo && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Most Starred Repository</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <a href={stats.mostStarredRepo.htmlUrl} target="_blank" rel="noreferrer" className="text-lg font-semibold text-primary hover:underline">
                          {stats.mostStarredRepo.name}
                        </a>
                        <p className="text-sm text-muted-foreground mt-1">{stats.mostStarredRepo.description || "No description"}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500" /> {stats.mostStarredRepo.stargazersCount}</span>
                        <span className="flex items-center gap-1"><GitFork className="w-4 h-4" /> {stats.mostStarredRepo.forksCount}</span>
                        {stats.mostStarredRepo.language && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {stats.mostStarredRepo.language}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : null}

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="divide-y divide-border">
                {activity.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-foreground">{event.description}</span>
                        <span className="text-muted-foreground text-xs">in</span>
                        <a
                          href={event.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline font-mono truncate"
                        >
                          {event.repoName}
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No recent activity found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
