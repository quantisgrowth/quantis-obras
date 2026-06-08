-- ── ADICIONAR POLÍTICA DE EXCLUSÃO PARA EMPRESAS CLIENTES ──
CREATE POLICY "empresas_delete" ON public.empresas_clientes FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
);
