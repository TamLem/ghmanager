import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useGetGithubAuthStatus,
  getGetGithubAuthStatusQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Github, Terminal, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured: "GitHub OAuth is not yet configured on this server.",
  state_mismatch: "Security check failed. Please try again.",
  no_code: "GitHub did not return an authorization code. Please try again.",
  access_denied: "Access was denied. Please authorize the app to continue.",
  auth_failed: "Authentication failed. Please try again.",
  token_exchange_failed: "Could not exchange the authorization code for a token.",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const { data: authStatus, isLoading: isLoadingAuth } = useGetGithubAuthStatus({
    query: { queryKey: getGetGithubAuthStatusQueryKey() },
  });

  const errorParam = new URLSearchParams(search).get("error");
  const errorMessage = errorParam
    ? (ERROR_MESSAGES[errorParam] ?? decodeURIComponent(errorParam))
    : null;

  useEffect(() => {
    if (authStatus?.authenticated) {
      setLocation("/dashboard");
    }
  }, [authStatus, setLocation]);

  useEffect(() => {
    if (errorMessage) {
      toast({ title: "Connection failed", description: errorMessage, variant: "destructive" });
    }
  }, [errorMessage, toast]);

  const handleConnect = () => {
    window.location.href = "/api/github/auth/login";
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Terminal className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

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
            <CardDescription>Sign in with GitHub to manage your repositories and profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <Button className="w-full font-medium gap-2" onClick={handleConnect}>
              <Github className="h-4 w-4" />
              Connect with GitHub
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Requests <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">repo</code>,{" "}
              <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">user</code>, and{" "}
              <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">delete_repo</code> scopes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
