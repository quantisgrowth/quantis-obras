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
import { useBranding } from "@/hooks/use-branding";
import { FlaskConical, Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Quantis Obras" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<"cliente" | "tecnico">("cliente");
  const [clickCount, setClickCount] = useState(0);

  const handleLogoClick = () => {
    setClickCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        toast.info("Acessando área restrita...");
        navigate({ to: "/admin-login" });
        return 0;
      }
      return next;
    });
  };

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

    let loginEmail = email.trim();
    const cleanCpf = loginEmail.replace(/\D/g, "");
    const isCpf = cleanCpf.length === 11 && !loginEmail.includes("@");

    if (isCpf) {
      try {
        const { data: resolvedEmail, error: rpcError } = await supabase
          .rpc("get_email_by_cpf", { p_cpf: cleanCpf });

        if (rpcError) {
          toast.error("Erro ao processar login por CPF.");
          console.error("RPC Error:", rpcError);
          setLoading(false);
          return;
        }

        if (resolvedEmail) {
          loginEmail = resolvedEmail;
        } else {
          toast.error("Nenhum técnico cadastrado com este CPF.");
          setLoading(false);
          return;
        }
      } catch (err) {
        toast.error("Erro ao resolver login por CPF.");
        console.error(err);
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ 
      email: loginEmail, 
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
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <div className="flex flex-col items-center w-full max-w-md">
        <Card className="w-full shadow-[var(--shadow-elegant)] border border-border relative overflow-hidden">
          {loading && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/20 via-primary to-primary/20 animate-pulse" />
          )}
          <CardHeader className="space-y-3 text-center">
            <div
              onClick={handleLogoClick}
              className="mx-auto flex h-14 w-full items-center justify-center cursor-pointer active:scale-95 transition-transform select-none mb-2"
              title="Acesso à Plataforma"
            >
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="max-h-12 object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FlaskConical className="h-6 w-6" />
                </div>
              )}
            </div>
            <CardTitle>Acesso à Plataforma</CardTitle>
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
                <Label htmlFor="email">{loginType === "tecnico" ? "E-mail ou CPF" : "E-mail"}</Label>
                <Input
                  id="email"
                  type="text"
                  required
                  disabled={loading}
                  placeholder={loginType === "tecnico" ? "seuemail@exemplo.com ou 123.456.789-00" : "seuemail@exemplo.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="disabled:opacity-50"
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
                    disabled={loading}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 disabled:opacity-50"
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
              <Button type="submit" className="w-full font-bold flex items-center justify-center gap-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Entrando…</span>
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Link
          to="/admin-login"
          className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/80 transition-colors uppercase tracking-widest font-semibold mt-4"
        >
          Acesso Restrito
        </Link>
      </div>
    </div>
  );
}