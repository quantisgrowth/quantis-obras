import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { FlaskConical, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Quantis Obras" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, navigate]);

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

    const { error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    });
    setLoading(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta!");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-elegant)] border border-border">
        <CardHeader className="space-y-3 text-center">
          <div
            className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground select-none"
            title="Quantis Obras"
          >
            <FlaskConical className="h-6 w-6" />
          </div>
          <CardTitle>Acesso à Plataforma</CardTitle>
          <CardDescription>
            Área de login para gestores e empresas de Controle Tecnológico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-0 p-0"
                  disabled={loading}
                >
                  Esqueceu a senha?
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
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
            <p className="text-center text-sm text-muted-foreground pt-2">
              Ainda não tem conta? <Link to="/signup" className="font-semibold text-primary hover:underline">Criar conta</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}