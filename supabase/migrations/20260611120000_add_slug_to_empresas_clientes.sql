-- Migration: Adiciona slug e suporte a multi-tenant por URL na tabela public.empresas_clientes

-- 1. Habilitar a extensão de remoção de acentos se não existir
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Criar ou substituir a função de slugify
CREATE OR REPLACE FUNCTION public.slugify(value text)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  -- Transforma em minúsculas
  result := lower(value);
  -- Remove acentos
  result := unaccent(result);
  -- Substitui caracteres não alfanuméricos por hifens
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  -- Remove hifens duplicados, iniciais ou finais
  result := regexp_replace(result, '^-+|-+$', '', 'g');
  -- Se o resultado for vazio, define um padrão
  IF result = '' THEN
    result := 'empresa';
  END IF;
  RETURN result;
END;
$$ LANGUAGE plpgsql STRICT IMMUTABLE;

-- 3. Adicionar coluna slug na tabela de empresas
ALTER TABLE public.empresas_clientes ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- 4. Função para auto-slugify e unicidade recursiva
CREATE OR REPLACE FUNCTION public.set_empresa_slug()
RETURNS trigger AS $$
DECLARE
  base_slug text;
  temp_slug text;
  counter integer := 1;
BEGIN
  -- Se o slug não for fornecido, gera a partir da razão social
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.slugify(NEW.razao_social);
  ELSE
    base_slug := public.slugify(NEW.slug);
  END IF;

  temp_slug := base_slug;
  
  -- Garante a unicidade do slug adicionando sufixo numérico se necessário
  WHILE EXISTS (SELECT 1 FROM public.empresas_clientes WHERE slug = temp_slug AND id IS DISTINCT FROM NEW.id) LOOP
    temp_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  NEW.slug := temp_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar a trigger para a tabela
DROP TRIGGER IF EXISTS trg_set_empresa_slug ON public.empresas_clientes;
CREATE TRIGGER trg_set_empresa_slug
  BEFORE INSERT OR UPDATE OF razao_social, slug ON public.empresas_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_slug();

-- 6. Popular slugs nas empresas existentes
DO $$
DECLARE
  rec RECORD;
  base_slug text;
  temp_slug text;
  counter integer;
BEGIN
  FOR rec IN SELECT id, razao_social FROM public.empresas_clientes WHERE slug IS NULL LOOP
    base_slug := public.slugify(rec.razao_social);
    temp_slug := base_slug;
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM public.empresas_clientes WHERE slug = temp_slug AND id IS DISTINCT FROM rec.id) LOOP
      temp_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    UPDATE public.empresas_clientes SET slug = temp_slug WHERE id = rec.id;
  END LOOP;
END $$;

-- 7. Recriar a View de Branding Público adicionando slug e razao_social
DROP VIEW IF EXISTS public.tenant_branding_pub CASCADE;
CREATE OR REPLACE VIEW public.tenant_branding_pub AS
  SELECT
    id,
    razao_social,
    slug,
    logo_url,
    favicon_url,
    primary_color,
    secondary_color,
    font_primary,
    custom_domain
  FROM public.empresas_clientes;

GRANT SELECT ON public.tenant_branding_pub TO anon, authenticated;

-- 8. Atualizar handle_new_user() para aceitar empresa_id do metadata de cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta_empresa_id uuid;
BEGIN
  -- Tenta converter o empresa_id do metadata para UUID
  BEGIN
    meta_empresa_id := (NEW.raw_user_meta_data->>'empresa_id')::uuid;
  EXCEPTION WHEN others THEN
    meta_empresa_id := NULL;
  END;

  INSERT INTO public.profiles (id, nome_completo, telefone, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'telefone',
    meta_empresa_id
  );
  
  -- Determinação do cargo do usuário
  IF NEW.email = 'felipe@quantisgrowth.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF NEW.raw_user_meta_data->>'role' = 'tecnico' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tecnico') ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente') ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
