-- ══════════════════════════════════════════════════════════════════════
-- MÓDULO CRM: TABELA DE LEADS (CONTATOS) E RELACIONAMENTOS NAS OPORTUNIDADES
-- ══════════════════════════════════════════════════════════════════════

-- 1. Criar Tabela de Leads (Contatos das Empresas Clientes)
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_cliente_id uuid REFERENCES public.empresas_clientes(id) ON DELETE SET NULL,
  nome text NOT NULL,
  email text,
  telefone text,
  cargo text,
  empresa_id uuid NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS em crm_leads
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- Política de RLS para crm_leads
DROP POLICY IF EXISTS "Empresas acessam apenas seus leads" ON public.crm_leads;
CREATE POLICY "Empresas acessam apenas seus leads" ON public.crm_leads
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Garantir privilégios para crm_leads
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;

-- Trigger para atualizar timestamp de alteração de lead
DROP TRIGGER IF EXISTS tg_update_crm_lead_timestamp ON public.crm_leads;
CREATE TRIGGER tg_update_crm_lead_timestamp
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_oportunidade_timestamp();

-- 2. Alterar Tabela de Oportunidades para Adicionar Vínculos de Empresa, Lead e Obra
ALTER TABLE public.crm_oportunidades 
  ADD COLUMN IF NOT EXISTS cliente_empresa_id uuid REFERENCES public.empresas_clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL;
