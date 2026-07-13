import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lookupCEP } from "@/components/address-autocomplete";
import { toast } from "sonner";
import { Building, Save, Loader2, Sparkles, Phone, Mail, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meus-dados")({
  head: () => ({ meta: [{ title: "Meus Dados — Quantis Obras" }] }),
  component: MeusDadosPage,
});

function MeusDadosPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  // Form states
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefoneFinanceiro, setTelefoneFinanceiro] = useState("");
  const [emailFinanceiro, setEmailFinanceiro] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // Format CNPJ helper
  const formatCNPJ = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 14) {
      return clean
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return clean.slice(0, 14);
  };

  // Format phone helper
  const formatPhone = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 11) {
      if (clean.length > 10) {
        // Mobile phone format: (99) 99999-9999
        return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
      }
      // Landline format: (99) 9999-9999
      return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    }
    return clean.slice(0, 11);
  };

  // Load company data
  const loadCompanyData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // 1. Get profile to find company ID
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile?.empresa_id) {
        toast.error("Perfil sem empresa vinculada.");
        return;
      }

      setEmpresaId(profile.empresa_id);

      // 2. Fetch company data
      const { data: company, error: companyErr } = await supabase
        .from("empresas_clientes")
        .select("*")
        .eq("id", profile.empresa_id)
        .single();

      if (companyErr) {
        throw companyErr;
      }

      if (company) {
        setRazaoSocial(company.razao_social || "");
        setNomeFantasia(company.nome_fantasia || "");
        setCnpj(formatCNPJ(company.cnpj || ""));
        setTelefoneFinanceiro(formatPhone(company.telefone_financeiro || ""));
        setEmailFinanceiro(company.email_financeiro || "");
        setCep(company.cep_faturamento || "");
        setEndereco(company.endereco_faturamento || "");
        setNumero(company.numero_faturamento || "");
        setBairro(company.bairro_faturamento || "");
        setCidade(company.cidade_faturamento || "");
        setEstado(company.estado_faturamento || "");
      }
    } catch (err: any) {
      toast.error("Erro ao carregar dados da empresa: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
  }, [user]);

  // Handle CEP lookup
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setCep(val);

    if (val.length === 8) {
      const loader = toast.loading("Buscando CEP...");
      try {
        const address = await lookupCEP(val);
        if (address) {
          setEndereco(address.logradouro || "");
          setBairro(address.bairro || "");
          setCidade(address.cidade || "");
          setEstado(address.estado || "");
          toast.success("CEP localizado!", { id: loader });
        } else {
          toast.error("CEP não localizado.", { id: loader });
        }
      } catch (err) {
        toast.error("Erro ao buscar CEP.", { id: loader });
      }
    }
  };

  // Handle submit form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;

    if (!razaoSocial.trim()) {
      toast.error("A Razão Social é obrigatória.");
      return;
    }
    if (!cnpj.trim()) {
      toast.error("O CNPJ é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      const cleanCnpj = cnpj.replace(/\D/g, "");
      const cleanPhone = telefoneFinanceiro.replace(/\D/g, "");

      const { error } = await supabase
        .from("empresas_clientes")
        .update({
          razao_social: razaoSocial.trim(),
          nome_fantasia: nomeFantasia.trim() || null,
          cnpj: cleanCnpj,
          telefone_financeiro: cleanPhone || null,
          email_financeiro: emailFinanceiro.trim().toLowerCase() || null,
          cep_faturamento: cep.replace(/\D/g, "") || null,
          endereco_faturamento: endereco.trim() || null,
          numero_faturamento: numero.trim() || null,
          bairro_faturamento: bairro.trim() || null,
          cidade_faturamento: cidade.trim() || null,
          estado_faturamento: estado.trim() || null,
        } as any) // Typecast as any to bypass local outdated typing file compilation check just in case
        .eq("id", empresaId);

      if (error) throw error;

      toast.success("Dados cadastrais salvos com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar dados: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando dados da empresa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          Meus Dados
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
            <Building className="h-3 w-3" /> Faturamento
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as informações cadastrais e de faturamento da sua empresa para emissão de notas fiscais e contratos.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Identificação */}
        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Identificação da Empresa
            </CardTitle>
            <CardDescription>
              Dados jurídicos oficiais da sua empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="razao-social">Razão Social *</Label>
                <Input
                  id="razao-social"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Ex: Construtora Alfa Ltda"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nome-fantasia">Nome Fantasia</Label>
                <Input
                  id="nome-fantasia"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Ex: Construtora Alfa"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tel-financeiro">WhatsApp / Telefone Financeiro</Label>
                <div className="relative">
                  <Input
                    id="tel-financeiro"
                    value={telefoneFinanceiro}
                    onChange={(e) => setTelefoneFinanceiro(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="pl-9"
                  />
                  <Phone className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/80" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-financeiro">E-mail para Faturamento</Label>
                <div className="relative">
                  <Input
                    id="email-financeiro"
                    type="email"
                    value={emailFinanceiro}
                    onChange={(e) => setEmailFinanceiro(e.target.value)}
                    placeholder="financeiro@empresa.com"
                    className="pl-9"
                  />
                  <Mail className="h-4 w-4 absolute left-3 top-3 text-muted-foreground/80" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Endereço de Faturamento */}
        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              Endereço de Faturamento
            </CardTitle>
            <CardDescription>
              Endereço oficial para cobrança e emissão de notas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cep">CEP de Faturamento</Label>
                <Input
                  id="cep"
                  value={cep}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="endereco">Logradouro / Endereço</Label>
                <Input
                  id="endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: Avenida Paulista"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex: 1000"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Ex: Centro"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: São Paulo"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado (UF)</Label>
                <Input
                  id="estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  placeholder="Ex: SP"
                  maxLength={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" size="lg" className="gap-2 w-full sm:w-auto h-11" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Cadastro
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
