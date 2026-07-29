import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/modules/crm/components/KanbanBoard";
import { PipelineSettings } from "@/modules/crm/components/PipelineSettings";
import { LeadsManager } from "@/modules/crm/components/LeadsManager";
import { Sparkles } from "lucide-react";

type CRMSearch = {
  tab?: string;
};

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — Quantis Obras" }] }),
  validateSearch: (search: Record<string, unknown>): CRMSearch => {
    return {
      tab: search.tab as string | undefined,
    };
  },
  component: CRMPage,
});

function CRMPage() {
  const { tab } = Route.useSearch();
  const activeTab = tab || "kanban";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          {activeTab === "kanban" && "Funil de Vendas"}
          {activeTab === "leads" && "Contatos (Leads)"}
          {activeTab === "settings" && "Configurações de Funil"}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Módulo Novo
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeTab === "kanban" && "Gerencie suas oportunidades comerciais e organize seus pipelines de vendas."}
          {activeTab === "leads" && "Gerencie e organize os contatos das suas empresas clientes."}
          {activeTab === "settings" && "Personalize e gerencie as etapas dos seus funis de vendas."}
        </p>
      </div>

      {/* Component Render based on activeTab */}
      <div className="space-y-4">
        {activeTab === "kanban" && <KanbanBoard />}
        {activeTab === "leads" && <LeadsManager />}
        {activeTab === "settings" && <PipelineSettings />}
      </div>
    </div>
  );
}
