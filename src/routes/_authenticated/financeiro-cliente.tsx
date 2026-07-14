import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CircleDollarSign, TrendingUp, Clock, CheckCircle2,
  HardHat, ArrowUpRight, MessageSquare, PhoneCall,
  Search, Loader2, DollarSign, Wallet, FileText, ArrowUpDown, ShieldAlert
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid
} from "recharts";

export const Route = createFileRoute("/_authenticated/financeiro-cliente")({
  head: () => ({ meta: [{ title: "Financeiro — Quantis Obras" }] }),
  component: FinanceiroClientePage,
});

interface AgendamentoFinanceiro {
  id: string;
  codigo_pedido: string;
  data_servico: string;
  valor_total: number;
  status_agendamento: string;
  status_pagamento: string;
  obra_id: string;
  obra?: {
    nome_obra: string;
    cidade: string;
  } | null;
  servico?: {
    nome_servico: string;
    sku: string;
  } | null;
}

interface Obra {
  id: string;
  nome_obra: string;
}

function FinanceiroClientePage() {
  const { user, profile, roles } = useAuth();
  const navigate = useNavigate();

  const role = primaryRole(roles);
  const hasPermission = (permission: string) => {
    if (role !== "cliente") return true;
    if (!profile) return false;
    if (profile.sub_role === "master") return true;
    return profile.permissoes?.includes(permission) ?? false;
  };

  if (!hasPermission("financeiro")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Acesso Financeiro Restrito</h2>
        <p className="text-sm text-muted-foreground">Sua conta de usuário não possui permissão para visualizar o painel financeiro. Solicite o acesso ao gestor da sua empresa.</p>
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

  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<AgendamentoFinanceiro[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Filters
  const [selectedObraId, setSelectedObraId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusPagamentoFilter, setStatusPagamentoFilter] = useState<string>("all");
  const [activeCardFilter, setActiveCardFilter] = useState<"all" | "pendente" | "execucao" | "pago" | "apagar">("all");
  
  // Obras Selected for Average Ticket Calculation
  const [selectedObrasForTicket, setSelectedObrasForTicket] = useState<string[]>([]);
  const [selectAllObrasTicket, setSelectAllObrasTicket] = useState(true);

  const loadFinanceData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // 1. Get profile and company ID
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile?.empresa_id) {
        toast.error("Perfil sem empresa associada.");
        return;
      }

      const empresaId = profile.empresa_id;

      // 2. Fetch Obras list for filter
      const { data: obrasData, error: obrasErr } = await supabase
        .from("obras")
        .select("id, nome_obra")
        .eq("empresa_id", empresaId);

      if (obrasErr) throw obrasErr;
      const loadedObras = obrasData || [];
      setObras(loadedObras);
      setSelectedObrasForTicket(loadedObras.map(o => o.id));

      // 3. Fetch Agendamentos with joins
      const { data: agendamentosData, error: agendamentosErr } = await supabase
        .from("agendamentos_medicoes")
        .select("*, obra:obras(*), servico:servicos_catalogo_pub(*)")
        .eq("empresa_id", empresaId);

      if (agendamentosErr) throw agendamentosErr;
      
      // Map data to match interface
      const mapped: AgendamentoFinanceiro[] = (agendamentosData || []).map((item: any) => ({
        id: item.id,
        codigo_pedido: item.codigo_pedido,
        data_servico: item.data_servico,
        valor_total: item.valor_total || 0,
        status_agendamento: item.status_agendamento,
        status_pagamento: item.status_pagamento,
        obra_id: item.obra_id,
        obra: item.obra ? { nome_obra: item.obra.nome_obra, cidade: item.obra.cidade } : null,
        servico: item.servico ? { nome_servico: item.servico.nome_servico, sku: item.servico.sku } : null,
      }));

      setAgendamentos(mapped);
    } catch (err: any) {
      toast.error("Erro ao carregar dados financeiros: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, [user]);

  // Handle Multi-Select toggles for Ticket average
  const toggleObraTicket = (obraId: string) => {
    setSelectedObrasForTicket(prev => {
      const next = prev.includes(obraId)
        ? prev.filter(id => id !== obraId)
        : [...prev, obraId];
      setSelectAllObrasTicket(next.length === obras.length);
      return next;
    });
  };

  const toggleAllObrasTicket = () => {
    if (selectAllObrasTicket) {
      setSelectedObrasForTicket([]);
      setSelectAllObrasTicket(false);
    } else {
      setSelectedObrasForTicket(obras.map(o => o.id));
      setSelectAllObrasTicket(true);
    }
  };

  // Filter logic for main table
  const filteredAgendamentos = agendamentos.filter((item) => {
    const matchesObra = selectedObraId === "all" || item.obra_id === selectedObraId;
    
    // Map status_pagamento internal states to simplified categories
    const isPaid = item.status_pagamento === "Pago";
    const isUnpaid = ["Pendente", "Boleto_Aberto"].includes(item.status_pagamento);
    const isCancelled = item.status_pagamento === "Cancelado";
    
    let matchesStatus = true;
    if (statusPagamentoFilter === "pago") matchesStatus = isPaid;
    else if (statusPagamentoFilter === "apagar") matchesStatus = isUnpaid;
    else if (statusPagamentoFilter === "cancelado") matchesStatus = isCancelled;

    // Filter by interactive top cards
    let matchesCard = true;
    if (activeCardFilter === "pendente") {
      matchesCard = ["Pendente_Tecnico", "Pendente_Aprovacao_Gestor"].includes(item.status_agendamento);
    } else if (activeCardFilter === "execucao") {
      matchesCard = ["Confirmado", "Em_Execucao"].includes(item.status_agendamento);
    } else if (activeCardFilter === "pago") {
      matchesCard = ["Aguardando_Medicao", "Laboratorio", "Validado"].includes(item.status_agendamento) && isPaid;
    } else if (activeCardFilter === "apagar") {
      matchesCard = ["Aguardando_Medicao", "Laboratorio", "Validado"].includes(item.status_agendamento) && isUnpaid;
    }

    const matchesSearch = 
      (item.codigo_pedido || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.obra?.nome_obra || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.servico?.nome_servico || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesObra && matchesStatus && matchesCard && matchesSearch;
  });

  // Calculate Metrics based on top-level filter (selectedObraId)
  const scopeItems = selectedObraId === "all" 
    ? agendamentos 
    : agendamentos.filter(i => i.obra_id === selectedObraId);

  // 1. Pendente de Aceite (Aguardando Aprovação de Orçamento)
  const pendenteAceite = scopeItems
    .filter(i => ["Pendente_Tecnico", "Pendente_Aprovacao_Gestor"].includes(i.status_agendamento))
    .reduce((acc, i) => acc + i.valor_total, 0);

  // 2. Em Execução (Agendado/Técnico em campo - de acordo com volume orçado/aceito)
  const emExecucao = scopeItems
    .filter(i => ["Confirmado", "Em_Execucao"].includes(i.status_agendamento))
    .reduce((acc, i) => acc + i.valor_total, 0);

  // 3. Realizado (Concluído/Laudo em lab/Aguardando medição)
  const realizadoTotal = scopeItems
    .filter(i => ["Aguardando_Medicao", "Laboratorio", "Validado"].includes(i.status_agendamento))
    .reduce((acc, i) => acc + i.valor_total, 0);

  // 4. Pago (Realizado & Pago)
  const faturadoPago = scopeItems
    .filter(i => ["Aguardando_Medicao", "Laboratorio", "Validado"].includes(i.status_agendamento) && i.status_pagamento === "Pago")
    .reduce((acc, i) => acc + i.valor_total, 0);

  // 5. A Pagar (Realizado & Boleto Aberto/Pendente)
  const faturadoPendente = scopeItems
    .filter(i => ["Aguardando_Medicao", "Laboratorio", "Validado"].includes(i.status_agendamento) && ["Pendente", "Boleto_Aberto"].includes(i.status_pagamento))
    .reduce((acc, i) => acc + i.valor_total, 0);

  const totalFaturadoRealizado = faturadoPago + faturadoPendente;
  const pctPago = totalFaturadoRealizado > 0 ? Math.round((faturadoPago / totalFaturadoRealizado) * 100) : 0;
  const pctAPagar = totalFaturadoRealizado > 0 ? 100 - pctPago : 0;

  // Format currency helper
  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Helper to open WhatsApp conversation for bills
  const handleContactSupport = (item: AgendamentoFinanceiro) => {
    const text = encodeURIComponent(
      `Olá! Gostaria de falar sobre o faturamento do pedido *${item.codigo_pedido}* da obra *${item.obra?.nome_obra || "Não identificada"}* no valor de *${formatCurrency(item.valor_total)}*.`
    );
    window.open(`https://wa.me/5515981103345?text=${text}`, "_blank");
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  // --- CHART CALCULATIONS ---
  // A. Pie Chart
  const pieData = [
    { name: "Pendente de Aceite", value: pendenteAceite, color: "#f59e0b" },
    { name: "Estimado em Execução", value: emExecucao, color: "#0ea5e9" },
    { name: "Faturado & Pago", value: faturadoPago, color: "#10b981" },
    { name: "Faturado & A Pagar", value: faturadoPendente, color: "#f43f5e" }
  ].filter(d => d.value > 0);

  // B. Ticket Médio por Obra
  const ticketMedioData = obras
    .filter(o => selectedObrasForTicket.includes(o.id))
    .map(o => {
      const obraAgendamentos = agendamentos.filter(a => a.obra_id === o.id);
      const totalValue = obraAgendamentos.reduce((acc, a) => acc + a.valor_total, 0);
      const count = obraAgendamentos.length;
      const avg = count > 0 ? Math.round(totalValue / count) : 0;
      return {
        name: o.nome_obra,
        avgTicket: avg,
        totalValue: totalValue,
        count: count,
      };
    })
    .filter(d => d.count > 0);

  // C. Orçado (Pendente + Execução) vs Realizado (Pago + A Pagar) por Obra
  const execucaoFaturamentoData = obras.map(o => {
    const obraAgendamentos = agendamentos.filter(a => a.obra_id === o.id);
    
    const orcado = obraAgendamentos
      .filter(a => ["Pendente_Tecnico", "Pendente_Aprovacao_Gestor", "Confirmado", "Em_Execucao"].includes(a.status_agendamento))
      .reduce((acc, a) => acc + a.valor_total, 0);
      
    const realizado = obraAgendamentos
      .filter(a => ["Aguardando_Medicao", "Laboratorio", "Validado"].includes(a.status_agendamento))
      .reduce((acc, a) => acc + a.valor_total, 0);
      
    return {
      name: o.nome_obra,
      "Planejado (Em Aberto)": orcado,
      "Faturado (Realizado)": realizado,
    };
  }).filter(d => d["Planejado (Em Aberto)"] > 0 || d["Faturado (Realizado)"] > 0);

  const handleCardClick = (cardName: "pendente" | "execucao" | "pago" | "apagar") => {
    if (activeCardFilter === cardName) {
      setActiveCardFilter("all");
    } else {
      setActiveCardFilter(cardName);
      setActiveTab("extrato"); // Zoom to table automatically
      toast.info(`Tabela filtrada por: ${
        cardName === "pendente" ? "Pendente de Aceite" :
        cardName === "execucao" ? "Estimado em Execução" :
        cardName === "pago" ? "Faturado & Pago" : "Faturado & A Pagar"
      }`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Painel Financeiro
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
              <CircleDollarSign className="h-3 w-3" /> Clientes
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a estimativa de custos de orçamentos, obras em execução e o faturamento de ensaios realizados.
          </p>
        </div>

        {/* Top filter: Obra Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="space-y-1.5 w-full md:w-60">
            <Label htmlFor="obra-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filtrar Consolidação por Obra</Label>
            <select
              id="obra-select"
              value={selectedObraId}
              onChange={(e) => setSelectedObraId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground shadow-sm"
            >
              <option value="all">Todas as Obras (Consolidado)</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome_obra}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Processando demonstrativo financeiro...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-border pb-3">
            <TabsList className="bg-muted/60 p-1 rounded-lg">
              <TabsTrigger value="dashboard" className="text-xs font-bold px-4 py-2 rounded-md">
                Indicadores & Gráficos
              </TabsTrigger>
              <TabsTrigger value="extrato" className="text-xs font-bold px-4 py-2 rounded-md">
                Extrato Detalhado de Pedidos ({filteredAgendamentos.length})
              </TabsTrigger>
            </TabsList>
            
            {activeCardFilter !== "all" && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setActiveCardFilter("all");
                  toast.success("Filtro de card removido");
                }}
                className="h-8 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive border-destructive/20 gap-1 bg-background"
              >
                Limpar Filtro de Card
              </Button>
            )}
          </div>

          <TabsContent value="dashboard" className="space-y-6 outline-none">
            {/* KPI Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Pendente de Aceite */}
              <button 
                onClick={() => handleCardClick("pendente")}
                className={`text-left w-full transition-all duration-200 border rounded-xl bg-card shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                  activeCardFilter === "pendente" 
                    ? "border-amber-500 ring-2 ring-amber-500/20 shadow-md" 
                    : activeCardFilter !== "all"
                    ? "opacity-60 border-border/80" 
                    : "border-border hover:border-amber-500/40"
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-row items-center justify-between pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Pendente de Aceite
                    </span>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-amber-500">{formatCurrency(pendenteAceite)}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Orçamentos aguardando aprovação
                  </p>
                </div>
              </button>

              {/* Card 2: Estimado em Execução */}
              <button 
                onClick={() => handleCardClick("execucao")}
                className={`text-left w-full transition-all duration-200 border rounded-xl bg-card shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                  activeCardFilter === "execucao" 
                    ? "border-sky-500 ring-2 ring-sky-500/20 shadow-md" 
                    : activeCardFilter !== "all"
                    ? "opacity-60 border-border/80" 
                    : "border-border hover:border-sky-500/40"
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-row items-center justify-between pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Estimado Em Execução
                    </span>
                    <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-sky-500">{formatCurrency(emExecucao)}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Agendados e em campo (volume orçado)
                  </p>
                </div>
              </button>

              {/* Card 3: Faturado & Pago */}
              <button 
                onClick={() => handleCardClick("pago")}
                className={`text-left w-full transition-all duration-200 border rounded-xl bg-card shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                  activeCardFilter === "pago" 
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md" 
                    : activeCardFilter !== "all"
                    ? "opacity-60 border-border/80" 
                    : "border-border hover:border-emerald-500/40"
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-row items-center justify-between pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Faturado & Pago
                    </span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-emerald-600">{formatCurrency(faturadoPago)}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Serviços realizados já liquidados
                  </p>
                </div>
              </button>

              {/* Card 4: Faturado & A Pagar */}
              <button 
                onClick={() => handleCardClick("apagar")}
                className={`text-left w-full transition-all duration-200 border rounded-xl bg-card shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                  activeCardFilter === "apagar" 
                    ? "border-rose-500 ring-2 ring-rose-500/20 shadow-md" 
                    : activeCardFilter !== "all"
                    ? "opacity-60 border-border/80" 
                    : "border-border hover:border-rose-500/40"
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-row items-center justify-between pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Faturado & A Pagar
                    </span>
                    <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-rose-600">{formatCurrency(faturadoPendente)}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Boletos em aberto ou pendentes
                  </p>
                </div>
              </button>
            </div>

            {/* Visual Billing Progress Bar */}
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Balanço de Faturamento (Ensaios Realizados)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Percentual pago em relação ao total já faturado: <strong className="text-foreground">{formatCurrency(totalFaturadoRealizado)}</strong>
                    </CardDescription>
                  </div>
                  <div className="text-xs font-semibold shrink-0 text-muted-foreground">
                    <span className="text-emerald-600 font-bold">{pctPago}% Pago</span> / <span className="text-rose-600 font-bold">{pctAPagar}% Em Aberto</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {totalFaturadoRealizado > 0 ? (
                  <div className="space-y-2">
                    {/* Progress bar container */}
                    <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-500" 
                        style={{ width: `${pctPago}%` }} 
                        title={`Pago: ${formatCurrency(faturadoPago)}`}
                      />
                      <div 
                        className="bg-rose-500 h-full transition-all duration-500" 
                        style={{ width: `${pctAPagar}%` }} 
                        title={`A Pagar: ${formatCurrency(faturadoPendente)}`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/> Pago: {formatCurrency(faturadoPago)}</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/> A Pagar: {formatCurrency(faturadoPendente)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4 bg-muted/20 border rounded-lg border-dashed">
                    Nenhum serviço realizado/faturado registrado para esta obra até o momento.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CHARTS CONTAINER GRID */}
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Chart 1: Pie Chart Distribution */}
              <Card className="border border-border bg-card flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <CircleDollarSign className="h-4 w-4 text-primary" />
                    Distribuição Financeira
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Divisão do valor financeiro total por categoria de status.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[260px] flex items-center justify-center">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: any) => [formatCurrency(value), "Valor"]} 
                          contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "11px" }}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          height={36} 
                          iconSize={10} 
                          iconType="circle"
                          wrapperStyle={{ fontSize: "10px", marginTop: "10px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum dado financeiro disponível para exibição.</p>
                  )}
                </CardContent>
              </Card>

              {/* Chart 2: Average Ticket with Checklist filter */}
              <Card className="border border-border bg-card flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Ticket Médio por Obra
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Média de valor faturado/planejado por solicitação.
                      </CardDescription>
                    </div>
                    
                    {/* Obras checklist dropdown filter */}
                    <div className="relative group self-start shrink-0">
                      <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1.5">
                        <HardHat className="h-3 w-3" /> Filtrar Obras ({selectedObrasForTicket.length})
                      </Button>
                      
                      {/* Hover checklist content */}
                      <div className="absolute right-0 top-9 w-52 bg-card border border-border rounded-lg shadow-lg p-2.5 hidden group-hover:block hover:block z-50 space-y-2">
                        <div className="flex items-center justify-between border-b border-border pb-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Obras</span>
                          <button 
                            onClick={toggleAllObrasTicket}
                            className="text-[9px] text-primary hover:underline font-semibold"
                          >
                            {selectAllObrasTicket ? "Desmarcar Todos" : "Marcar Todos"}
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin">
                          {obras.map(o => {
                            const isChecked = selectedObrasForTicket.includes(o.id);
                            return (
                              <label key={o.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer text-foreground hover:bg-muted/40 p-1 rounded transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleObraTicket(o.id)}
                                  className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-ring focus:ring-offset-0 bg-background"
                                />
                                <span className="truncate">{o.nome_obra}</span>
                              </label>
                            );
                          })}
                          {obras.length === 0 && (
                            <span className="text-[10px] text-muted-foreground block text-center py-2">Nenhuma obra cadastrada.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-[260px] flex items-center justify-center pt-2">
                  {ticketMedioData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ticketMedioData} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 9 }} 
                          axisLine={false} 
                          tickLine={false} 
                          stroke="var(--muted-foreground)"
                        />
                        <YAxis 
                          tickFormatter={(v) => `R$ ${v}`}
                          tick={{ fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          stroke="var(--muted-foreground)"
                        />
                        <RechartsTooltip 
                          formatter={(value: any, name: any, props: any) => [
                            formatCurrency(value), 
                            "Ticket Médio",
                            `Pedidos: ${props.payload.count}`
                          ]}
                          contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "11px" }}
                        />
                        <Bar 
                          dataKey="avgTicket" 
                          fill="var(--primary)" 
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">Nenhum dado para as obras selecionadas.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Chart 3: Stacked Bar Chart for Budget vs Realized */}
            <Card className="border border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" />
                  Balanço por Obra: Orçamento Planejado vs. Faturamento Realizado
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparação do valor financeiro que ainda está planejado/em execução vs. o que já foi faturado (pago/a pagar) por obra.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] pt-4">
                {execucaoFaturamentoData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={execucaoFaturamentoData} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 9 }} 
                        axisLine={false} 
                        tickLine={false} 
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis 
                        tickFormatter={(v) => `R$ ${v}`}
                        tick={{ fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        stroke="var(--muted-foreground)"
                      />
                      <RechartsTooltip 
                        formatter={(value: any) => [formatCurrency(value)]}
                        contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "11px" }}
                      />
                      <Legend 
                        verticalAlign="top" 
                        height={36} 
                        iconSize={10} 
                        wrapperStyle={{ fontSize: "10px", paddingBottom: "10px" }}
                      />
                      <Bar dataKey="Planejado (Em Aberto)" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="Faturado (Realizado)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Nenhum dado orçado ou faturado disponível.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="extrato" className="space-y-6 outline-none">
            {/* Active Card Filter Alert Banner */}
            {activeCardFilter !== "all" && (
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  <span>
                    Exibindo apenas lançamentos de: <strong>{
                      activeCardFilter === "pendente" ? "Pendente de Aceite" :
                      activeCardFilter === "execucao" ? "Estimado em Execução" :
                      activeCardFilter === "pago" ? "Faturado & Pago" : "Faturado & A Pagar"
                    }</strong>
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveCardFilter("all")}
                  className="h-7 text-[10px] font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Limpar Filtro
                </Button>
              </div>
            )}

            {/* Table section */}
            <Card className="border border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Extrato Financeiro de Pedidos</CardTitle>
                <CardDescription className="text-xs">
                  Visualize todos os pedidos da empresa, seus valores e o respectivo status de faturamento.
                </CardDescription>
                
                {/* Filters row */}
                <div className="flex flex-col sm:flex-row gap-3 pt-3">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código de pedido, obra ou serviço..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  {/* Payment Status Filter */}
                  <div className="w-full sm:w-44">
                    <select
                      value={statusPagamentoFilter}
                      onChange={(e) => setStatusPagamentoFilter(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground shadow-sm"
                    >
                      <option value="all">Todos os Status</option>
                      <option value="pago">Pago</option>
                      <option value="apagar">A Pagar</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-y border-border bg-muted/40 text-muted-foreground font-semibold">
                        <th className="py-3 px-4">Pedido</th>
                        <th className="py-3 px-4">Obra</th>
                        <th className="py-3 px-4">Serviço</th>
                        <th className="py-3 px-4">Data do Serviço</th>
                        <th className="py-3 px-4 text-right">Valor Total</th>
                        <th className="py-3 px-4">Status Execução</th>
                        <th className="py-3 px-4">Status Pagamento</th>
                        <th className="py-3 px-4 text-center">Faturamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAgendamentos.map((item) => {
                        const isPaid = item.status_pagamento === "Pago";
                        const isUnpaid = ["Pendente", "Boleto_Aberto"].includes(item.status_pagamento);
                        const isCancelled = item.status_pagamento === "Cancelado";

                        return (
                          <tr key={item.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium">{item.codigo_pedido}</td>
                            <td className="py-3 px-4 font-medium text-foreground truncate max-w-[150px]" title={item.obra?.nome_obra}>
                              {item.obra?.nome_obra || "—"}
                            </td>
                            <td className="py-3 px-4 truncate max-w-[150px]" title={item.servico?.nome_servico}>
                              {item.servico?.nome_servico || "—"}
                            </td>
                            <td className="py-3 px-4">{formatDate(item.data_servico)}</td>
                            <td className="py-3 px-4 text-right font-bold text-foreground">
                              {formatCurrency(item.valor_total)}
                            </td>
                            <td className="py-3 px-4 capitalize">
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-accent text-accent-foreground font-semibold">
                                {item.status_agendamento.replace(/_/g, " ").toLowerCase()}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isPaid && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  Pago
                                </span>
                              )}
                              {isUnpaid && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                  A Pagar
                                </span>
                              )}
                              {isCancelled && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400">
                                  Cancelado
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isUnpaid ? (
                                <Button
                                  onClick={() => handleContactSupport(item)}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] gap-1 border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-50/30 text-emerald-600 dark:text-emerald-400 font-semibold"
                                >
                                  <MessageSquare className="h-3 w-3" /> Falar Financeiro
                                </Button>
                              ) : (
                                <span className="text-muted-foreground/40 text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredAgendamentos.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-muted-foreground font-medium">
                            Nenhum registro localizado com os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
