import { createFileRoute } from "@tanstack/react-router";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, ClipboardList, Users, Settings, MapPin, Camera, Bell, BarChart3, type LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Geraltest Brasil" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { roles, user } = useAuth();
  const role = primaryRole(roles);
  if (role === "admin") return <AdminDash />;
  if (role === "tecnico") return <TecnicoDash />;
  return <ClienteDash email={user?.email ?? ""} />;
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
    <Card className="transition-shadow hover:shadow-[var(--shadow-elegant)]">
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

function ClienteDash({ email }: { email: string }) {
  return (
    <>
      <SectionTitle title="Olá!" subtitle={`Conectado como ${email}. Comece agendando uma medição.`} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlaceholderCard icon={CalendarPlus} title="Novo agendamento" desc="Wizard com motor de orçamento e checkout transparente." badge="Fase 2" />
        <PlaceholderCard icon={ClipboardList} title="Medições pendentes" desc="Validações abertas no fim do dia de obra." badge="Fase 2" />
        <PlaceholderCard icon={BarChart3} title="Histórico e crédito" desc="Serviços concluídos por CNPJ e travas de boleto." badge="Fase 2" />
      </div>
    </>
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