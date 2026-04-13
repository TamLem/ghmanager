import { useLocation } from "wouter";
import { Link } from "wouter";
import { 
  Github, 
  LayoutDashboard, 
  BookMarked,
  LogOut
} from "lucide-react";
import { 
  useGetGithubAuthStatus,
  useDisconnectGithub,
  getGetGithubAuthStatusQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { data: authStatus } = useGetGithubAuthStatus({ query: { queryKey: getGetGithubAuthStatusQueryKey() } });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const disconnectGithub = useDisconnectGithub();

  const handleDisconnect = () => {
    disconnectGithub.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getGetGithubAuthStatusQueryKey(), { authenticated: false, login: null, avatarUrl: null });
        queryClient.clear();
        toast({ title: "Disconnected", description: "Successfully disconnected from GitHub." });
        setLocation("/");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to disconnect.", variant: "destructive" });
      }
    });
  };

  return (
    <Sidebar variant="inset" className="dark">
      <SidebarHeader className="py-4">
        <div className="flex items-center gap-2 px-4">
          <Github className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg tracking-tight">GH Manager</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={location === "/dashboard"}
              tooltip="Dashboard"
            >
              <Link href="/dashboard">
                <LayoutDashboard />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={location === "/repos"}
              tooltip="Repositories"
            >
              <Link href="/repos">
                <BookMarked />
                <span>Repositories</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {authStatus?.authenticated && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-2">
              {authStatus.avatarUrl ? (
                <img src={authStatus.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted" />
              )}
              <span className="text-sm font-medium">{authStatus.login}</span>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground hover:text-foreground" 
              onClick={handleDisconnect}
              disabled={disconnectGithub.isPending}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {disconnectGithub.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark text-foreground">
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden h-screen">
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
