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

  // Sidebar Links config based on role
  const getSidebarLinks = () => {
    if (role === "admin") {
      return [
        { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
        { to: "/crm", label: "CRM & Vendas", icon: FolderKanban },
        { to: "/novo-agendamento", label: "Novo Pedido", icon: CalendarPlus },
      ];
    } else if (role === "cliente") {
      return [
        { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
        { to: "/novo-agendamento", label: "Novo Pedido", icon: CalendarPlus },
        { to: "/meus-dados", label: "Meus Dados", icon: FolderKanban }, // Using FolderKanban or another icon
      ];
    }
    // Técnico role
    return [
      { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
    ];
  };

  const navLinks = getSidebarLinks();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row pb-16 md:pb-0">
      
      {/* Desktop Sidebar (Left Side) */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col justify-between h-screen sticky top-0 z-30 select-none">
        <div className="flex flex-col gap-6 py-6 px-4">
          {/* Logo Area */}
          <Link to="/dashboard" className="flex items-center gap-2 px-2">
            {branding?.logo_url ? (
              <div className="flex flex-col gap-1.5">
                <img src={branding.logo_url} alt="Logo" className="h-8 max-w-[180px] object-contain" />
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground w-fit">{roleLabel}</span>
              </div>
            ) : (
              <>
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-bold text-foreground">Quantis Obras</div>
                  <div className="text-[10px] font-semibold text-muted-foreground">{roleLabel}</div>
                </div>
              </>
            )}
          </Link>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5 mt-4">
            {navLinks.map((link) => {
              const LinkIcon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  activeProps={{ className: "bg-primary/10 text-primary border-primary/20 font-medium" }}
                  inactiveProps={{ className: "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent" }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all border"
                >
                  <LinkIcon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Desktop Footer (User Profile & Sign Out) */}
        <div className="p-4 border-t border-border bg-muted/20 space-y-3">
          <div className="flex flex-col px-2">
            <span className="text-xs text-muted-foreground truncate" title={user.email}>
              {user.email}
            </span>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9">
                <LogOut className="mr-2 h-4 w-4" /> Sair da Conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border border-border">
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
      </aside>

      {/* Mobile Sticky Header */}
      <header className="flex md:hidden border-b border-border bg-card h-14 items-center justify-between px-4 sticky top-0 z-40 backdrop-blur-md bg-card/90 w-full shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="h-7 max-w-[120px] object-contain" />
          ) : (
            <span className="text-sm font-bold text-foreground">Quantis Obras</span>
          )}
        </Link>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">{roleLabel}</span>
      </header>

      {/* Right/Main Content Container */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-md border-t border-border z-40 px-4 items-center justify-around shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
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
            <span>Pedido</span>
          </Link>
        )}

        {role === "cliente" && (
          <Link
            to="/meus-dados"
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-col items-center gap-1 text-[10px] font-medium py-1 px-3 transition-colors"
          >
            <FolderKanban className="h-5 w-5" />
            <span>Dados</span>
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