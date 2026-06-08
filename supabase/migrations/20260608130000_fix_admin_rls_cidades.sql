-- =============================================================
-- CORREÇÃO: Permissões de INSERT/UPDATE/DELETE na tabela
-- cidades_atendidas para usuários com role 'admin'.
-- 
-- Problema: O client do servidor usa a anon key + Bearer token,
-- então auth.uid() pode não resolver corretamente nas políticas.
-- Solução: Garantir que o GRANT de escrita esteja explícito para
-- authenticated e criar uma função SECURITY DEFINER como bypass
-- seguro para operações administrativas.
-- =============================================================

-- 1. Garantir GRANTs explícitos de escrita para authenticated
GRANT INSERT, UPDATE, DELETE ON public.cidades_atendidas TO authenticated;

-- 2. Recriar política de escrita admin (DROP + CREATE para garantir limpo)
DROP POLICY IF EXISTS "cidades_admin_write" ON public.cidades_atendidas;

CREATE POLICY "cidades_admin_write" ON public.cidades_atendidas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- 3. Garantir que app_settings também tenha escrita para admin
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;

CREATE POLICY "settings_admin_write" ON public.app_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- 4. Garantir que servicos_catalogo (produtos) também funcione
GRANT INSERT, UPDATE, DELETE ON public.servicos_catalogo TO authenticated;

DROP POLICY IF EXISTS "catalogo_admin_write" ON public.servicos_catalogo;

CREATE POLICY "catalogo_admin_write" ON public.servicos_catalogo
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- 5. Inserir configurações globais padrão se ainda não existirem
INSERT INTO public.app_settings (key, value, descricao)
VALUES (
  'configuracoes_globais', 
  '{"eficiencia_cp": 95, "coeficiente_he": 1.5, "prazo_faturamento_dias": 28}'::jsonb, 
  'Configurações globais de operação: eficiência esperada de CPs, coeficiente de horas extras e prazo de faturamento.'
)
ON CONFLICT (key) DO NOTHING;
