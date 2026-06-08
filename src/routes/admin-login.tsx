import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck, ChevronLeft, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin-login")({
  head: () => ({ meta: [{ title: "Acesso Administrativo — Quantis Obras" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in and role is verified
  useEffect(() => {
    if (user && roles.length > 0) {
      if (roles.includes("admin")) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        // Automatically logout standard users attempting to access the admin portal
        supabase.auth.signOut();
        toast.error("Acesso negado", {
          description: "Este perfil não possui privilégios administrativos.",
        });
      }
    }
  }, [user, roles, navigate]);

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Por favor, preencha o e-mail no campo acima antes de clicar em recuperar.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao enviar recuperação", { description: error.message });
      return;
    }
    toast.success("E-mail de recuperação enviado!", {
      description: "Verifique sua caixa de entrada e spam para redefinir sua senha.",
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Falha no login", { description: error.message });
        setLoading(false);
        return;
      }

      const sessionUser = authData.user;
      if (!sessionUser) {
        toast.error("Erro inesperado ao efetuar o login.");
        setLoading(false);
        return;
      }

      // Pre-check the role immediately
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionUser.id);

      const userRoles = (rolesData ?? []).map((r) => r.role);

      if (!userRoles.includes("admin")) {
        await supabase.auth.signOut();
        toast.error("Acesso negado", {
          description: "Este perfil não possui privilégios administrativos.",
        });
        setLoading(false);
        return;
      }

      toast.success("Acesso administrativo concedido!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error("Erro no login", { description: err?.message || String(err) });
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-950 px-4 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-4">
        {/* Back navigation */}
        <Link
          to="/login"
          className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors gap-1 group"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Voltar para Login Geral
        </Link>

        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-3 text-center border-b border-zinc-800/50 pb-6">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold text-zinc-100">Painel Administrativo</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Área de acesso restrito para gerenciamento e auditoria da Quantis Obras.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300 text-xs font-bold uppercase tracking-wider">
                  E-mail Administrativo
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="admin@quantis.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500 focus-visible:border-amber-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-zinc-300 text-xs font-bold uppercase tracking-wider">
                    Senha de Acesso
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-amber-500 hover:text-amber-400 hover:underline cursor-pointer bg-transparent border-0 p-0 transition-colors"
                    disabled={loading}
                  >
                    Recuperar Senha
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500 focus-visible:border-amber-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-zinc-950 font-bold transition-all mt-2"
                disabled={loading || authLoading}
              >
                {loading ? "Verificando Acesso…" : "Entrar no Sistema"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
