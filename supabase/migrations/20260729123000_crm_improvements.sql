-- ══════════════════════════════════════════════════════════════════════
-- MÓDULO CRM: OTIMIZAÇÃO DE RLS E CORREÇÃO DE EXCLUSÃO DE FUNIS
-- ══════════════════════════════════════════════════════════════════════

-- 1. Otimização de RLS na tabela crm_pipelines
DROP POLICY IF EXISTS "Empresas acessam apenas seus pipelines" ON public.crm_pipelines;
CREATE POLICY "Empresas acessam apenas seus pipelines" ON public.crm_pipelines
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid())
  );

-- 2. Otimização de RLS na tabela crm_pipeline_etapas
DROP POLICY IF EXISTS "Empresas acessam apenas etapas de seus pipelines" ON public.crm_pipeline_etapas;
CREATE POLICY "Empresas acessam apenas etapas de seus pipelines" ON public.crm_pipeline_etapas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_pipelines cp
      WHERE cp.id = crm_pipeline_etapas.pipeline_id
        AND cp.empresa_id = public.get_user_empresa_id(auth.uid())
    )
  );

-- 3. Otimização de RLS na tabela crm_oportunidades
DROP POLICY IF EXISTS "Empresas acessam apenas suas oportunidades" ON public.crm_oportunidades;
CREATE POLICY "Empresas acessam apenas suas oportunidades" ON public.crm_oportunidades
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid())
  );

-- 4. Remoção do trigger que impede exclusão em cascata de pipelines
DROP TRIGGER IF EXISTS tg_check_min_pipeline_stages ON public.crm_pipeline_etapas;
DROP FUNCTION IF EXISTS public.check_min_pipeline_stages();
