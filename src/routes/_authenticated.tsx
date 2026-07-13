import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { Button } from "@/components/ui/button";
import { FlaskConical, LogOut, LayoutDashboard, CalendarPlus, FolderKanban } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function AuthLayout() {
  const { user, loading, roles, signOut } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Carregando…</div>;
  }

  const role = primaryRole(roles);
  const roleLabel = role === "admin" ? "Administrador" : role === "tecnico" ? "Técnico" : "Cliente";

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* Desktop Header */}
      <header className="hidden md:block border-b border-border bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              {branding?.logo_url ? (
                <div className="flex items-center gap-2">
                  <img src={branding.logo_url} alt="Logo" className="h-8 max-w-[150px] object-contain" />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">{roleLabel}</span>
                </div>
              ) : (
                <>
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
                    <FlaskConical className="h-5 w-5" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-bold text-foreground">Quantis Obras</div>
                    <div className="text-xs text-muted-foreground">{roleLabel}</div>
                  </div>
                </>
              )}
            </Link>

            <nav className="flex items-center gap-4 ml-6 pl-6 border-l border-border">
              <Link
                to="/dashboard"
                activeProps={{ className: "text-primary font-medium" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="text-sm transition-colors"
              >
                Painel
              </Link>
              {role === "admin" && (
                <Link
                  to="/crm"
                  activeProps={{ className: "text-primary font-medium" }}
                  inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                  className="text-sm transition-colors"
                >
                  CRM
                </Link>
              )}
              {(role === "cliente" || role === "admin") && (
                <Link
                  to="/novo-agendamento"
                  activeProps={{ className: "text-primary font-medium" }}
                  inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                  className="text-sm transition-colors"
                >
                  Novo Pedido
                </Link>
              )}
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <LogOut className="mr-1 h-4 w-4" /> Sair
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deseja mesmo sair?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você será desconectado da sua conta atual e precisará fazer login novamente para acessar a plataforma.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => signOut()}>
                    Sim, sair
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Mobile Sticky Header */}
      <header className="flex md:hidden border-b border-border bg-card h-14 items-center justify-between px-4 sticky top-0 z-40 backdrop-blur-md bg-card/90">
        <Link to="/dashboard" className="flex items-center gap-2">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="h-7 max-w-[120px] object-contain" />
          ) : (
            <span className="text-sm font-bold text-foreground">Quantis Obras</span>
          )}
        </Link>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">{roleLabel}</span>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-md border-t border-border z-40 px-6 items-center justify-around shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <Link
          to="/dashboard"
          activeProps={{ className: "text-primary" }}
          inactiveProps={{ className: "text-muted-foreground" }}
          className="flex flex-col items-center gap-1 text-[10px] font-medium py-1 px-3 transition-colors"
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Painel</span>
        </Link>

        {role === "admin" && (
          <Link
            to="/crm"
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-col items-center gap-1 text-[10px] font-medium py-1 px-3 transition-colors"
          >
            <FolderKanban className="h-5 w-5" />
            <span>CRM</span>
          </Link>
        )}

        {(role === "cliente" || role === "admin") && (
          <Link
            to="/novo-agendamento"
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-col items-center gap-1 text-[10px] font-medium py-1 px-3 transition-colors"
          >
            <CalendarPlus className="h-5 w-5" />
            <span>Novo Pedido</span>
          </Link>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex flex-col items-center gap-1 text-[10px] font-medium py-1 px-3 text-muted-foreground hover:text-red-500 transition-colors bg-transparent border-0 cursor-pointer focus-visible:outline-none">
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deseja mesmo sair?</AlertDialogTitle>
              <AlertDialogDescription>
                Você será desconectado da sua conta atual e precisará fazer login novamente para acessar a plataforma.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => signOut()}>
                Sim, sair
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </nav>
    </div>
  );
}