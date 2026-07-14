import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { FlaskConical, Eye, EyeOff, ShieldAlert, Lock } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — Quantis Obras" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Parse params directly to prevent flashing unauthorized UI
  const getInviteParams = () => {
    if (typeof window === "undefined") return { companyId: null, subRole: null, permissions: null };
    const params = new URLSearchParams(window.location.search);
    return {
      companyId: params.get("invite_empresa_id"),
      subRole: params.get("sub_role"),
      permissions: params.get("permissions")?.split(",") || null
    };
  };

  const inviteParams = getInviteParams();
  const [inviteEmpresaId] = useState<string | null>(inviteParams.companyId);
  const [inviteSubRole] = useState<string | null>(inviteParams.subRole);
  const [invitePermissions] = useState<string[] | null>(inviteParams.permissions);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const signUpData: any = {
      nome_completo: nome,
      telefone,
    };

    if (inviteEmpresaId) {
      signUpData.empresa_id = inviteEmpresaId;
    }
    if (inviteSubRole) {
      signUpData.sub_role = inviteSubRole;
    }
    if (invitePermissions) {
      signUpData.permissoes = invitePermissions;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: signUpData,
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Falha no cadastro", { description: error.message });
      return;
    }
    toast.success("Conta criada!", { description: "Verifique seu e-mail para confirmar o cadastro." });
    navigate({ to: "/login" });
  }

  if (!inviteEmpresaId) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
        <Card className="w-full max-w-md shadow-[var(--shadow-elegant)] border-border bg-card">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Cadastro Restrito</CardTitle>
            <CardDescription className="text-sm text-muted-foreground pt-1.5 leading-relaxed">
              O cadastro direto nesta plataforma é desabilitado. A criação de contas de gestores, engenheiros e técnicos é de responsabilidade da empresa de Controle Tecnológico contratante.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="rounded-lg bg-muted/50 p-4 border border-border/80 text-xs text-muted-foreground leading-relaxed flex gap-2.5 items-start">
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <span>
                Se você faz parte de uma equipe ou é um cliente parceiro, solicite um convite de acesso direto ao administrador da sua empresa para se cadastrar.
              </span>
            </div>
            <Button asChild className="w-full font-semibold">
              <Link to="/login">Ir para o Login</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground pt-2">
              Deseja voltar para a página inicial?{" "}
              <Link to="/" className="font-semibold text-primary hover:underline">
                Voltar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="h-6 w-6" />
          </div>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>
            Você foi convidado para se juntar à equipe de uma empresa. Preencha seus dados de acesso para concluir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(15) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
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
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando…" : "Criar conta"}</Button>
            <p className="text-center text-sm text-muted-foreground">
              Já tem conta? <Link to="/login" className="font-medium text-primary hover:underline">Entrar</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}