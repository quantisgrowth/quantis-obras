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
import { FlaskConical, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/tecnico-$slug")({
  head: () => ({ meta: [{ title: "Portal do Técnico — Quantis Obras" }] }),
  component: TecnicoTenantLogin,
});

function TecnicoTenantLogin() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const { branding, loadBrandingBySlug, loading: brandingLoading } = useBranding();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [identifier, setIdentifier] = useState(""); // Email or CPF
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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

  // Handle redirect if logged in
  useEffect(() => {
    if (user && roles.length > 0) {
      if (roles.includes("tecnico")) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        // If logged in user is not a technician, log out and show error
        supabase.auth.signOut();
        toast.error("Acesso negado", {
          description: "Este perfil não possui privilégios de técnico.",
        });
      }
    }
  }, [user, roles]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let loginEmail = identifier.trim();
    const cleanCpf = loginEmail.replace(/\D/g, "");
    const isCpf = cleanCpf.length === 11 && !loginEmail.includes("@");

    // Resolve email if CPF is used
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
      password,
    });
    
    setLoading(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
      return;
    }
    toast.success("Acesso concedido!");
  }

  if (brandingLoading && !companyName) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground animate-pulse">
        Carregando portal do técnico…
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
            <CardTitle>Área do Técnico</CardTitle>
            <CardDescription>
              Faça login para gerenciar sua escala de ensaios e check-ins na {companyName || "plataforma"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">E-mail ou CPF</Label>
                <Input
                  id="identifier"
                  type="text"
                  required
                  placeholder="seuemail@exemplo.com ou 123.456.789-00"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    to="/reset-password"
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-0 p-0"
                  >
                    Esqueceu a senha?
                  </Link>
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

              <Button type="submit" className="w-full font-bold mt-2" disabled={loading}>
                {loading ? "Entrando…" : "Acessar Escala"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
