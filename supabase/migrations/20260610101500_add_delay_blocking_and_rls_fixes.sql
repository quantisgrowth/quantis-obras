-- Migration: Add delay blocking flag to bookings and fix RLS policies for alertas_gestao and app_settings
-- 1. Add autorizado_atraso to agendamentos_medicoes
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS autorizado_atraso boolean NOT NULL DEFAULT false;

-- 2. Replace public.has_role() with direct EXISTS check in public.alertas_gestao policies
DROP POLICY IF EXISTS "alertas_select" ON public.alertas_gestao;
CREATE POLICY "alertas_select" ON public.alertas_gestao FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "alertas_update" ON public.alertas_gestao;
CREATE POLICY "alertas_update" ON public.alertas_gestao FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Replace public.has_role() with direct EXISTS check in public.app_settings policies
DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;
CREATE POLICY "settings_admin_write" ON public.app_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
