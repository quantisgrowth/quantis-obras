CREATE OR REPLACE VIEW public.servicos_catalogo_pub AS
  SELECT id, sku, nome_servico, unidade, valor_venda_editavel, categoria, ativo, created_at
  FROM public.servicos_catalogo;
GRANT SELECT ON public.servicos_catalogo_pub TO authenticated, anon;

DROP POLICY IF EXISTS "catalogo_read_all" ON public.servicos_catalogo;
DROP POLICY IF EXISTS "catalogo_read_admin_only" ON public.servicos_catalogo;
CREATE POLICY "catalogo_read_admin_only" ON public.servicos_catalogo
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "tecnicos_read_auth" ON public.tecnicos;
DROP POLICY IF EXISTS "tecnicos_read_admin" ON public.tecnicos;
DROP POLICY IF EXISTS "tecnicos_read_self" ON public.tecnicos;
CREATE POLICY "tecnicos_read_admin" ON public.tecnicos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tecnicos_read_self" ON public.tecnicos
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE VIEW public.tecnicos_pub AS
  SELECT id, nome, certificacoes, foto_url, status, ranking_score, created_at
  FROM public.tecnicos;
GRANT SELECT ON public.tecnicos_pub TO authenticated;

ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cno text,
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS cargo_responsavel text;

ALTER TABLE public.agendamentos_medicoes
  ADD COLUMN IF NOT EXISTS idades_cp jsonb;