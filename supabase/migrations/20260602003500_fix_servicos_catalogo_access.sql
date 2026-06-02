-- ══════════════════════════════════════════════════════════════════════
-- FIX: Restaurar acesso dos clientes à tabela servicos_catalogo
-- Problema: a migration security_fix removeu a policy catalogo_read_all
--           e a view servicos_catalogo_pub não bypassa o RLS.
-- Solução: re-adicionar policy de leitura para autenticados + usar
--          column-level GRANT para proteger valor_custo_base.
-- ══════════════════════════════════════════════════════════════════════

-- 1. Re-adicionar política que permite leitura para todos autenticados
--    (somente rows com ativo = true não é necessário em RLS,
--     isso é filtrado na query do frontend)
DROP POLICY IF EXISTS "catalogo_read_admin_only" ON public.servicos_catalogo;

CREATE POLICY "catalogo_read_authenticated" ON public.servicos_catalogo
  FOR SELECT TO authenticated
  USING (true);

-- 2. Proteger o campo interno usando column-level privileges:
--    Revogar SELECT geral e conceder apenas as colunas públicas
REVOKE SELECT ON public.servicos_catalogo FROM authenticated, anon;

GRANT SELECT (
  id,
  sku,
  nome_servico,
  unidade,
  valor_venda_editavel,
  equipamentos_inclusos,
  categoria,
  ativo,
  created_at
) ON public.servicos_catalogo TO authenticated, anon;

-- Admins e service_role continuam com acesso total
GRANT SELECT ON public.servicos_catalogo TO service_role;
