-- 1. Recreate public views with security_invoker so RLS runs as caller
DROP VIEW IF EXISTS public.servicos_catalogo_pub;
CREATE VIEW public.servicos_catalogo_pub
WITH (security_invoker = true) AS
SELECT id, sku, nome_servico, unidade, valor_venda_editavel, categoria, ativo, created_at
FROM public.servicos_catalogo;

DROP VIEW IF EXISTS public.tecnicos_pub;
CREATE VIEW public.tecnicos_pub
WITH (security_invoker = true) AS
SELECT id, nome, certificacoes, foto_url, status, ranking_score, created_at
FROM public.tecnicos;

GRANT SELECT ON public.servicos_catalogo_pub TO authenticated;
GRANT SELECT ON public.tecnicos_pub TO authenticated;

-- 2. Revoke EXECUTE on internal trigger helpers from regular users
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_empresa_on_validado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 3. Tighten empresas_clientes INSERT to controlled onboarding
DROP POLICY IF EXISTS empresas_insert_auth ON public.empresas_clientes;
CREATE POLICY empresas_insert_controlled
ON public.empresas_clientes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND empresa_id IS NOT NULL
  )
);