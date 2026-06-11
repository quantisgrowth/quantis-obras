import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { FlaskConical, Eye, EyeOff, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/cliente-$slug")({
  head: () => ({ meta: [{ title: "Portal do Cliente — Quantis Obras" }] }),
  component: ClienteTenantLogin,
});

function ClienteTenantLogin() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const { branding, loadBrandingBySlug, loading: brandingLoading } = useBranding();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Registration states
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    let active = true;
    async function initBranding() {
      if (slug) {
        const company = await loadBrandingBySlug(slug);
        if (active && company) {
          setCompanyId(company.id);
          setCompanyName(company.razao_social);
        }
      }
    }
    initBranding();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (user && companyId) {
      // Check if logged-in user belongs to this company. If not, we can auto-bind if they have no company
      checkAndRedirectUser();
    }
  }, [user, companyId]);

  async function checkAndRedirectUser() {
    if (!user || !companyId) return;

    // Se for administrador do sistema (role 'admin'), redireciona direto e ignora a vinculação
    if (roles.includes("admin")) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (!profile.empresa_id) {
          // Auto link profile to this company
          await supabase
            .from("profiles")
            .update({ empresa_id: companyId })
            .eq("id", user.id);
          toast.success(`Sua conta foi associada a ${companyName}!`);
        } else if (profile.empresa_id !== companyId) {
          // Wrong tenant
          await supabase.auth.signOut();
          toast.error("Acesso negado", {
            description: "Esta conta está associada a outra empresa cliente.",
          });
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (isRegistering) {
      // SignUp under this company
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            nome_completo: nome,
            telefone,
            empresa_id: companyId, // Passed to handle_new_user trigger
          },
        },
      });

      setLoading(false);
      if (error) {
        toast.error("Falha no cadastro", { description: error.message });
        return;
      }

      toast.success("Cadastro realizado com sucesso!", {
        description: "Verifique seu e-mail para confirmar a conta.",
      });
      setIsRegistering(false);
      setPassword("");
    } else {
      // SignIn
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (error) {
        toast.error("Erro no login", { description: error.message });
        return;
      }
      toast.success("Bem-vindo de volta!");
    }
  }

  if (brandingLoading && !companyName) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground animate-pulse">
        Carregando portal personalizado…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8 relative">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-[var(--shadow-elegant)] border border-border">
          <CardHeader className="space-y-3 text-center">
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt={companyName} className="mx-auto h-12 max-w-[200px] object-contain" />
            ) : (
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
                <FlaskConical className="h-6 w-6" />
              </div>
            )}
            <CardTitle>{isRegistering ? "Criar Conta de Cliente" : "Portal do Cliente"}</CardTitle>
            <CardDescription>
              {isRegistering
                ? `Cadastre-se para solicitar ensaios e medições com a ${companyName || "nossa equipe"}.`
                : `Acesse e agende ensaios de concreto da sua obra em parceria com ${companyName || "nossa empresa"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {isRegistering && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(15) 99999-9999" />
                  </div>
                </>
              )}
              
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
                  {!isRegistering && (
                    <Link
                      to="/reset-password"
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      Esqueceu a senha?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
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

              <Button type="submit" className="w-full font-bold mt-2" disabled={loading}>
                {loading ? "Processando…" : isRegistering ? "Cadastrar e Entrar" : "Entrar"}
              </Button>

              <div className="text-center pt-2">
                {isRegistering ? (
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="text-sm text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" /> Já tenho conta, fazer login
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ainda não tem conta?{" "}
                    <button
                      type="button"
                      onClick={() => setIsRegistering(true)}
                      className="font-semibold text-primary hover:underline"
                    >
                      Criar conta
                    </button>
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
