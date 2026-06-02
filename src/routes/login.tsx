import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { FlaskConical } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Geraltest Brasil" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<"cliente" | "tecnico">("cliente");

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground animate-pulse">
            <FlaskConical className="h-6 w-6" />
          </div>
          <CardTitle>Entrar na Geraltest</CardTitle>
          <CardDescription>
            {loginType === "cliente"
              ? "Acesse seu painel de agendamentos e obras."
              : "Acesse sua agenda de trabalho e convites de ensaios."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="cliente" onValueChange={(val) => setLoginType(val as "cliente" | "tecnico")} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cliente">Cliente / Gestor</TabsTrigger>
              <TabsTrigger value="tecnico">Técnico</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required placeholder="seuemail@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
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
              <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
            {loginType === "cliente" && (
              <p className="text-center text-sm text-muted-foreground pt-2">
                Ainda não tem conta? <Link to="/signup" className="font-semibold text-primary hover:underline">Criar conta</Link>
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}