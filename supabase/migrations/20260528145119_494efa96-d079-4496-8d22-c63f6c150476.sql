
-- Fix search_path on touch_updated_at (others já têm)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke public execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_empresa_on_validado() FROM PUBLIC, anon, authenticated;

-- has_role precisa ser executável por authenticated (usada em policies)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Tighten empresas_clientes INSERT (requer autenticação real, não permissivo)
DROP POLICY IF EXISTS "empresas_insert" ON public.empresas_clientes;
CREATE POLICY "empresas_insert_auth" ON public.empresas_clientes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
