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
  Trash2, Edit, Loader2, Sparkles, AlertTriangle, ShieldAlert
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
    setIsDialogOpen(true);
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

      setIsDialogOpen(false);
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

        <Button onClick={() => handleOpenDialog(null)} className="gap-1.5 h-10 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Cadastrar Obra
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando canteiros de obras...</p>
        </div>
      ) : (
        <>
          {/* Obras Grid */}
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

          {obras.length === 0 && (
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
          )}
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] bg-card border border-border">
          <DialogHeader>
            <DialogTitle>
              {editingObra ? "Editar Obra" : "Cadastrar Nova Obra"}
            </DialogTitle>
            <DialogDescription>
              Insira as informações do canteiro de obras e do engenheiro ou mestre responsável.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveObra} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="obra-nome">Nome da Obra *</Label>
              <Input
                id="obra-nome"
                value={nomeObra}
                onChange={(e) => setNomeObra(e.target.value)}
                placeholder="Ex: Condomínio Edifício Ternura"
                required
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="obra-cep">CEP</Label>
                <Input
                  id="obra-cep"
                  value={cep}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="obra-end">Endereço *</Label>
                <Input
                  id="obra-end"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: Rua das Flores"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obra-num">Número</Label>
                <Input
                  id="obra-num"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex: 123"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="obra-bairro">Bairro</Label>
                <Input
                  id="obra-bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Ex: Jardim Paulista"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obra-cid">Cidade *</Label>
                <Input
                  id="obra-cid"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Sorocaba"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obra-est">Estado *</Label>
                <Input
                  id="obra-est"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  placeholder="Ex: SP"
                  maxLength={2}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t pt-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="obra-cno">CNO (Obra)</Label>
                <Input
                  id="obra-cno"
                  value={cno}
                  onChange={(e) => setCno(e.target.value)}
                  placeholder="Cadastro Nac. de Obras"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obra-resp">Responsável (Nome)</Label>
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

              <div className="space-y-1.5">
                <Label htmlFor="obra-cargo">Cargo Responsável</Label>
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

            <DialogFooter className="pt-4 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={formLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={formLoading} className="gap-1.5">
                {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar Obra
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
