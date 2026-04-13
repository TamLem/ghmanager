import { useLocation } from "wouter";
import { Link } from "wouter";
import { 
  Github, 
  LayoutDashboard, 
  BookMarked,
  LogOut
} from "lucide-react";
import { useGetGithubAuthStatus } from "@workspace/api-client-react";
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
  const [location, setLocation] = useLocation();
  const { data: authStatus } = useGetGithubAuthStatus();
  const { toast } = useToast();

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/github/auth/disconnect', { method: 'POST' });
      if (res.ok) {
        toast({ title: "Disconnected", description: "Successfully disconnected from GitHub." });
        setLocation("/");
      } else {
        toast({ title: "Error", description: "Failed to disconnect.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to disconnect.", variant: "destructive" });
    }
  };

  return (
    <SidebarProvider>
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
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleDisconnect}>
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background dark text-foreground">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden h-screen">
        {children}
      </main>
    </div>
  );
}
