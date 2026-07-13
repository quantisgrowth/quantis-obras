import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Zod Schemas
const PipelineSchema = z.object({
  nome: z.string().min(1).max(100),
});

const StageSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(100),
  posicao: z.number().int().nonnegative(),
});

const SaveStagesSchema = z.object({
  pipelineId: z.string().uuid(),
  stages: z.array(StageSchema),
});

const OpportunitySchema = z.object({
  id: z.string().uuid().optional(),
  pipeline_id: z.string().uuid(),
  etapa_id: z.string().uuid(),
  nome_oportunidade: z.string().min(1).max(255),
  valor_estimado: z.number().nonnegative(),
  cliente_contato_nome: z.string().nullable().optional(),
  cliente_contato_email: z.string().nullable().optional(),
  cliente_contato_telefone: z.string().nullable().optional(),
  status: z.enum(["Aberta", "Ganha", "Perdida"]).default("Aberta"),
  posicao_etapa: z.number().int().default(0),
});

const UpdateOpportunityStageSchema = z.object({
  oportunidadeId: z.string().uuid(),
  etapaId: z.string().uuid(),
  posicaoEtapa: z.number().int(),
});

// Helper to get company ID for the authenticated user
async function getEmpresaId(supabase: any, userId: string): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .single();

  if (error || !profile?.empresa_id) {
    throw new Error("Usuário não está associado a nenhuma empresa.");
  }
  return profile.empresa_id;
}

// ── SERVER FUNCTIONS ────────────────────────────────────────────────────────

// 1. Get all pipelines for the user's company
export const getPipelines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);

    const { data, error } = await supabase
      .from("crm_pipelines")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true });

    if (error) throw new Error("Erro ao buscar pipelines: " + error.message);
    return data;
  });

// 2. Create a new pipeline with 2 default stages
export const createPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PipelineSchema.parse(input))
  .handler(async ({ input, context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);

    // Insert pipeline
    const { data: pipeline, error: pipelineErr } = await supabase
      .from("crm_pipelines")
      .insert({
        empresa_id: empresaId,
        nome: input.nome,
      })
      .select("id")
      .single();

    if (pipelineErr) throw new Error("Erro ao criar pipeline: " + pipelineErr.message);

    // Insert default stages: "Sem Contato" and "Contato Realizado"
    const defaultStages = [
      { pipeline_id: pipeline.id, nome: "Sem Contato", posicao: 0 },
      { pipeline_id: pipeline.id, nome: "Contato Realizado", posicao: 1 },
    ];

    const { error: stagesErr } = await supabase
      .from("crm_pipeline_etapas")
      .insert(defaultStages);

    if (stagesErr) {
      // Clean up pipeline if stage creation failed
      await supabase.from("crm_pipelines").delete().eq("id", pipeline.id);
      throw new Error("Erro ao criar etapas padrão do pipeline: " + stagesErr.message);
    }

    return pipeline;
  });

// 3. Update pipeline name
export const updatePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), nome: z.string().min(1) }).parse(input))
  .handler(async ({ input, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("crm_pipelines")
      .update({ nome: input.nome })
      .eq("id", input.id);

    if (error) throw new Error("Erro ao atualizar pipeline: " + error.message);
    return { success: true };
  });

// 4. Delete a pipeline
export const deletePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ input, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("crm_pipelines")
      .delete()
      .eq("id", input.id);

    if (error) throw new Error("Erro ao excluir pipeline: " + error.message);
    return { success: true };
  });

// 5. Get stages for a specific pipeline
export const getPipelineStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.string().uuid().parse(input))
  .handler(async ({ input: pipelineId, context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("crm_pipeline_etapas")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("posicao", { ascending: true });

    if (error) throw new Error("Erro ao buscar etapas: " + error.message);
    return data;
  });

// 6. Save stages (Insert, Update, Delete in batch)
export const savePipelineStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveStagesSchema.parse(input))
  .handler(async ({ input, context }) => {
    const { supabase } = context;
    const { pipelineId, stages } = input;

    // Load existing stages to determine deletions
    const { data: existing, error: getErr } = await supabase
      .from("crm_pipeline_etapas")
      .select("id")
      .eq("pipeline_id", pipelineId);

    if (getErr) throw new Error("Erro ao carregar etapas existentes: " + getErr.message);

    const existingIds = existing.map((s: any) => s.id);
    const incomingIds = stages.filter((s) => s.id).map((s) => s.id as string);
    const toDelete = existingIds.filter((id: string) => !incomingIds.includes(id));

    // Validations: Pipeline must end up with 2 to 15 stages
    const finalStageCount = stages.length;
    if (finalStageCount < 2 || finalStageCount > 15) {
      throw new Error("Um pipeline deve conter de 2 a 15 etapas.");
    }

    // Perform deletions first
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("crm_pipeline_etapas")
        .delete()
        .in("id", toDelete);

      if (delErr) {
        if (delErr.code === "23503") {
          throw new Error("Não é possível excluir etapas que ainda contêm oportunidades ativas. Mova as oportunidades primeiro.");
        }
        throw new Error("Erro ao remover etapas antigas: " + delErr.message);
      }
    }

    // Upsert remaining stages
    const stagesToUpsert = stages.map((s) => ({
      id: s.id || undefined,
      pipeline_id: pipelineId,
      nome: s.nome,
      posicao: s.posicao,
    }));

    const { error: upsertErr } = await supabase
      .from("crm_pipeline_etapas")
      .upsert(stagesToUpsert);

    if (upsertErr) {
      throw new Error("Erro ao salvar as etapas do pipeline: " + upsertErr.message);
    }

    return { success: true };
  });

// 7. Get opportunities for a specific pipeline
export const getOportunidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.string().uuid().parse(input))
  .handler(async ({ input: pipelineId, context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("crm_oportunidades")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("posicao_etapa", { ascending: true });

    if (error) throw new Error("Erro ao buscar oportunidades: " + error.message);
    return data;
  });

// 8. Create or Update an opportunity
export const saveOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OpportunitySchema.parse(input))
  .handler(async ({ input, context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);

    const opportunityData = {
      ...input,
      empresa_id: empresaId,
    };

    const { data, error } = await supabase
      .from("crm_oportunidades")
      .upsert(opportunityData)
      .select()
      .single();

    if (error) throw new Error("Erro ao salvar oportunidade: " + error.message);
    return data;
  });

// 9. Drag and Drop: Update Opportunity Stage/Position
export const updateOportunidadeStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateOpportunityStageSchema.parse(input))
  .handler(async ({ input, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("crm_oportunidades")
      .update({
        etapa_id: input.etapaId,
        posicao_etapa: input.posicaoEtapa,
      })
      .eq("id", input.oportunidadeId);

    if (error) throw new Error("Erro ao mover oportunidade: " + error.message);
    return { success: true };
  });

// 10. Delete an opportunity
export const deleteOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ input, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("crm_oportunidades")
      .delete()
      .eq("id", input.id);

    if (error) throw new Error("Erro ao excluir oportunidade: " + error.message);
    return { success: true };
  });
