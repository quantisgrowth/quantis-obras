-- SQL de Grants de Escrita de Documentos (Lote 20260603175000)
-- 1. Grant INSERT, UPDATE, DELETE privileges on table public.documentos_tecnicos to authenticated role
GRANT INSERT, UPDATE, DELETE ON public.documentos_tecnicos TO authenticated;

-- 2. Grant INSERT, UPDATE, DELETE privileges on table public.habilidades_tecnicos to authenticated role
GRANT INSERT, UPDATE, DELETE ON public.habilidades_tecnicos TO authenticated;
