-- ══════════════════════════════════════════════════════════════════════
-- MÓDULO CRM: PERMISSÕES DE ACESSO (GRANT) PARA TABELAS DO CRM
-- ══════════════════════════════════════════════════════════════════════

-- Permissões para crm_pipelines
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipelines TO authenticated;
GRANT ALL ON public.crm_pipelines TO service_role;

-- Permissões para crm_pipeline_etapas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipeline_etapas TO authenticated;
GRANT ALL ON public.crm_pipeline_etapas TO service_role;

-- Permissões para crm_oportunidades
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_oportunidades TO authenticated;
GRANT ALL ON public.crm_oportunidades TO service_role;
