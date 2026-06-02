-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION: Usar View Pública Segura para servicos_catalogo
-- Objetivo: PostgREST (API do Supabase) possui instabilidade conhecida com
--           column-level GRANTs. A melhor prática recomendada é utilizar uma
--           View pública para expor apenas colunas seguras aos clientes.
-- ══════════════════════════════════════════════════════════════════════

-- 1. Restaurar privilégios padrão na tabela servicos_catalogo para evitar conflitos de schema
GRANT SELECT ON public.servicos_catalogo TO authenticated, anon;

-- 2. Garantir que apenas Admins leem a tabela direta servicos_catalogo (via RLS)
DROP POLICY IF EXISTS "catalogo_read_authenticated" ON public.servicos_catalogo;
DROP POLICY IF EXISTS "catalogo_read_admin_only" ON public.servicos_catalogo;

CREATE POLICY "catalogo_read_admin_only" ON public.servicos_catalogo
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Recriar a View pública com TODOS os campos necessários pelo frontend (incluindo equipamentos_inclusos)
--    mas OMITINDO o campo sensível valor_custo_base
CREATE OR REPLACE VIEW public.servicos_catalogo_pub AS
  SELECT
    id,
    sku,
    nome_servico,
    unidade,
    valor_venda_editavel,
    equipamentos_inclusos, -- Adicionado para o wizard de novo agendamento
    categoria,
    ativo,
    created_at
  FROM public.servicos_catalogo;

-- 4. Conceder permissão de leitura da View para todos os usuários
GRANT SELECT ON public.servicos_catalogo_pub TO authenticated, anon;
