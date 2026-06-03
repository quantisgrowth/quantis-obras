-- 1. Create table documentos_tecnicos
CREATE TABLE IF NOT EXISTS public.documentos_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id uuid NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  nome_documento text NOT NULL,
  url_documento text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Create table habilidades_tecnicos
CREATE TABLE IF NOT EXISTS public.habilidades_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id uuid NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos_catalogo(id) ON DELETE CASCADE,
  nivel_conhecimento int2 NOT NULL CHECK (nivel_conhecimento >= 1 AND nivel_conhecimento <= 10),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(tecnico_id, servico_id)
);

-- 3. Enable RLS on the new tables
ALTER TABLE public.documentos_tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habilidades_tecnicos ENABLE ROW LEVEL SECURITY;

-- 4. Set up Policies for public.documentos_tecnicos
-- Read: Authenticated users can view
CREATE POLICY "Allow select on documentos_tecnicos for authenticated users" 
ON public.documentos_tecnicos FOR SELECT TO authenticated USING (true);

-- Write: Only administrators can modify
CREATE POLICY "Allow all on documentos_tecnicos for admins" 
ON public.documentos_tecnicos FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin')) 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Set up Policies for public.habilidades_tecnicos
-- Read: Authenticated users can view
CREATE POLICY "Allow select on habilidades_tecnicos for authenticated users" 
ON public.habilidades_tecnicos FOR SELECT TO authenticated USING (true);

-- Write: Only administrators can modify
CREATE POLICY "Allow all on habilidades_tecnicos for admins" 
ON public.habilidades_tecnicos FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin')) 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Grant basic privileges
GRANT SELECT ON public.documentos_tecnicos TO authenticated;
GRANT ALL ON public.documentos_tecnicos TO service_role;

GRANT SELECT ON public.habilidades_tecnicos TO authenticated;
GRANT ALL ON public.habilidades_tecnicos TO service_role;
