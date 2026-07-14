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
import { Building, Save, Loader2, Phone, Mail, User, Users, UserPlus, Shield, Copy, Check, Info } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/meus-dados")({
  head: () => ({ meta: [{ title: "Meus Dados — Quantis Obras" }] }),
  component: MeusDadosPage,
});

interface Obra {
  id: string;
  nome_obra: string;
}

interface TeamMember {
  id: string;
  nome_completo: string;
  telefone: string | null;
  sub_role: string | null;
  permissoes: string[] | null;
  created_at: string;
}

function MeusDadosPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState("empresa");

  // Form states (Company)
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

  // Team states
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Invite states
  const [inviteSubRole, setInviteSubRole] = useState<"master" | "engenheiro" | "financeiro" | "custom">("engenheiro");
  const [permPedidos, setPermPedidos] = useState(true);
  const [permObras, setPermObras] = useState(true);
  const [permDashboard, setPermDashboard] = useState(true);
  const [permFinanceiro, setPermFinanceiro] = useState(false);
  const [permEquipe, setPermEquipe] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  const hasPermission = (permission: string) => {
    if (!profile) return false;
    if (profile.sub_role === "master") return true;
    return profile.permissoes?.includes(permission) ?? false;
  };

  // Preset permissions based on selected subrole
  useEffect(() => {
    if (inviteSubRole === "master") {
      setPermPedidos(true);
      setPermObras(true);
      setPermDashboard(true);
      setPermFinanceiro(true);
      setPermEquipe(true);
    } else if (inviteSubRole === "engenheiro") {
      setPermPedidos(true);
      setPermObras(true);
      setPermDashboard(true);
      setPermFinanceiro(false);
      setPermEquipe(false);
    } else if (inviteSubRole === "financeiro") {
      setPermPedidos(false);
      setPermObras(true);
      setPermDashboard(true);
      setPermFinanceiro(true);
      setPermEquipe(false);
    }
  }, [inviteSubRole]);

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
        return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
      }
      return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    }
    return clean.slice(0, 11);
  };

  const fetchTeam = async (compId: string) => {
    try {
      setLoadingTeam(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo, telefone, sub_role, permissoes, created_at")
        .eq("empresa_id", compId)
        .order("nome_completo", { ascending: true });

      if (error) throw error;
      setTeam((data || []) as TeamMember[]);
    } catch (err: any) {
      console.error("Erro ao carregar equipe:", err);
      toast.error("Erro ao carregar equipe: " + err.message);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Load company data
  const loadCompanyData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // 1. Get profile to find company ID
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (profileErr || !profileData?.empresa_id) {
        toast.error("Perfil sem empresa vinculada.");
        return;
      }

      const compId = profileData.empresa_id;
      setEmpresaId(compId);

      // 2. Fetch company data
      const { data: company, error: companyErr } = await supabase
        .from("empresas_clientes")
        .select("*")
        .eq("id", compId)
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

      // 3. Load team members if has permission
      if (hasPermission("equipe")) {
        await fetchTeam(compId);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
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

  // Handle submit form (Company details)
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
        } as any)
        .eq("id", empresaId);

      if (error) throw error;

      toast.success("Dados cadastrais salvos com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar dados: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Generate Invite Link
  const handleGenerateInvite = () => {
    if (!empresaId) return;
    setCopied(false);

    // Assemble permissions array
    const permissions: string[] = [];
    if (permPedidos) permissions.push("pedidos");
    if (permObras) permissions.push("obras");
    if (permDashboard) permissions.push("dashboard");
    if (permFinanceiro) permissions.push("financeiro");
    if (permEquipe) permissions.push("equipe");

    if (permissions.length === 0) {
      toast.warning("Selecione pelo menos uma permissão para o usuário.");
      return;
    }

    const inviteUrl = `${window.location.origin}/signup?invite_empresa_id=${empresaId}&sub_role=${inviteSubRole}&permissions=${permissions.join(",")}`;
    setGeneratedLink(inviteUrl);
    toast.success("Link de convite gerado!");
  };

  // Copy Link to Clipboard
  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success("Link de convite copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
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
            <Building className="h-3 w-3" /> Configurações
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as informações da sua empresa e configure os acessos e permissões da sua equipe.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-lg w-fit">
          <TabsTrigger value="empresa" className="text-xs font-bold px-4 py-2 rounded-md flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5" /> Dados da Empresa
          </TabsTrigger>
          {hasPermission("equipe") && (
            <TabsTrigger value="equipe" className="text-xs font-bold px-4 py-2 rounded-md flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Equipe & Permissões ({team.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Empresa Form */}
        <TabsContent value="empresa" className="outline-none">
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
                    <Label htmlFor="telefone-financeiro">Telefone Financeiro</Label>
                    <Input
                      id="telefone-financeiro"
                      value={telefoneFinanceiro}
                      onChange={(e) => setTelefoneFinanceiro(formatPhone(e.target.value))}
                      placeholder="(15) 99999-9999"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email-financeiro">E-mail para Faturamento</Label>
                    <Input
                      id="email-financeiro"
                      type="email"
                      value={emailFinanceiro}
                      onChange={(e) => setEmailFinanceiro(e.target.value)}
                      placeholder="financeiro@empresa.com"
                    />
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
                  Utilizado para a emissão de notas fiscais e envio de boletos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={cep}
                      onChange={handleCepChange}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="endereco">Logradouro (Rua/Av.)</Label>
                    <Input
                      id="endereco"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Av. Paulista"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Centro"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Sorocaba"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="estado">Estado (UF)</Label>
                    <Input
                      id="estado"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button type="submit" className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center gap-1.5" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Tab 2: Equipe & Permissões */}
        {hasPermission("equipe") && (
          <TabsContent value="equipe" className="space-y-6 outline-none">
            
            {/* Invite Generator Panel */}
            <Card className="border border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Convidar Novo Membro da Equipe
                </CardTitle>
                <CardDescription>
                  Gere um link exclusivo configurado com as permissões da função. Copie e envie para o seu colaborador se cadastrar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid md:grid-cols-2 gap-6">
                  
                  {/* Select Cargo */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sub-role" className="font-semibold">Perfil / Função do Usuário</Label>
                      <select
                        id="sub-role"
                        value={inviteSubRole}
                        onChange={(e) => setInviteSubRole(e.target.value as any)}
                        className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground shadow-sm font-medium"
                      >
                        <option value="engenheiro">Engenheiro / Operacional (Pedidos & Acompanhamento)</option>
                        <option value="financeiro">Financeiro (Gráficos, Custos & Obras)</option>
                        <option value="master">Gestor Master (Administrador da Empresa - Acesso Total)</option>
                        <option value="custom">Personalizado (Escolher permissões individualmente)</option>
                      </select>
                    </div>

                    {/* Pre-made role info */}
                    <div className="p-3 bg-muted/30 border rounded-lg text-xs flex gap-2 text-muted-foreground">
                      <Info className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        {inviteSubRole === "master" && "Acesso irrestrito a todas as funcionalidades do sistema, incluindo faturamento e convites de novos membros."}
                        {inviteSubRole === "engenheiro" && "Ideal para engenheiros ou almoxarifes. Podem cadastrar obras, solicitar novos ensaios/pedidos e ver laudos técnicos na tela inicial."}
                        {inviteSubRole === "financeiro" && "Ideal para a equipe de contas. Tem acesso a gráficos financeiros, extrato de faturamento de boletos e histórico de obras."}
                        {inviteSubRole === "custom" && "Escolha manualmente quais seções do painel do cliente este usuário poderá visualizar e interagir."}
                      </div>
                    </div>
                  </div>

                  {/* Checkbox Permission List */}
                  <div className="space-y-3 p-4 bg-muted/20 border border-border/80 rounded-xl">
                    <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block mb-2">Permissões Selecionadas</Label>
                    
                    <div className="space-y-3">
                      {/* Dashboard */}
                      <label className={`flex items-start gap-2.5 text-xs font-medium cursor-pointer ${inviteSubRole !== "custom" ? "opacity-75 cursor-not-allowed" : "hover:text-primary"}`}>
                        <input
                          type="checkbox"
                          checked={permDashboard}
                          disabled={inviteSubRole !== "custom"}
                          onChange={(e) => setPermDashboard(e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring bg-background mt-0.5"
                        />
                        <div>
                          <span className="block font-bold">Ver Acompanhamento de Obras</span>
                          <span className="block text-[10px] text-muted-foreground">Acessar a tela inicial com listas de ensaios e laudos técnicos</span>
                        </div>
                      </label>

                      {/* Pedidos */}
                      <label className={`flex items-start gap-2.5 text-xs font-medium cursor-pointer ${inviteSubRole !== "custom" ? "opacity-75 cursor-not-allowed" : "hover:text-primary"}`}>
                        <input
                          type="checkbox"
                          checked={permPedidos}
                          disabled={inviteSubRole !== "custom"}
                          onChange={(e) => setPermPedidos(e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring bg-background mt-0.5"
                        />
                        <div>
                          <span className="block font-bold">Solicitar Novos Pedidos</span>
                          <span className="block text-[10px] text-muted-foreground">Permissão para criar novas programações de ensaios na plataforma</span>
                        </div>
                      </label>

                      {/* Obras */}
                      <label className={`flex items-start gap-2.5 text-xs font-medium cursor-pointer ${inviteSubRole !== "custom" ? "opacity-75 cursor-not-allowed" : "hover:text-primary"}`}>
                        <input
                          type="checkbox"
                          checked={permObras}
                          disabled={inviteSubRole !== "custom"}
                          onChange={(e) => setPermObras(e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring bg-background mt-0.5"
                        />
                        <div>
                          <span className="block font-bold">Gerenciar Obras</span>
                          <span className="block text-[10px] text-muted-foreground">Ver, cadastrar e associar canteiros de obras da empresa</span>
                        </div>
                      </label>

                      {/* Financeiro */}
                      <label className={`flex items-start gap-2.5 text-xs font-medium cursor-pointer ${inviteSubRole !== "custom" ? "opacity-75 cursor-not-allowed" : "hover:text-primary"}`}>
                        <input
                          type="checkbox"
                          checked={permFinanceiro}
                          disabled={inviteSubRole !== "custom"}
                          onChange={(e) => setPermFinanceiro(e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring bg-background mt-0.5"
                        />
                        <div>
                          <span className="block font-bold">Módulo Financeiro</span>
                          <span className="block text-[10px] text-muted-foreground">Visualizar balanços, gráficos e extratos de faturamento corporativo</span>
                        </div>
                      </label>

                      {/* Equipe */}
                      <label className={`flex items-start gap-2.5 text-xs font-medium cursor-pointer ${inviteSubRole !== "custom" ? "opacity-75 cursor-not-allowed" : "hover:text-primary"}`}>
                        <input
                          type="checkbox"
                          checked={permEquipe}
                          disabled={inviteSubRole !== "custom"}
                          onChange={(e) => setPermEquipe(e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring bg-background mt-0.5"
                        />
                        <div>
                          <span className="block font-bold">Gestão de Equipe</span>
                          <span className="block text-[10px] text-muted-foreground">Gerar novos convites de membros de equipe corporativa</span>
                        </div>
                      </label>
                    </div>

                  </div>
                </div>

                <div className="border-t border-border pt-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="generated-link" className="text-xs font-bold text-muted-foreground uppercase">Link de Convite Gerado</Label>
                    <div className="flex gap-2">
                      <Input
                        id="generated-link"
                        value={generatedLink}
                        readOnly
                        placeholder="Clique no botão ao lado para gerar o convite"
                        className="bg-muted text-xs h-10 select-all font-mono"
                      />
                      {generatedLink && (
                        <Button
                          onClick={handleCopyLink}
                          variant="outline"
                          className="h-10 px-3 bg-background border-border shrink-0 hover:bg-muted"
                          title="Copiar link"
                        >
                          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button onClick={handleGenerateInvite} className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold h-10 shrink-0">
                    <UserPlus className="h-4 w-4 mr-2" /> Gerar Convite
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* List Team Members */}
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Membros da Empresa
                </CardTitle>
                <CardDescription>
                  Listagem de contas de usuários ativas que pertencem ao seu tenant corporativo.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingTeam ? (
                  <div className="flex h-32 flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground">Carregando equipe...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-y border-border bg-muted/40 text-muted-foreground font-semibold">
                          <th className="py-3 px-4">Nome</th>
                          <th className="py-3 px-4">Telefone</th>
                          <th className="py-3 px-4">Função / Cargo</th>
                          <th className="py-3 px-4">Permissões Habilitadas</th>
                          <th className="py-3 px-4">Data do Cadastro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.map((member) => (
                          <tr key={member.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4 font-medium text-foreground">{member.nome_completo}</td>
                            <td className="py-3 px-4 text-muted-foreground">{member.telefone ? formatPhone(member.telefone) : "—"}</td>
                            <td className="py-3 px-4 capitalize font-semibold">
                              {member.sub_role === "master" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary">
                                  Master
                                </span>
                              )}
                              {member.sub_role === "engenheiro" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/10 text-sky-600">
                                  Engenheiro
                                </span>
                              )}
                              {member.sub_role === "financeiro" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600">
                                  Financeiro
                                </span>
                              )}
                              {member.sub_role === "custom" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-600">
                                  Personalizado
                                </span>
                              )}
                              {(!member.sub_role) && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
                                  Membro
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {(member.permissoes || []).map((perm) => (
                                  <span key={perm} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono font-bold">
                                    {perm}
                                  </span>
                                ))}
                                {(member.permissoes || []).length === 0 && (
                                  <span className="text-[10px] text-muted-foreground/50">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {member.created_at ? new Date(member.created_at).toLocaleDateString("pt-BR") : "—"}
                            </td>
                          </tr>
                        ))}

                        {team.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-muted-foreground font-medium">
                              Nenhum membro registrado na sua empresa.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
