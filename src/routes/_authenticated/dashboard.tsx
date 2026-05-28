import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, ClipboardList, Users, Settings, MapPin, Camera, Bell, BarChart3, Clock, CheckCircle2, FlaskConical, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Geraltest Brasil" }] }),
  component: Dashboard,
});

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

function ClienteDash({ email, userId }: { email: string; userId: string }) {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <SectionTitle title="Olá!" subtitle={`Conectado como ${email}. Comece agendando uma medição.`} />
      
      {/* Quick Action Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/novo-agendamento" className="block group">
          <Card className="transition-all group-hover:shadow-[var(--shadow-elegant)] group-hover:border-primary border border-border bg-card h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <CalendarPlus className="h-5 w-5" />
                </div>
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">Disponível</Badge>
              </div>
              <CardTitle className="mt-3 text-base">Novo agendamento</CardTitle>
              <CardDescription>Wizard com motor de orçamento e geolocalização por satélite.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-primary font-semibold group-hover:underline">Iniciar agendamento agora →</p>
            </CardContent>
          </Card>
        </Link>
        <PlaceholderCard icon={ClipboardList} title="Medições pendentes" desc="Validações abertas no fim do dia de obra." badge="Fase 2" />
        <PlaceholderCard icon={BarChart3} title="Histórico e crédito" desc="Serviços concluídos por CNPJ e travas de boleto." badge="Fase 2" />
      </div>

      {/* Real Bookings List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          Seus Agendamentos Recentes
        </h2>

        {loading ? (
          <div className="text-sm text-muted-foreground py-4">Carregando agendamentos…</div>
        ) : agendamentos.length === 0 ? (
          <Card className="border border-dashed border-border py-8 text-center bg-muted/10">
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">Você ainda não tem nenhum agendamento registrado.</p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link to="/novo-agendamento">Fazer Meu Primeiro Agendamento</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {agendamentos.map((ag) => {
              const statusColors: Record<string, string> = {
                Pendente_Tecnico: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                Confirmado: "bg-blue-500/10 text-blue-600 border-blue-500/20",
                Em_Execucao: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
                Validado: "bg-green-500/10 text-green-600 border-green-500/20",
                Cancelado: "bg-red-500/10 text-red-600 border-red-500/20",
              };

              const formattedStatus: Record<string, string> = {
                Pendente_Tecnico: "Aguardando Técnico",
                Confirmado: "Confirmado",
                Em_Execucao: "Em Execução",
                Validado: "Concluído & Validado",
                Cancelado: "Cancelado",
              };

              return (
                <Card key={ag.id} className="border border-border bg-card p-4 transition-all hover:border-muted-foreground/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{ag.codigo_pedido}</span>
                        <Badge variant="outline" className={statusColors[ag.status_agendamento] || "bg-muted text-muted-foreground"}>
                          {formattedStatus[ag.status_agendamento] || ag.status_agendamento}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {ag.servico?.nome_servico || "Controle Tecnológico"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Obra: <span className="text-foreground font-medium">{ag.obra?.nome_obra || "Não identificada"}</span> · {ag.obra?.endereco}
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ag.data_servico).toLocaleDateString("pt-BR")} às {ag.horario_na_obra.substring(0, 5)}
                      </div>
                      <div className="text-sm font-extrabold text-primary mt-1">
                        R$ {ag.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {ag.cps_contratados} CPs · {ag.forma_pagamento}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TecnicoDash() {
  return (
    <>
      <SectionTitle title="Painel do Técnico" subtitle="Convites, check-ins e ciclos de moldagem." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlaceholderCard icon={Bell} title="Convites de serviço" desc="Cronômetro regressivo de 60 minutos." badge="Fase 3" />
        <PlaceholderCard icon={MapPin} title="Check-in obra (GPS)" desc="Liberado quando o GPS bater com o raio do endereço." badge="Fase 3" />
        <PlaceholderCard icon={Camera} title="Foto por ciclo" desc="Anexo a cada 2 CPs moldados, em tempo real." badge="Fase 3" />
      </div>
    </>
  );
}

function AdminDash() {
  return (
    <>
      <SectionTitle title="Painel do Gestor" subtitle="Visão macro de ensaios, escala e configurações." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlaceholderCard icon={Users} title="Técnicos em campo" desc="Grid com alocações do dia e status." badge="Fase 4" />
        <PlaceholderCard icon={Bell} title="Alertas de escala" desc="Risco de banco de horas e descanso 11h." badge="Fase 4" />
        <PlaceholderCard icon={Settings} title="Configurações globais" desc="Eficiência CP, coef. HE, preços, cidades." badge="Fase 4" />
      </div>
    </>
  );
}