-- Migration: Add sub_role and permissions (permissoes) to profiles and update trigger
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sub_role text DEFAULT 'master',
ADD COLUMN IF NOT EXISTS permissoes text[] DEFAULT ARRAY['pedidos', 'obras', 'dashboard', 'financeiro', 'equipe'];

-- Update existing profiles to have default values if they are null
UPDATE public.profiles
SET sub_role = 'master',
    permissoes = ARRAY['pedidos', 'obras', 'dashboard', 'financeiro', 'equipe']
WHERE sub_role IS NULL;

-- Update trigger function to handle permissions from meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta_empresa_id uuid;
  meta_sub_role text;
  meta_permissoes text[];
BEGIN
  -- Tenta converter o empresa_id do metadata para UUID
  BEGIN
    meta_empresa_id := (NEW.raw_user_meta_data->>'empresa_id')::uuid;
  EXCEPTION WHEN others THEN
    meta_empresa_id := NULL;
  END;

  meta_sub_role := COALESCE(NEW.raw_user_meta_data->>'sub_role', 'master');
  
  -- Extract permissions array from raw user metadata if it exists
  IF NEW.raw_user_meta_data ? 'permissoes' THEN
    SELECT ARRAY_AGG(x) INTO meta_permissoes 
    FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'permissoes') x;
  ELSE
    meta_permissoes := ARRAY['pedidos', 'obras', 'dashboard', 'financeiro', 'equipe'];
  END IF;

  INSERT INTO public.profiles (id, nome_completo, telefone, empresa_id, sub_role, permissoes)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'telefone',
    meta_empresa_id,
    meta_sub_role,
    meta_permissoes
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
