import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CircleDollarSign, TrendingUp, Clock, CheckCircle2,
  HardHat, ArrowUpRight, MessageSquare, PhoneCall,
  Search, Loader2, DollarSign, Wallet, FileText, ArrowUpDown
} from "lucide-react";

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
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<AgendamentoFinanceiro[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  
  // Filters
  const [selectedObraId, setSelectedObraId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusPagamentoFilter, setStatusPagamentoFilter] = useState<string>("all");

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
      setObras(obrasData || []);

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

  // Filter logic
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

    const matchesSearch = 
      item.codigo_pedido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.obra?.nome_obra || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.servico?.nome_servico || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesObra && matchesStatus && matchesSearch;
  });

  // Calculate Metrics based on filters (or general company data - let's calculate based on selected Obra filter for maximum flexibility!)
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
            <Label htmlFor="obra-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filtrar por Obra</Label>
            <select
              id="obra-select"
              value={selectedObraId}
              onChange={(e) => setSelectedObraId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground shadow-sm"
            >
              <option value="all">Todas as Obras</option>
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
        <>
          {/* Metrics Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            
            {/* Metric 1: Pendente de Aceite */}
            <Card className="border border-border bg-card hover:shadow-[var(--shadow-elegant)] transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pendente de Aceite
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Clock className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">{formatCurrency(pendenteAceite)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Orçamentos aguardando aprovação
                </p>
              </CardContent>
            </Card>

            {/* Metric 2: Em Execução */}
            <Card className="border border-border bg-card hover:shadow-[var(--shadow-elegant)] transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Estimado Em Execução
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-sky-500">{formatCurrency(emExecucao)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Agendados e em campo (volume orçado)
                </p>
              </CardContent>
            </Card>

            {/* Metric 3: Faturado & Pago */}
            <Card className="border border-border bg-card hover:shadow-[var(--shadow-elegant)] transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Faturado & Pago
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-emerald-600">{formatCurrency(faturadoPago)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Serviços realizados já liquidados
                </p>
              </CardContent>
            </Card>

            {/* Metric 4: Faturado & A Pagar */}
            <Card className="border border-border bg-card hover:shadow-[var(--shadow-elegant)] transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Faturado & A Pagar
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                  <Wallet className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-rose-600">{formatCurrency(faturadoPendente)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Boletos em aberto ou pendentes
                </p>
              </CardContent>
            </Card>
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
        </>
      )}
    </div>
  );
}
