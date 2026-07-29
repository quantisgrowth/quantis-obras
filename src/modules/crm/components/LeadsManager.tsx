import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PlusCircle, Search, Edit3, Trash2, Mail, Phone, Briefcase, Building, Loader2 } from "lucide-react";
import { getLeads, saveLead, deleteLead, getCompaniesForSelect } from "../crm.api";

interface Lead {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  empresa_cliente_id: string | null;
  empresa_cliente?: {
    id: string;
    razao_social: string;
  } | null;
}

interface Company {
  id: string;
  razao_social: string;
  cnpj: string;
}

export function LeadsManager() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form states
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [empresaClienteId, setEmpresaClienteId] = useState<string>("none");

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadsData, companiesData] = await Promise.all([
        getLeads(),
        getCompaniesForSelect(),
      ]);
      setLeads(leadsData as any);
      setCompanies(companiesData as any);
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateForm = () => {
    setEditingLead(null);
    setNome("");
    setEmail("");
    setTelefone("");
    setCargo("");
    setEmpresaClienteId("none");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (lead: Lead) => {
    setEditingLead(lead);
    setNome(lead.nome);
    setEmail(lead.email || "");
    setTelefone(lead.telefone || "");
    setCargo(lead.cargo || "");
    setEmpresaClienteId(lead.empresa_cliente_id || "none");
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("O nome do lead é obrigatório.");
      return;
    }

    setLoading(true);
    try {
      await saveLead({
        data: {
          id: editingLead?.id,
          nome: nome.trim(),
          email: email.trim() || null,
          telefone: telefone.trim() || null,
          cargo: cargo.trim() || null,
          empresa_cliente_id: empresaClienteId === "none" ? null : empresaClienteId,
        },
      });

      toast.success(editingLead ? "Contato atualizado com sucesso!" : "Contato criado com sucesso!");
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao salvar contato: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este contato?")) return;

    setLoading(true);
    try {
      await deleteLead({ data: { id } });
      toast.success("Contato excluído com sucesso!");
      loadData();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const search = searchTerm.toLowerCase();
    return (
      lead.nome.toLowerCase().includes(search) ||
      (lead.email && lead.email.toLowerCase().includes(search)) ||
      (lead.telefone && lead.telefone.includes(search)) ||
      (lead.empresa_cliente?.razao_social && lead.empresa_cliente.razao_social.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos/leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 border-border bg-card"
          />
        </div>
        <Button onClick={handleOpenCreateForm} className="w-full sm:w-auto gap-1.5 h-10">
          <PlusCircle className="h-4 w-4" /> Cadastrar Lead / Contato
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Leads Table / List */}
        <Card className={`md:col-span-${isFormOpen ? "2" : "3"} border border-border bg-card`}>
          <CardHeader>
            <CardTitle className="text-lg">Banco de Leads & Contatos</CardTitle>
            <CardDescription>
              Visualize e gerencie os contatos das suas empresas parceiras.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && leads.length === 0 ? (
              <div className="py-24 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p>Carregando contatos...</p>
              </div>
            ) : filteredLeads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground font-medium text-xs">
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Empresa</th>
                      <th className="py-3 px-4">Cargo</th>
                      <th className="py-3 px-4">Contatos</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">{lead.nome}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {lead.empresa_cliente?.razao_social ? (
                            <div className="flex items-center gap-1.5">
                              <Building className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                              <span className="truncate max-w-[150px]">{lead.empresa_cliente.razao_social}</span>
                            </div>
                          ) : (
                            <span className="text-xs italic text-muted-foreground/50">Avulso</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {lead.cargo ? (
                            <div className="flex items-center gap-1.5">
                              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                              <span className="truncate max-w-[120px]">{lead.cargo}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground space-y-1">
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{lead.email}</span>
                            </div>
                          )}
                          {lead.telefone && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{lead.telefone}</span>
                            </div>
                          )}
                          {!lead.email && !lead.telefone && "-"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEditForm(lead)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(lead.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Nenhum contato cadastrado ou encontrado.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Form (Sidebar) */}
        {isFormOpen && (
          <Card className="md:col-span-1 border border-border bg-card animate-in slide-in-from-right-5 duration-200">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg">
                {editingLead ? "Editar Lead" : "Novo Lead / Contato"}
              </CardTitle>
              <CardDescription>
                Cadastre informações de contatos chaves para suas obras.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="lead-nome">Nome Completo *</Label>
                  <Input
                    id="lead-nome"
                    placeholder="Ex: João da Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="h-10"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lead-empresa">Empresa Cliente</Label>
                  <Select value={empresaClienteId} onValueChange={setEmpresaClienteId}>
                    <SelectTrigger id="lead-empresa" className="h-10">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border">
                      <SelectItem value="none">Nenhuma (Contato Avulso)</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lead-cargo">Cargo / Função</Label>
                  <Input
                    id="lead-cargo"
                    placeholder="Ex: Engenheiro, Comprador"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lead-email">E-mail</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    placeholder="Ex: joao@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lead-phone">Telefone / WhatsApp</Label>
                  <Input
                    id="lead-phone"
                    placeholder="Ex: (11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsFormOpen(false)}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
