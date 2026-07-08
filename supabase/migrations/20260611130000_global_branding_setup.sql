-- Migration: Configuração de Branding Global por Instância (Consolidação em app_settings)

-- 1. Remover view, triggers e funções criadas na migração de slugs anterior
DROP VIEW IF EXISTS public.tenant_branding_pub CASCADE;
DROP TRIGGER IF EXISTS trg_set_empresa_slug ON public.empresas_clientes;
DROP FUNCTION IF EXISTS public.set_empresa_slug();
DROP FUNCTION IF EXISTS public.slugify(text);

-- 2. Remover coluna slug da tabela empresas_clientes para manter a estrutura limpa
ALTER TABLE public.empresas_clientes DROP COLUMN IF EXISTS slug;

-- 3. Atualizar handle_new_user() para o estado original (cadastro comum de clientes)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'telefone'
  );
  
  -- Se for o email do admin mestre, atribui a role admin; caso contrário, cliente
  IF NEW.email = 'felipe@quantisgrowth.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Ajustar políticas de RLS da tabela app_settings para permitir leitura pública (anon) do branding
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "settings_read_public" ON public.app_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;

-- Qualquer um (deslogado ou logado) pode ler as configurações públicas da plataforma (como branding)
CREATE POLICY "settings_read_public" ON public.app_settings
  FOR SELECT USING (true);

-- Apenas o administrador (role 'admin') pode alterar as configurações
CREATE POLICY "settings_admin_write" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Inicializar e mesclar chaves de branding dentro de 'empresa_plataforma' na app_settings
DO $$
DECLARE
  current_val jsonb;
BEGIN
  SELECT value INTO current_val FROM public.app_settings WHERE key = 'empresa_plataforma';
  
  IF current_val IS NULL THEN
    INSERT INTO public.app_settings (key, value, descricao)
    VALUES (
      'empresa_plataforma', 
      '{"razao_social": "Quantis Obras", "cnpj": "", "telefone": "", "email": "", "endereco": "", "logo_url": null, "favicon_url": null, "primary_color": "#0284c7", "secondary_color": "#0f172a", "font_primary": "Inter", "custom_domain": null}'::jsonb, 
      'Dados da Empresa e Identidade Visual da Instância'
    );
  ELSE
    -- Mescla as chaves de identidade visual com os dados cadastrais existentes
    UPDATE public.app_settings
    SET value = jsonb_build_object(
      'razao_social', COALESCE(current_val->>'razao_social', 'Quantis Obras'),
      'cnpj', COALESCE(current_val->>'cnpj', ''),
      'telefone', COALESCE(current_val->>'telefone', ''),
      'email', COALESCE(current_val->>'email', ''),
      'endereco', COALESCE(current_val->>'endereco', ''),
      'logo_url', COALESCE(current_val->>'logo_url', null),
      'favicon_url', COALESCE(current_val->>'favicon_url', null),
      'primary_color', COALESCE(current_val->>'primary_color', '#0284c7'),
      'secondary_color', COALESCE(current_val->>'secondary_color', '#0f172a'),
      'font_primary', COALESCE(current_val->>'font_primary', 'Inter'),
      'custom_domain', COALESCE(current_val->>'custom_domain', null)
    ),
    descricao = 'Dados da Empresa e Identidade Visual da Instância'
    WHERE key = 'empresa_plataforma';
  END IF;
END $$;
