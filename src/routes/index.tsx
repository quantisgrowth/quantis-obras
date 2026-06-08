import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { HardHat, FlaskConical, ShieldCheck, Truck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quantis Obras — Controle Tecnológico de Materiais" },
      { name: "description", content: "Agende ensaios e moldagens com técnicos certificados em Sorocaba, Votorantim, Itu e região." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground">Quantis Obras</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
            <Button asChild><Link to="/signup">Criar conta</Link></Button>
          </nav>
        </div>
      </header>

      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground backdrop-blur">
              Controle tecnológico de materiais
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-primary-foreground md:text-6xl">
              Agende ensaios e moldagens com 1 clique.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-primary-foreground/85">
              Técnicos certificados, logística calculada por cidade, validação digital e
              memória de cálculo transparente — sem trocar dezenas de mensagens.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary"><Link to="/signup">Começar agora</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                <Link to="/login">Já tenho conta</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-4 py-16 md:grid-cols-3">
        {[
          { icon: HardHat, title: "Para o Engenheiro", desc: "Calendário, checkout transparente e validação diária." },
          { icon: Truck, title: "Para o Técnico", desc: "Convite com cronômetro, check-in por GPS e foto por ciclo." },
          { icon: ShieldCheck, title: "Para o Gestor", desc: "Dashboard ao vivo, alerta de escala e regras editáveis." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-card-foreground">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Quantis Obras. Sorocaba · Votorantim · Itu · Salto · Boituva.
      </footer>
    </div>
  );
}
