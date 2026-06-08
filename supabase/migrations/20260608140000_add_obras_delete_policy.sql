-- ── ADICIONAR POLÍTICA DE EXCLUSÃO PARA OBRAS ──
CREATE POLICY "obras_delete" ON public.obras FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = obras.empresa_id)
);
