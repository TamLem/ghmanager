import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetGithubAuthStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Github, Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: authStatus, isLoading: isLoadingAuth } = useGetGithubAuthStatus();

  useEffect(() => {
    if (authStatus?.authenticated) {
      setLocation("/dashboard");
    }
  }, [authStatus, setLocation]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/github/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      if (res.ok) {
        toast({ title: "Connected", description: "Successfully authenticated with GitHub." });
        window.location.href = "/dashboard";
      } else {
        const err = await res.json();
        toast({ title: "Connection failed", description: err.error || "Invalid token.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Connection failed", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-background"><Terminal className="h-8 w-8 animate-pulse text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background dark p-4 text-foreground selection:bg-primary/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-background to-background pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-card rounded-2xl border border-border shadow-xl">
            <Github className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">GH Manager</h1>
          <p className="text-muted-foreground text-lg">Your GitHub command center. Precise, fast, and dense.</p>
        </div>

        <Card className="border-border/50 shadow-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl">Connect Account</CardTitle>
            <CardDescription>Enter a Personal Access Token to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConnect} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="token" className="text-muted-foreground">Personal Access Token (Classic)</Label>
                <Input 
                  id="token" 
                  type="password" 
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" 
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="font-mono bg-background/50"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Needs <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">repo</code> and <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">user</code> scopes.{" "}
                  <a 
                    href="https://github.com/settings/tokens/new?scopes=repo,user" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-primary hover:underline underline-offset-4"
                  >
                    Generate one here
                  </a>.
                </p>
              </div>
              <Button type="submit" className="w-full font-medium" disabled={isLoading || !token}>
                {isLoading ? "Connecting..." : "Connect GitHub"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
