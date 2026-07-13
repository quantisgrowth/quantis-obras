import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "@/modules/crm/components/KanbanBoard";
import { PipelineSettings } from "@/modules/crm/components/PipelineSettings";
import { LayoutGrid, Settings2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — Quantis Obras" }] }),
  component: CRMPage,
});

function CRMPage() {
  const [activeTab, setActiveTab] = useState("kanban");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          CRM & Propostas
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Módulo Novo
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas oportunidades comerciais e organize seus pipelines de vendas.
        </p>
      </div>

      {/* Tabs Switcher */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1 border">
          <TabsTrigger value="kanban" className="gap-1.5 h-8">
            <LayoutGrid className="h-4 w-4" />
            Funil de Vendas
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 h-8">
            <Settings2 className="h-4 w-4" />
            Configurações de Funil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-4 focus-visible:outline-none">
          <KanbanBoard />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 focus-visible:outline-none">
          <PipelineSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
