-- ══════════════════════════════════════════════════════════════════════
-- FIX: Adicionar chaves estrangeiras na tabela profiles
-- Problema: A tabela profiles não possui chaves estrangeiras explícitas
--           para empresas_clientes e tecnicos, impedindo que o PostgREST
--           (API do Supabase) realize consultas aninhadas (JOINs).
-- ══════════════════════════════════════════════════════════════════════

-- 1. Adicionar foreign key de empresa_id para a tabela empresas_clientes
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_empresa_id_fkey,
  ADD CONSTRAINT profiles_empresa_id_fkey
  FOREIGN KEY (empresa_id)
  REFERENCES public.empresas_clientes(id)
  ON DELETE SET NULL;

-- 2. Adicionar foreign key de tecnico_id para a tabela tecnicos
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tecnico_id_fkey,
  ADD CONSTRAINT profiles_tecnico_id_fkey
  FOREIGN KEY (tecnico_id)
  REFERENCES public.tecnicos(id)
  ON DELETE SET NULL;
