import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

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
  cliente_empresa_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  obra_id: z.string().uuid().nullable().optional(),
});

const LeadSchema = z.object({
  id: z.string().uuid().optional(),
  empresa_cliente_id: z.string().uuid().nullable().optional(),
  nome: z.string().min(1).max(255),
  email: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  ticket_medio: z.number().default(0),
  total_compras: z.number().default(0),
  compras_count: z.number().int().default(0),
  ciclo_compra_dias: z.number().int().default(0),
  ultima_compra_dias: z.number().int().default(0),
});

const UpdateOpportunityStageSchema = z.object({
  oportunidadeId: z.string().uuid(),
  etapaId: z.string().uuid(),
  posicaoEtapa: z.number().int(),
});

// Helper to get company ID for the authenticated user
async function getEmpresaId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .single();

  if (profile?.empresa_id) {
    return profile.empresa_id;
  }

  // Fallback for admin users who do not belong to a single client company
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (roleData) {
    const { data: firstCompany } = await supabase
      .from("empresas_clientes")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (firstCompany) {
      return firstCompany.id;
    }
  }

  throw new Error("Usuário não está associado a nenhuma empresa.");
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
  .handler(async ({ data: input, context }) => {
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
  .handler(async ({ data: input, context }) => {
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
  .handler(async ({ data: input, context }) => {
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
  .handler(async ({ data: pipelineId, context }) => {
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
  .handler(async ({ data: input, context }) => {
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
      id: s.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      })),
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
  .handler(async ({ data: pipelineId, context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("crm_oportunidades")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("posicao_etapa", { ascending: true });

    if (error) throw new Error("Erro ao buscar oportunidades: " + error.message);
    return data;
  });

// Helper to trigger automated onboarding for a lead
async function triggerOnboardingForLead(supabase: any, leadId: string) {
  try {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("nome, email, telefone, empresa_cliente_id")
      .eq("id", leadId)
      .single();

    if (lead && lead.email && lead.empresa_cliente_id) {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

      if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
        console.warn("Supabase credentials missing on server. Skipping onboarding.");
        return;
      }

      const tempSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const generatedPassword = `Quantis@${randomSuffix}`;

      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: lead.email.trim().toLowerCase(),
        password: generatedPassword,
        options: {
          data: {
            nome_completo: lead.nome.trim(),
            telefone: lead.telefone?.trim() || null,
            empresa_id: lead.empresa_cliente_id,
            sub_role: "master",
            permissoes: ["pedidos", "obras", "dashboard", "financeiro", "equipe"]
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered") || signUpError.status === 422) {
          return { success: false, reason: "already_registered" };
        }
        console.error("Erro no onboarding automático:", signUpError.message);
        return;
      }

      if (signUpData?.user) {
        const whatsText = `Olá! Bem-vindo(a) à plataforma *Quantis Obras*.\n\nSeu cadastro foi concluído com sucesso. Suas credenciais de acesso são:\n📧 *E-mail:* ${lead.email.trim().toLowerCase()}\n🔑 *Senha:* ${generatedPassword}\n\nVocê já pode acessar o sistema e acompanhar seus pedidos em:\nhttps://quantis-obras.vercel.app/login`;
        
        if (lead.telefone) {
          const cleanPhone = lead.telefone.replace(/\D/g, "");
          if (cleanPhone) {
            const apiUrl = process.env.EVOLUTION_API_URL;
            const apiToken = process.env.EVOLUTION_API_TOKEN;
            const instanceName = process.env.EVOLUTION_INSTANCE_NAME;
            
            if (apiUrl && apiToken && instanceName) {
              let cleanNumber = cleanPhone;
              if (cleanNumber.length === 11 || cleanNumber.length === 10) {
                cleanNumber = "55" + cleanNumber;
              }
              const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${instanceName}`;
              await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: apiToken },
                body: JSON.stringify({ number: cleanNumber, text: whatsText, delay: 1200 }),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro na rotina de onboarding:", err);
  }
}

// 8. Create or Update an opportunity
export const saveOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OpportunitySchema.parse(input))
  .handler(async ({ data: input, context }) => {
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
    
    // Disparar onboarding automático se houver um lead vinculado
    if (data.lead_id) {
      triggerOnboardingForLead(supabase, data.lead_id);
    }

    return data;
  });

// 9. Drag and Drop: Update Opportunity Stage/Position
export const updateOportunidadeStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateOpportunityStageSchema.parse(input))
  .handler(async ({ data: input, context }) => {
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
  .handler(async ({ data: input, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("crm_oportunidades")
      .delete()
      .eq("id", input.id);

    if (error) throw new Error("Erro ao excluir oportunidade: " + error.message);
    return { success: true };
  });

// 11. Get all leads for the user's company
export const getLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);

    const { data, error } = await supabase
      .from("crm_leads")
      .select("*, empresa_cliente:empresas_clientes!empresa_cliente_id(id, razao_social)")
      .eq("empresa_id", empresaId)
      .order("nome", { ascending: true });

    if (error) throw new Error("Erro ao buscar leads: " + error.message);
    return data;
  });

// 12. Create or Update a lead
export const saveLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LeadSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);

    const leadData = {
      ...input,
      empresa_id: empresaId,
    };

    const { data, error } = await supabase
      .from("crm_leads")
      .upsert(leadData)
      .select()
      .single();

    if (error) throw new Error("Erro ao salvar lead: " + error.message);

    // Disparar onboarding automático se houver e-mail e empresa cliente vinculada
    if (data.email && data.empresa_cliente_id) {
      triggerOnboardingForLead(supabase, data.id);
    }

    return data;
  });

// 13. Delete a lead
export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("crm_leads")
      .delete()
      .eq("id", input.id);

    if (error) throw new Error("Erro ao excluir lead: " + error.message);
    return { success: true };
  });

// 14. Get all companies for dropdown selection
export const getCompaniesForSelect = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("empresas_clientes")
      .select("id, razao_social, cnpj")
      .order("razao_social", { ascending: true });

    if (error) throw new Error("Erro ao buscar empresas: " + error.message);
    return data;
  });

// 15. Get all works (obras) for dropdown selection
export const getObrasForSelect = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("obras")
      .select("id, nome_obra, empresa_id, cidade")
      .order("nome_obra", { ascending: true });

    if (error) throw new Error("Erro ao buscar obras: " + error.message);
    return data;
  });

// 16. Save leads in batch (for import)
export const saveLeadsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.array(LeadSchema).parse(input))
  .handler(async ({ data: inputList, context }) => {
    const { supabase, userId } = context;
    const empresaId = await getEmpresaId(supabase, userId);

    const leadsData = inputList.map((lead) => ({
      ...lead,
      empresa_id: empresaId,
    }));

    const { data, error } = await supabase
      .from("crm_leads")
      .upsert(leadsData)
      .select();

    if (error) throw new Error("Erro ao salvar lote de leads: " + error.message);
    return data;
  });

// 17. Get lead import template from app_settings
export const getLeadsTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "crm_leads_template")
      .maybeSingle();

    if (error) throw new Error("Erro ao buscar template de leads: " + error.message);
    return data?.value || null;
  });

// 18. Save lead import template to app_settings
export const saveLeadsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    fileName: z.string(),
    contentType: z.string(),
    base64Data: z.string(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "crm_leads_template",
        value: input,
        descricao: "Template oficial de importação de Leads (CRM)"
      });

    if (error) throw new Error("Erro ao salvar template de leads: " + error.message);
    return { success: true };
  });

// 19. Onboard client user (automated registration and WhatsApp message)
export const onboardClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    email: z.string().email(),
    nome: z.string(),
    telefone: z.string().nullable().optional(),
    empresaClienteId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data: input }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Credenciais do Supabase não configuradas no servidor.");
    }

    const tempSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Gerar uma senha aleatória segura
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const generatedPassword = `Quantis@${randomSuffix}`;

    const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: generatedPassword,
      options: {
        data: {
          nome_completo: input.nome.trim(),
          telefone: input.telefone?.trim() || null,
          empresa_id: input.empresaClienteId,
          sub_role: "master",
          permissoes: ["pedidos", "obras", "dashboard", "financeiro", "equipe"]
        }
      }
    });

    if (signUpError) {
      // Se já estiver cadastrado, ignoramos o erro silenciosamente
      if (signUpError.message.includes("already registered") || signUpError.status === 422) {
        return { success: false, reason: "already_registered" };
      }
      throw new Error(`Erro ao criar acesso: ${signUpError.message}`);
    }

    // Se o usuário foi criado, enviar mensagem de WhatsApp
    if (signUpData?.user) {
      const whatsText = `Olá! Bem-vindo(a) à plataforma *Quantis Obras*.\n\nSeu cadastro foi concluído com sucesso. Suas credenciais de acesso são:\n📧 *E-mail:* ${input.email.trim().toLowerCase()}\n🔑 *Senha:* ${generatedPassword}\n\nVocê já pode acessar o sistema e acompanhar seus pedidos em:\nhttps://quantis-obras.vercel.app/login`;
      
      let sentWhats = false;
      if (input.telefone) {
        try {
          const cleanPhone = input.telefone.replace(/\D/g, "");
          if (cleanPhone) {
            const apiUrl = process.env.EVOLUTION_API_URL;
            const apiToken = process.env.EVOLUTION_API_TOKEN;
            const instanceName = process.env.EVOLUTION_INSTANCE_NAME;
            
            if (apiUrl && apiToken && instanceName) {
              let cleanNumber = cleanPhone;
              if (cleanNumber.length === 11 || cleanNumber.length === 10) {
                cleanNumber = "55" + cleanNumber;
              }
              const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${instanceName}`;
              await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: apiToken },
                body: JSON.stringify({ number: cleanNumber, text: whatsText, delay: 1200 }),
              });
              sentWhats = true;
            }
          }
        } catch (e) {
          console.error("Erro ao enviar boas-vindas por WhatsApp:", e);
        }
      }

      return {
        success: true,
        email: input.email.trim().toLowerCase(),
        password: generatedPassword,
        sentWhats
      };
    }

    return { success: false, reason: "no_user_created" };
  });

