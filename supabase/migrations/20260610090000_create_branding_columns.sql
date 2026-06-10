-- Migration: Customização Visual "Private Label"
-- Adiciona suporte a identidade visual por empresa cliente e flag de gestor do cliente.

-- 1. Alterar tabela empresas_clientes
ALTER TABLE public.empresas_clientes 
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS favicon_url text,
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#0284c7',
ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#0f172a',
ADD COLUMN IF NOT EXISTS font_primary text DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE;

-- 2. Alterar tabela profiles para adicionar flag de gestor da empresa
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin_empresa boolean NOT NULL DEFAULT false;

-- 3. Trigger para impedir escalada de privilégios em profiles
CREATE OR REPLACE FUNCTION public.check_profile_update_is_admin_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Se o usuário atual não for um super admin do sistema (role 'admin')
  -- e estiver tentando alterar a flag is_admin_empresa, revertemos para o valor anterior.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'UPDATE' AND NEW.is_admin_empresa IS DISTINCT FROM OLD.is_admin_empresa THEN
      NEW.is_admin_empresa := OLD.is_admin_empresa;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_is_admin_empresa ON public.profiles;
CREATE TRIGGER enforce_profile_is_admin_empresa
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_update_is_admin_empresa();

-- Revogar permissão de execução direta da função de segurança
REVOKE EXECUTE ON FUNCTION public.check_profile_update_is_admin_empresa() FROM PUBLIC, anon, authenticated;

-- 4. Criar políticas RLS para atualizar dados de branding da própria empresa
DROP POLICY IF EXISTS "empresas_update_branding" ON public.empresas_clientes;
CREATE POLICY "empresas_update_branding" ON public.empresas_clientes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.empresa_id = empresas_clientes.id
        AND p.is_admin_empresa = true
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.empresa_id = empresas_clientes.id
        AND p.is_admin_empresa = true
    )
  );

-- 5. Criar View Pública e Segura para obter branding antes de fazer login (opcional para White-label no Login)
CREATE OR REPLACE VIEW public.tenant_branding_pub AS
  SELECT
    id,
    logo_url,
    favicon_url,
    primary_color,
    secondary_color,
    font_primary,
    custom_domain
  FROM public.empresas_clientes;

GRANT SELECT ON public.tenant_branding_pub TO anon, authenticated;
