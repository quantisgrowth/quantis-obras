import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { FlaskConical } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — Geraltest Brasil" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome_completo: nome, telefone },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Falha no cadastro", { description: error.message });
      return;
    }
    toast.success("Conta criada!", { description: "Verifique seu e-mail se necessário." });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="h-6 w-6" />
          </div>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Como Cliente (Engenheiro/Comprador). Técnicos e Admins são cadastrados pelo gestor.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(15) 99999-9999" /></div>
            <div className="space-y-2"><Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
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