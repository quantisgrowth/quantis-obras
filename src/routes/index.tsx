import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { 
  HardHat, 
  FlaskConical, 
  ShieldCheck, 
  Truck, 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  CalendarRange, 
  TrendingUp, 
  FileText, 
  Check, 
  ArrowRight,
  ShieldAlert
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quantis Obras — Controle Tecnológico" },
      { name: "description", content: "Agende ensaios e moldagens com técnicos certificados em sua obra de forma rápida e eficiente." },
    ],
  }),
  component: Index,
});

type ICPKey = "gestor_obra" | "tecnico" | "gestor_empresa";

function Index() {
  const [activeTab, setActiveTab] = useState<ICPKey>("gestor_obra");

  const icpData = {
    gestor_obra: {
      title: "Gestor da Obra",
      subtitle: "Controle total sobre a concretagem e qualidade na ponta dos dedos.",
      icon: HardHat,
      pains: [
        "Falta de visibilidade em tempo real sobre a chegada do técnico na obra.",
        "Relatórios de ruptura atrasados ou perdidos em conversas de WhatsApp.",
        "Dificuldade para rastrear se as amostras foram moldadas conforme as normas."
      ],
      solutions: [
        "Calendário de moldagens compartilhado e atualizado em tempo real.",
        "Acesso imediato a laudos de ruptura digitais e rastreabilidade ponta a ponta.",
        "Validação digital diária dos ensaios executados na obra."
      ]
    },
    tecnico: {
      title: "Técnico de Campo",
      subtitle: "Registro de dados ágil, preciso e sem papelada física.",
      icon: Truck,
      pains: [
        "Excesso de papelada para preencher manualmente debaixo de sol ou chuva.",
        "Retrabalho ao fim do dia digitando dados de campo na plataforma do laboratório.",
        "Dificuldade em comprovar horários exatos de início e fim da moldagem."
      ],
      solutions: [
        "Aplicativo de campo otimizado para registro rápido de coletas no celular.",
        "Cronômetro digital integrado para controle exato dos tempos de ensaio.",
        "Check-in e check-out validados por geolocalização (GPS) e fotos do ciclo."
      ]
    },
    gestor_empresa: {
      title: "Gestor do Controle Tecnológico",
      subtitle: "Visão estratégica, eficiência logística e conformidade automatizada.",
      icon: ShieldCheck,
      pains: [
        "Tempo excessivo organizando rotas e escalas de técnicos manualmente.",
        "Falta de controle em tempo real sobre desvios de slump test e atrasos de técnicos.",
        "Processo de faturamento manual demorado e sujeito a glosas de faturas."
      ],
      solutions: [
        "Dashboard ao vivo para monitoramento de equipes, escalas e rotas ativas.",
        "Alertas automatizados de inconformidades e desvios de ensaios na hora.",
        "Faturamento ágil com histórico consolidado de ensaios e obras por cliente."
      ]
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground">Quantis Obras</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-primary)" }}
      >
        {/* Subtle background decoration elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        
        <div className="container mx-auto px-4 py-24 md:py-32 relative z-10">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground backdrop-blur-md">
              Controle tecnológico
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-primary-foreground md:text-6xl lg:text-7xl leading-tight">
              Agende ensaios e moldagens com poucos cliques.
            </h1>
            <p className="mt-6 max-w-2xl text-lg md:text-xl text-primary-foreground/85 font-light leading-relaxed">
              Técnicos certificados, logística personalizada por obra, validação digital — mais rápido e eficiente.
            </p>
          </div>
        </div>
      </section>

      {/* Overview Personas Section */}
      <section className="container mx-auto grid gap-6 px-4 py-16 md:grid-cols-3 -mt-8 relative z-20">
        {[
          { icon: HardHat, title: "Para o Gestor da Obra", desc: "Calendário, checkout transparente e validação diária." },
          { icon: Truck, title: "Para o Técnico", desc: "Convite com cronômetro, check-in por GPS e foto por ciclo." },
          { icon: ShieldCheck, title: "Para o Gestor", desc: "Dashboard ao vivo, alerta de escala e regras editáveis." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-card-foreground">{title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>

      {/* ICP Pain Points & Solutions (Tabbed) */}
      <section className="bg-card/40 border-y border-border py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Dores que solucionamos por perfil
            </h2>
            <p className="mt-4 text-muted-foreground">
              Entendemos os desafios do canteiro de obras e do laboratório. Veja como a plataforma simplifica a vida de cada envolvido.
            </p>
          </div>

          {/* Custom Tabs Navigation */}
          <div className="flex flex-col md:flex-row justify-center gap-2 max-w-3xl mx-auto p-1.5 bg-muted/65 rounded-xl border border-border/80 mb-12">
            {(Object.keys(icpData) as ICPKey[]).map((key) => {
              const item = icpData[key];
              const Icon = item.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 w-full md:w-auto cursor-pointer ${
                    isActive
                      ? "bg-card text-foreground shadow-[var(--shadow-soft)] border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/30"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  {item.title}
                </button>
              );
            })}
          </div>

          {/* Active Tab Details */}
          <div className="max-w-5xl mx-auto bg-card rounded-2xl border border-border p-8 md:p-12 shadow-[var(--shadow-elegant)] transition-all duration-300">
            <div className="grid gap-8 md:grid-cols-2">
              {/* Left Column: Title and Pains */}
              <div className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-wider">
                    {icpData[activeTab].title}
                  </span>
                  <h3 className="text-2xl font-bold mt-3 text-foreground leading-tight">
                    {icpData[activeTab].subtitle}
                  </h3>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                    Como era antes (Dores comuns)
                  </h4>
                  <ul className="space-y-3.5">
                    {icpData[activeTab].pains.map((pain, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <AlertCircle className="h-5 w-5 text-destructive/80 shrink-0 mt-0.5" />
                        <span>{pain}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right Column: Solutions / Benefits */}
              <div className="bg-muted/30 border border-border/80 rounded-xl p-6 md:p-8 space-y-6 flex flex-col justify-center">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Como a Quantis Obras resolve
                </h4>
                <ul className="space-y-4 flex-1">
                  {icpData[activeTab].solutions.map((sol, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success shrink-0 mt-0.5">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="font-medium">{sol}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Authority & Highlights Section */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl leading-tight">
              Aumente a credibilidade e a eficiência de suas coletas tecnológicas
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              O controle tecnológico de concreto e solos exige precisão e transparência. A Quantis Obras conecta escritórios, técnicos em campo e laboratórios em uma única malha de dados, reduzindo falhas e gerando confiança imediata para as construtoras parceiras.
            </p>

            <div className="grid gap-6 sm:grid-cols-2 pt-4">
              <div className="flex gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Rastreabilidade GPS</h4>
                  <p className="text-xs text-muted-foreground mt-1">Check-in de técnicos validado geograficamente diretamente da obra.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <CalendarRange className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Escala Inteligente</h4>
                  <p className="text-xs text-muted-foreground mt-1">Organização de coletas e equipe técnica baseada em localização.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Relatórios Ágeis</h4>
                  <p className="text-xs text-muted-foreground mt-1">Gráficos de evolução e emissão de laudos de ruptura imediatos.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Adeus ao Retrabalho</h4>
                  <p className="text-xs text-muted-foreground mt-1">Fim dos dados anotados em papelada física que se perde na obra.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Presentation Graphic */}
          <div className="relative bg-gradient-to-tr from-primary to-primary/80 rounded-3xl p-8 md:p-12 text-primary-foreground shadow-[var(--shadow-elegant)] overflow-hidden aspect-[4/3] flex flex-col justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_60%)]" />
            <div className="flex justify-between items-start relative z-10">
              <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2 backdrop-blur-md">
                <span className="text-xs font-bold tracking-wider uppercase">Plataforma Homologada</span>
              </div>
              <FlaskConical className="h-10 w-10 opacity-70 animate-pulse" />
            </div>
            
            <div className="space-y-4 relative z-10">
              <p className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
                Gestão simplificada e dados em tempo real para todo o ecossistema da construção.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="h-1 w-16 bg-white rounded-full" />
                <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Quantis Obras</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12 text-center text-sm text-muted-foreground bg-card/30">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} Quantis Obras - Levando gestão para o Brasil todo</p>
        </div>
      </footer>
    </div>
  );
}
