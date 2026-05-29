-- ══════════════════════════════════════════════════════════════════════
-- SECURITY FIX: Proteger dados sensíveis
-- 1. Ocultar valor_custo_base da tabela servicos_catalogo para clientes
-- 2. Ocultar CPF e RG da tabela tecnicos para não-admins
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. SERVICOS_CATALOGO ─────────────────────────────────────────────
-- Criar view pública sem o campo de custo interno
CREATE OR REPLACE VIEW public.servicos_catalogo_pub AS
  SELECT
    id,
    sku,
    nome_servico,
    unidade,
    valor_venda_editavel,
    categoria,
    ativo,
    created_at
    -- valor_custo_base OMITIDO intencionalmente
  FROM public.servicos_catalogo;

GRANT SELECT ON public.servicos_catalogo_pub TO authenticated, anon;

-- Remover política permissiva atual e restringir leitura direta
DROP POLICY IF EXISTS "catalogo_read_all" ON public.servicos_catalogo;

-- Clientes e técnicos leem apenas a view (sem custo)
-- Admins e service_role continuam acessando a tabela completa
CREATE POLICY "catalogo_read_admin_only" ON public.servicos_catalogo
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── 2. TECNICOS ──────────────────────────────────────────────────────
-- Remover política permissiva atual
DROP POLICY IF EXISTS "tecnicos_read_auth" ON public.tecnicos;

-- Admins veem tudo
CREATE POLICY "tecnicos_read_admin" ON public.tecnicos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Técnico vê apenas o próprio registro completo
CREATE POLICY "tecnicos_read_self" ON public.tecnicos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Clientes e outros técnicos veem apenas dados não sensíveis via view
CREATE OR REPLACE VIEW public.tecnicos_pub AS
  SELECT
    id,
    nome,
    certificacoes,
    foto_url,
    status,
    ranking_score,
    created_at
    -- cpf, rg, user_id, horario_fim_ultimo_servico OMITIDOS intencionalmente
  FROM public.tecnicos;

GRANT SELECT ON public.tecnicos_pub TO authenticated;

-- ── 3. Corrigir campo obras (faltavam colunas usadas no formulário) ──
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cno text,
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS cargo_responsavel text;

-- ── 4. Corrigir agendamentos (campo idades_cp do novo wizard) ─────────
ALTER TABLE public.agendamentos_medicoes
  ADD COLUMN IF NOT EXISTS idades_cp jsonb;

