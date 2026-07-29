-- ══════════════════════════════════════════════════════════════════════
-- MÓDULO CRM: PERMISSÃO DE ACESSO PARA ADMINISTRADORES GLOBAIS (ADMIN)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Permissão de RLS na tabela crm_pipelines para Admins
DROP POLICY IF EXISTS "Empresas acessam apenas seus pipelines" ON public.crm_pipelines;
CREATE POLICY "Empresas acessam apenas seus pipelines" ON public.crm_pipelines
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 2. Permissão de RLS na tabela crm_pipeline_etapas para Admins
DROP POLICY IF EXISTS "Empresas acessam apenas etapas de seus pipelines" ON public.crm_pipeline_etapas;
CREATE POLICY "Empresas acessam apenas etapas de seus pipelines" ON public.crm_pipeline_etapas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_pipelines cp
      WHERE cp.id = crm_pipeline_etapas.pipeline_id
        AND (cp.empresa_id = public.get_user_empresa_id(auth.uid()) OR
             EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    )
  );

-- 3. Permissão de RLS na tabela crm_oportunidades para Admins
DROP POLICY IF EXISTS "Empresas acessam apenas suas oportunidades" ON public.crm_oportunidades;
CREATE POLICY "Empresas acessam apenas suas oportunidades" ON public.crm_oportunidades
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
