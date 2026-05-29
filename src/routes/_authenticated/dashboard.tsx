import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus, ClipboardList, Users, Settings, MapPin, Camera,
  Bell, BarChart3, Clock, FlaskConical, ChevronRight, X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Geraltest Brasil" }] }),
  component: Dashboard,
});

// ── Helpers ────────────────────────────────────────────────────────────────
function Dashboard() {
  const { roles, user } = useAuth();
  const role = primaryRole(roles);
  if (role === "admin") return <AdminDash />;
  if (role === "tecnico") return <TecnicoDash />;
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
          .select("*, obra:obras(*), servico:servicos_catalogo(*)")
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
                      <span className="font-bold text-foreground">{ag.codigo_pedido}</span>
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
                      Obra: <span className="text-foreground font-medium">{ag.obra?.nome_obra || "Não identificada"}</span>
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
function TecnicoDash() {
  return (
    <>
      <SectionTitle title="Painel do Técnico" subtitle="Convites, check-ins e ciclos de moldagem." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlaceholderCard icon={Bell} title="Convites de serviço" desc="Cronômetro regressivo de aceite configurável." badge="Fase 2" />
        <PlaceholderCard icon={MapPin} title="Check-in obra (GPS)" desc="Liberado quando o GPS bater com o raio do endereço." badge="Fase 2" />
        <PlaceholderCard icon={Camera} title="Foto por ciclo" desc="Anexo a cada betonada, em tempo real." badge="Fase 2" />
      </div>
    </>
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
