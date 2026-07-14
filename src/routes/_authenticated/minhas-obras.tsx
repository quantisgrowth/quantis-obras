import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { lookupCEP } from "@/components/address-autocomplete";
import { toast } from "sonner";
import {
  HardHat, Plus, MapPin, User, FileText, CalendarPlus,
  Trash2, Edit, Loader2, Sparkles, AlertTriangle, ShieldAlert,
  LayoutGrid, List, ArrowLeft
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/minhas-obras")({
  head: () => ({ meta: [{ title: "Minhas Obras — Quantis Obras" }] }),
  component: MinhasObrasPage,
});

interface Obra {
  id: string;
  empresa_id: string;
  nome_obra: string;
  endereco: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  estado: string | null;
  cep: string | null;
  cno: string | null;
  responsavel: string | null;
  cargo_responsavel: string | null;
  created_at: string;
}

function MinhasObrasPage() {
  const { user, profile, roles } = useAuth();
  const navigate = useNavigate();

  const role = primaryRole(roles);
  const hasPermission = (permission: string) => {
    if (role !== "cliente") return true;
    if (!profile) return false;
    if (profile.sub_role === "master") return true;
    return profile.permissoes?.includes(permission) ?? false;
  };

  if (!hasPermission("obras")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Acesso às Obras Restrito</h2>
        <p className="text-sm text-muted-foreground">Sua conta de usuário não possui permissão para gerenciar as obras da empresa. Entre em contato com o gestor da sua conta.</p>
        <div className="pt-2">
          <Link to="/dashboard">
            <Button className="font-semibold bg-primary hover:bg-primary/90 text-primary-foreground">
              Voltar ao Início
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  // Modal / Form States
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [nomeObra, setNomeObra] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cno, setCno] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [cargoResponsavel, setCargoResponsavel] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const loadObras = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // Get user profile
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile?.empresa_id) {
        toast.error("Perfil sem empresa associada.");
        return;
      }
      setEmpresaId(profile.empresa_id);

      // Fetch company obras
      const { data: obrasData, error: obrasErr } = await supabase
        .from("obras")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false });

      if (obrasErr) throw obrasErr;
      setObras(obrasData || []);

      // Fetch company team members (filtered to client role only)
      const { data: profiles, error: teamErr } = await supabase
        .from("profiles")
        .select("id, nome_completo, sub_role, tecnico_id")
        .eq("empresa_id", profile.empresa_id);

      if (!teamErr && profiles && profiles.length > 0) {
        const profileIds = profiles.map((p) => p.id);
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", profileIds);

        const userRolesMap = new Map<string, string[]>();
        (rolesData || []).forEach((r) => {
          const list = userRolesMap.get(r.user_id) || [];
          list.push(r.role);
          userRolesMap.set(r.user_id, list);
        });

        const filteredTeam = profiles.filter((p) => {
          const userRoles = userRolesMap.get(p.id) || [];
          const hasCliente = userRoles.includes("cliente");
          const hasAdminOrTecnico = userRoles.includes("admin") || userRoles.includes("tecnico");
          const hasNoTechnicianLink = !p.tecnico_id;
          return hasCliente && !hasAdminOrTecnico && hasNoTechnicianLink;
        });

        setTeamMembers(filteredTeam);
      } else {
        setTeamMembers([]);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar obras: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadObras();
  }, [user]);

  // Handle open dialog for create/edit
  const handleOpenDialog = (obra: Obra | null = null) => {
    setEditingObra(obra);
    if (obra) {
      setNomeObra(obra.nome_obra);
      setCep(obra.cep || "");
      setEndereco(obra.endereco);
      setNumero(obra.numero || "");
      setBairro(obra.bairro || "");
      setCidade(obra.cidade);
      setEstado(obra.estado || "");
      setCno(obra.cno || "");
      setResponsavel(obra.responsavel || "");
      setCargoResponsavel(obra.cargo_responsavel || "");
    } else {
      setNomeObra("");
      setCep("");
      setEndereco("");
      setNumero("");
      setBairro("");
      setCidade("");
      setEstado("");
      setCno("");
      setResponsavel("");
      setCargoResponsavel("");
    }
    setIsFormOpen(true);
  };

  // Handle CEP change autocomplete
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

  // Handle save obra
  const handleSaveObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;

    if (!nomeObra.trim() || !endereco.trim() || !cidade.trim()) {
      toast.error("Preencha todos os campos obrigatórios (*).");
      return;
    }

    setFormLoading(true);
    try {
      const obraPayload = {
        empresa_id: empresaId,
        nome_obra: nomeObra.trim(),
        cep: cep.replace(/\D/g, "") || null,
        endereco: endereco.trim(),
        numero: numero.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim(),
        estado: estado.trim().toUpperCase() || null,
        cno: cno.trim() || null,
        responsavel: responsavel.trim() || null,
        cargo_responsavel: cargoResponsavel.trim() || null,
      };

      if (editingObra) {
        const { error } = await supabase
          .from("obras")
          .update(obraPayload)
          .eq("id", editingObra.id);
        if (error) throw error;
        toast.success("Obra atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("obras")
          .insert(obraPayload);
        if (error) throw error;
        toast.success("Obra cadastrada com sucesso!");
      }

      setIsFormOpen(false);
      loadObras();
    } catch (err: any) {
      toast.error("Erro ao salvar obra: " + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete obra
  const handleDeleteObra = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta obra? Todos os agendamentos vinculados a ela serão afetados.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("obras")
        .delete()
        .eq("id", id);

      if (error) {
        if (error.code === "23503") {
          throw new Error("Não é possível excluir esta obra porque ela possui agendamentos vinculados.");
        }
        throw error;
      }

      toast.success("Obra excluída!");
      loadObras();
    } catch (err: any) {
      toast.error("Erro ao excluir obra: " + err.message);
    }
  };

  if (isFormOpen) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFormOpen(false)}
            className="h-9 w-9 rounded-lg border-border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {editingObra ? "Editar Obra" : "Cadastrar Nova Obra"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {editingObra ? `Editando informações da obra: ${nomeObra}` : "Insira as informações do novo canteiro de obras."}
            </p>
          </div>
        </div>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <HardHat className="h-4 w-4 text-primary" /> Informações Gerais & Endereço
            </CardTitle>
            <CardDescription>
              Campos marcados com * são obrigatórios para a emissão de relatórios de controle tecnológico.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSaveObra} className="space-y-6">
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Nome da Obra */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="obra-nome" className="text-xs font-bold text-foreground">Nome da Obra *</Label>
                  <Input
                    id="obra-nome"
                    value={nomeObra}
                    onChange={(e) => setNomeObra(e.target.value)}
                    placeholder="Ex: Condomínio Edifício Ternura"
                    required
                    className="h-10"
                  />
                </div>

                {/* CEP & CNO */}
                <div className="space-y-2">
                  <Label htmlFor="obra-cep" className="text-xs font-bold text-foreground">CEP</Label>
                  <Input
                    id="obra-cep"
                    value={cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    maxLength={9}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="obra-cno" className="text-xs font-bold text-foreground">CNO (Cadastro Nacional de Obras)</Label>
                  <Input
                    id="obra-cno"
                    value={cno}
                    onChange={(e) => setCno(e.target.value)}
                    placeholder="Ex: 12.345.67890/12"
                    className="h-10"
                  />
                </div>

                {/* Endereço & Número */}
                <div className="space-y-2 md:col-span-2 grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-2">
                    <Label htmlFor="obra-end" className="text-xs font-bold text-foreground">Endereço *</Label>
                    <Input
                      id="obra-end"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Ex: Avenida Engenheiro Carlos Reinaldo Mendes"
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label htmlFor="obra-num" className="text-xs font-bold text-foreground">Número</Label>
                    <Input
                      id="obra-num"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Ex: 3000"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Bairro, Cidade & Estado */}
                <div className="space-y-2">
                  <Label htmlFor="obra-bairro" className="text-xs font-bold text-foreground">Bairro</Label>
                  <Input
                    id="obra-bairro"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Ex: Além Ponte"
                    className="h-10"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="obra-cid" className="text-xs font-bold text-foreground">Cidade *</Label>
                    <Input
                      id="obra-cid"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: Sorocaba"
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label htmlFor="obra-est" className="text-xs font-bold text-foreground">UF *</Label>
                    <Input
                      id="obra-est"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      placeholder="SP"
                      maxLength={2}
                      required
                      className="h-10 text-center uppercase"
                    />
                  </div>
                </div>

                {/* Responsáveis do Canteiro */}
                <div className="md:col-span-2 border-t pt-6 mt-2 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Responsabilidade & Contatos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="obra-resp" className="text-xs font-bold text-foreground">Responsável (Nome)</Label>
                      <select
                        id="obra-resp"
                        value={responsavel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setResponsavel(val);
                          const selected = teamMembers.find(m => m.nome_completo === val);
                          if (selected) {
                            const cargoLabel = selected.sub_role === "master" ? "Master" : 
                                               selected.sub_role === "engenheiro" ? "Engenheiro" : 
                                               selected.sub_role === "financeiro" ? "Financeiro" : 
                                               "Membro";
                            setCargoResponsavel(cargoLabel);
                          }
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Selecione um responsável...</option>
                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.nome_completo}>
                            {member.nome_completo}
                          </option>
                        ))}
                        {responsavel && !teamMembers.some(m => m.nome_completo === responsavel) && (
                          <option value={responsavel}>{responsavel}</option>
                        )}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="obra-cargo" className="text-xs font-bold text-foreground">Cargo Responsável</Label>
                      <select
                        id="obra-cargo"
                        value={cargoResponsavel}
                        onChange={(e) => setCargoResponsavel(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Selecione o cargo...</option>
                        <option value="Master">Master</option>
                        <option value="Engenheiro">Engenheiro</option>
                        <option value="Financeiro">Financeiro</option>
                        <option value="Membro">Membro</option>
                        {cargoResponsavel && !["Master", "Engenheiro", "Financeiro", "Membro"].includes(cargoResponsavel) && (
                          <option value={cargoResponsavel}>{cargoResponsavel}</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={formLoading}
                  className="h-10 px-6 font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={formLoading}
                  className="h-10 px-8 font-semibold gap-2 bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  {formLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Minhas Obras
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
              <HardHat className="h-3 w-3" /> Cadastro
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as obras e canteiros cadastrados para realizar agendamentos rápidos de ensaios.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Toggle de Visualização */}
          <div className="flex items-center border border-border bg-muted/30 p-1 rounded-lg shrink-0">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 rounded-md"
              title="Visualização em Blocos"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 rounded-md"
              title="Visualização em Lista"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={() => handleOpenDialog(null)} className="gap-1.5 h-10 flex-1 sm:flex-initial">
            <Plus className="h-4 w-4" /> Cadastrar Obra
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando canteiros de obras...</p>
        </div>
      ) : (
        <>
          {obras.length === 0 ? (
            <div className="h-64 border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 p-8 text-center bg-card">
              <HardHat className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-semibold">Nenhuma obra cadastrada ainda.</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Cadastre seus canteiros de obras para facilitar e acelerar seus pedidos de controle tecnológico.
              </p>
              <Button onClick={() => handleOpenDialog(null)} size="sm" className="mt-2">
                Cadastrar Minha Primeira Obra
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            /* Obras Grid */
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {obras.map((obra) => (
                <Card key={obra.id} className="border border-border bg-card flex flex-col justify-between hover:shadow-[var(--shadow-elegant)] transition-all duration-200 group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base truncate group-hover:text-primary transition-colors" title={obra.nome_obra}>
                        {obra.nome_obra}
                      </CardTitle>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenDialog(obra)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar obra"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteObra(obra.id)}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                          title="Excluir obra"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <CardDescription className="text-xs truncate flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      CNO: {obra.cno || "Não informado"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1">
                    {/* Address info */}
                    <div className="text-xs space-y-2 text-muted-foreground bg-accent/25 p-3 rounded-lg border border-border/40">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">
                            {obra.endereco}, {obra.numero || "S/N"}
                          </p>
                          <p>
                            {obra.bairro && `${obra.bairro}, `}{obra.cidade} - {obra.estado || ""}
                          </p>
                          <p>{obra.cep && `CEP: ${obra.cep}`}</p>
                        </div>
                      </div>
                    </div>

                    {/* Responsible info */}
                    {obra.responsavel && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                        <User className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          <strong className="text-foreground">{obra.responsavel}</strong>
                          {obra.cargo_responsavel && ` (${obra.cargo_responsavel})`}
                        </span>
                      </div>
                    )}
                  </CardContent>

                  {/* Card Action Footer */}
                  <div className="p-4 pt-0 border-t border-border/50 bg-muted/5 flex gap-2 rounded-b-xl mt-auto">
                    <Button
                      onClick={() => navigate({ to: "/novo-agendamento", search: { obraId: obra.id } })}
                      className="w-full gap-1.5 h-9 text-xs"
                      variant="outline"
                    >
                      <CalendarPlus className="h-4 w-4 text-primary" /> Solicitar Orçamento / Agendamento
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Obras List (Table) */
            <Card className="border border-border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="p-4">Nome da Obra / CNO</th>
                      <th className="p-4">Endereço do Canteiro</th>
                      <th className="p-4">Responsável</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {obras.map((obra) => (
                      <tr key={obra.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="p-4">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{obra.nome_obra}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">CNO: {obra.cno || "Não informado"}</div>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">{obra.endereco}, {obra.numero || "S/N"}</div>
                          <div>{obra.bairro && `${obra.bairro}, `}{obra.cidade} - {obra.estado || ""} · CEP: {obra.cep || "S/CEP"}</div>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {obra.responsavel ? (
                            <div>
                              <div className="font-semibold text-foreground">{obra.responsavel}</div>
                              {obra.cargo_responsavel && <div className="text-[10px] text-muted-foreground">{obra.cargo_responsavel}</div>}
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground/60">Não atribuído</span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate({ to: "/novo-agendamento", search: { obraId: obra.id } })}
                            className="h-8 px-3 text-xs gap-1"
                          >
                            <CalendarPlus className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden sm:inline">Agendar</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenDialog(obra)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Editar obra"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteObra(obra.id)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="Excluir obra"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
