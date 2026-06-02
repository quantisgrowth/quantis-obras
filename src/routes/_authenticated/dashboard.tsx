import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus, ClipboardList, Users, Settings, MapPin, Camera,
  Bell, BarChart3, Clock, FlaskConical, ChevronRight, X, Check, AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Geraltest Brasil" }] }),
  component: Dashboard,
});

// ── Helpers ────────────────────────────────────────────────────────────────
function Dashboard() {
  const { roles, user } = useAuth();
  const role = primaryRole(roles);
  if (role === "admin") return <AdminDash />;
  if (role === "tecnico") return <TecnicoDash email={user?.email ?? ""} userId={user?.id ?? ""} />;
  return <ClienteDash email={user?.email ?? ""} userId={user?.id ?? ""} />;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function PlaceholderCard({ icon: Icon, title, desc, badge }: { icon: LucideIcon; title: string; desc: string; badge?: string }) {
  return (
    <Card className="transition-all hover:shadow-[var(--shadow-elegant)] border border-border bg-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        <CardTitle className="mt-3 text-base">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">Em breve nesta fase do app.</p>
      </CardContent>
    </Card>
  );
}

// Status helpers
const STATUS_COLORS: Record<string, string> = {
  Pendente_Tecnico: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Confirmado: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Em_Execucao: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  Aguardando_Medicao: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Validado: "bg-green-500/10 text-green-600 border-green-500/20",
  Laboratorio: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  Cancelado: "bg-red-500/10 text-red-600 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  Pendente_Tecnico: "⏳ Aguardando Técnico",
  Confirmado: "✅ Confirmado",
  Em_Execucao: "🔧 Em Execução",
  Aguardando_Medicao: "📋 Aguardando Medição",
  Validado: "✅ Concluído e Validado",
  Laboratorio: "🔬 No Laboratório",
  Cancelado: "❌ Cancelado",
};

// ── CLIENTE DASHBOARD ──────────────────────────────────────────────────────
function ClienteDash({ email, userId }: { email: string; userId: string }) {
  const navigate = useNavigate();

  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendentes" | "concluidos">("todos");

  useEffect(() => {
    if (!userId) return;
    async function fetchBookings() {
      try {
        const { data, error } = await supabase
          .from("agendamentos_medicoes")
          .select("*, obra:obras(*), servico:servicos_catalogo_pub(*)")
          .eq("criado_por", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (data) setAgendamentos(data);
      } catch (err) {
        console.error("Error fetching bookings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, [userId]);

  const pendentes = agendamentos.filter((a) =>
    ["Pendente_Tecnico", "Confirmado", "Em_Execucao", "Aguardando_Medicao"].includes(a.status_agendamento)
  );
  const concluidos = agendamentos.filter((a) =>
    ["Validado", "Laboratorio", "Cancelado"].includes(a.status_agendamento)
  );

  const listaFiltrada =
    filtroStatus === "pendentes" ? pendentes :
    filtroStatus === "concluidos" ? concluidos :
    agendamentos;

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <SectionTitle
        title="Painel do Cliente"
        subtitle={`Bem-vindo, ${email}. Gerencie seus agendamentos de controle tecnológico.`}
      />

      {/* ── Ações Rápidas ── */}
      <div className="flex flex-wrap gap-3">
        {/* Botão Novo Agendamento */}
        <Button
          onClick={() => {
            if (showNovoAgendamento) {
              setShowNovoAgendamento(false);
            } else {
              navigate({ to: "/novo-agendamento" });
            }
          }}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
          size="lg"
        >
          <CalendarPlus className="h-5 w-5" />
          Novo Agendamento
        </Button>

        {/* Botão Agendamentos Pendentes */}
        <Button
          variant={filtroStatus === "pendentes" ? "default" : "outline"}
          size="lg"
          className="gap-2 font-semibold"
          onClick={() => setFiltroStatus(filtroStatus === "pendentes" ? "todos" : "pendentes")}
        >
          <Clock className="h-5 w-5" />
          Agendamentos Pendentes
          {pendentes.length > 0 && (
            <Badge className="ml-1 bg-amber-500 text-white border-0 text-xs">
              {pendentes.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* ── Cards de Resumo ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border border-border bg-card">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Pedidos</p>
            <p className="text-3xl font-extrabold text-foreground mt-1">{agendamentos.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-5">
            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Pendentes / Em Andamento</p>
            <p className="text-3xl font-extrabold text-amber-600 mt-1">{pendentes.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-green-500/30 bg-green-500/5">
          <CardContent className="pt-5">
            <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Concluídos / Validados</p>
            <p className="text-3xl font-extrabold text-green-600 mt-1">{concluidos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Lista de Agendamentos ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {filtroStatus === "pendentes" ? "Agendamentos Pendentes" :
             filtroStatus === "concluidos" ? "Concluídos / Validados" :
             "Todos os Agendamentos"}
          </h2>

          {/* Filtros */}
          <div className="flex gap-2">
            {(["todos", "pendentes", "concluidos"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroStatus(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  filtroStatus === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {f === "todos" ? "Todos" : f === "pendentes" ? "Pendentes" : "Concluídos"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Carregando agendamentos…</div>
        ) : listaFiltrada.length === 0 ? (
          <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
            <CardContent className="space-y-3">
              <FlaskConical className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {filtroStatus === "pendentes"
                  ? "Nenhum agendamento pendente no momento."
                  : filtroStatus === "concluidos"
                  ? "Nenhum agendamento concluído ainda."
                  : "Você ainda não tem nenhum agendamento registrado."}
              </p>
              <Button
                onClick={() => navigate({ to: "/novo-agendamento" })}
                size="sm"
                className="mt-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                Fazer Meu Primeiro Agendamento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {listaFiltrada.map((ag) => (
              <Card
                key={ag.id}
                className="border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{ag.obra?.nome_obra || "Obra sem nome"}</span>
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[ag.status_agendamento] || "bg-muted text-muted-foreground"}
                      >
                        {STATUS_LABELS[ag.status_agendamento] || ag.status_agendamento}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {ag.servico?.nome_servico || "Controle Tecnológico"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pedido: <span className="text-foreground font-medium">{ag.codigo_pedido}</span>
                      {ag.obra?.cidade && ` · ${ag.obra.cidade}`}
                    </p>
                    {ag.observacoes && (
                      <p className="text-xs text-muted-foreground italic">"{ag.observacoes}"</p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-border min-w-[120px]">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0, 5)}
                    </div>
                    <div className="text-sm font-extrabold text-primary mt-1">
                      R$ {Number(ag.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {ag.cps_contratados} CPs · {ag.forma_pagamento}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs text-primary hover:text-primary h-7 px-2"
                      onClick={() => navigate({ to: "/novo-agendamento" })}
                    >
                      Repetir pedido <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── TÉCNICO DASHBOARD ──────────────────────────────────────────────────────
// ── INVITATION COUNTDOWN ───────────────────────────────────────────────────
function InvitationCountdown({ convidadoEm, onTimeout }: { convidadoEm: string | null; onTimeout: () => void }) {
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (!convidadoEm || hasTimedOut) return;

    const targetTime = new Date(convidadoEm).getTime() + 3 * 60 * 60 * 1000;

    const updateTimer = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeLeftStr("Expirado");
        setHasTimedOut(true);
        onTimeout();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeftStr(
        `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [convidadoEm, onTimeout, hasTimedOut]);

  if (!convidadoEm) {
    return (
      <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded border border-border">
        Sem convite ativo
      </span>
    );
  }

  return (
    <span className="font-mono text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded border border-red-200 dark:border-red-900/50 flex items-center gap-1.5 animate-pulse">
      <Clock className="h-3.5 w-3.5" />
      {timeLeftStr}
    </span>
  );
}

// ── TÉCNICO DASHBOARD ──────────────────────────────────────────────────────
function TecnicoDash({ email, userId }: { email: string; userId: string }) {
  const [tecnico, setTecnico] = useState<any>(null);
  const [convites, setConvites] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTecnicoData = async () => {
    try {
      // Dynamic import to avoid client-side bundling of server functions middleware
      const { processTimeouts: dynamicProcessTimeouts } = await import("@/lib/booking.functions");
      await dynamicProcessTimeouts();

      // Get technician profile
      const { data: tec, error: tecErr } = await supabase
        .from("tecnicos")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tecErr || !tec) {
        console.error("Technician profile not found:", tecErr);
        setLoading(false);
        return;
      }
      setTecnico(tec);

      // Get invitations
      const { data: invList, error: invErr } = await supabase
        .from("agendamentos_medicoes")
        .select("*, obra:obras(*), servico:servicos_catalogo_pub(*)")
        .eq("tecnico_id", tec.id)
        .eq("status_agendamento", "Pendente_Tecnico")
        .order("created_at", { ascending: false });

      if (!invErr && invList) {
        setConvites(invList);
      }

      // Get confirmed schedule
      const { data: scheduleList, error: schErr } = await supabase
        .from("agendamentos_medicoes")
        .select("*, obra:obras(*), servico:servicos_catalogo_pub(*)")
        .eq("tecnico_id", tec.id)
        .neq("status_agendamento", "Pendente_Tecnico")
        .neq("status_agendamento", "Cancelado")
        .order("data_servico", { ascending: true })
        .order("horario_na_obra", { ascending: true });

      if (!schErr && scheduleList) {
        setAgenda(scheduleList);
      }
    } catch (err) {
      console.error("Error fetching technician dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchTecnicoData();
    }
  }, [userId]);

  const handleAccept = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const { acceptInvite: dynamicAcceptInvite } = await import("@/lib/booking.functions");
      await dynamicAcceptInvite({ bookingId });
      toast.success("Agendamento aceito com sucesso!");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aceitar o convite.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const { rejectInvite: dynamicRejectInvite } = await import("@/lib/booking.functions");
      await dynamicRejectInvite({ bookingId });
      toast.info("Convite recusado.");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao recusar o convite.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Carregando painel do técnico…</div>;
  }

  if (!tecnico) {
    return (
      <Card className="border border-dashed border-red-500/30 p-8 text-center bg-red-500/5 max-w-xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Perfil Técnico Não Localizado</h2>
          <p className="text-sm text-muted-foreground">
            Sua conta está associada ao cargo de técnico, mas não encontramos um cadastro correspondente na tabela de técnicos. Por favor, contate o administrador do sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SectionTitle 
          title={`Painel do Técnico — ${tecnico.nome}`} 
          subtitle={`Bem-vindo, ${email}. Gerencie seus convites de serviço e sua escala.`} 
        />
        <div className="flex items-center gap-2 bg-emerald-600/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-500 text-sm font-semibold self-start sm:self-center">
          ⭐ Score de Avaliação: {tecnico.ranking_score ? Number(tecnico.ranking_score).toFixed(1) : "0.0"}
        </div>
      </div>

      {/* ── SEÇÃO: CONVITES PENDENTES ── */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" />
          Convites Pendentes ({convites.length})
        </h2>

        {convites.length === 0 ? (
          <Card className="border border-dashed border-border py-10 text-center bg-muted/10">
            <CardContent className="space-y-2">
              <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Você não possui convites pendentes no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {convites.map((ag) => (
              <Card key={ag.id} className="border-2 border-amber-500/40 bg-amber-500/5 hover:shadow-md transition-all">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">
                      {ag.obra?.nome_obra || "Obra sem nome"}
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold text-amber-600 mt-1">
                      {ag.servico?.nome_servico || "Controle Tecnológico"}
                    </CardDescription>
                  </div>
                  <InvitationCountdown convidadoEm={ag.convidado_em} onTimeout={fetchTecnicoData} />
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      📍 <strong className="text-foreground">Endereço:</strong> {ag.obra?.endereco}, {ag.obra?.numero} - {ag.obra?.bairro}, {ag.obra?.cidade}/{ag.obra?.estado}
                    </p>
                    <p>
                      📅 <strong className="text-foreground">Data/Hora:</strong> {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0, 5)}
                    </p>
                    <p>
                      🧪 <strong className="text-foreground">Quantidade CPs:</strong> {ag.cps_contratados} unidades ({ag.qtd_caminhoes} caminhão/ões)
                    </p>
                    {ag.observacoes && (
                      <p className="italic bg-card p-2 rounded border border-border mt-2">
                        "{ag.observacoes}"
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      onClick={() => handleAccept(ag.id)}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === ag.id ? "Processando..." : "Aceitar Convite"}
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 border-red-500/30 text-red-600 hover:bg-red-500/10"
                      onClick={() => handleReject(ag.id)}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === ag.id ? "Processando..." : "Recusar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── SEÇÃO: MINHA ESCALA / AGENDA ── */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-primary" />
          Minha Escala / Próximos Serviços ({agenda.length})
        </h2>

        {agenda.length === 0 ? (
          <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
            <CardContent className="space-y-2">
              <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum serviço confirmado na sua agenda por enquanto.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {agenda.map((ag) => (
              <Card key={ag.id} className="border border-border bg-card p-4 hover:shadow-sm transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{ag.obra?.nome_obra || "Obra sem nome"}</span>
                      <Badge variant="outline" className={STATUS_COLORS[ag.status_agendamento] || "bg-muted text-muted-foreground"}>
                        {STATUS_LABELS[ag.status_agendamento] || ag.status_agendamento}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {ag.servico?.nome_servico || "Controle Tecnológico"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      📍 {ag.obra?.endereco}, {ag.obra?.numero} - {ag.obra?.bairro}, {ag.obra?.cidade}/{ag.obra?.estado}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pedido: <span className="text-foreground font-medium">{ag.codigo_pedido}</span> · CPs: <span className="text-foreground font-medium">{ag.cps_contratados}</span>
                    </p>
                    {ag.observacoes && (
                      <p className="text-xs text-muted-foreground italic">"{ag.observacoes}"</p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-border min-w-[150px]">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium bg-muted px-2.5 py-1 rounded">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0, 5)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── CARDS DE SUPORTE DO TÉCNICO ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 border-t border-border pt-8">
        <PlaceholderCard icon={MapPin} title="Check-in obra (GPS)" desc="Liberado quando o GPS bater com o raio do endereço." badge="Fase 2" />
        <PlaceholderCard icon={Camera} title="Foto por ciclo" desc="Anexo a cada betonada, em tempo real." badge="Fase 2" />
      </div>
    </div>
  );
}

// ── ADMIN DASHBOARD ────────────────────────────────────────────────────────
function AdminDash() {
  return (
    <>
      <SectionTitle title="Painel do Gestor" subtitle="Visão macro de ensaios, escala e configurações." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlaceholderCard icon={Users} title="Técnicos em campo" desc="Grid com alocações do dia e status." badge="Fase 2" />
        <PlaceholderCard icon={Bell} title="Alertas de escala" desc="Risco de banco de horas e descanso 11h." badge="Fase 2" />
        <PlaceholderCard icon={Settings} title="Configurações globais" desc="Eficiência CP, coef. HE, preços, cidades." badge="Fase 2" />
        <PlaceholderCard icon={BarChart3} title="Financeiro" desc="Previsão de receita e cobranças mensais." badge="Fase 2" />
        <PlaceholderCard icon={ClipboardList} title="Expedição" desc="Equipamentos, EPIs e mobilização de veículos." badge="Fase 2" />
        <PlaceholderCard icon={FlaskConical} title="Laboratório" desc="Fila de CPs, ensaios e laudos." badge="Fase 2" />
      </div>
    </>
  );
}
