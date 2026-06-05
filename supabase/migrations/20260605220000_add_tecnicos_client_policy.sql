-- Create policy to allow clients to view the profile of technicians allocated to their bookings
CREATE POLICY "tecnicos_read_client" ON public.tecnicos FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.agendamentos_medicoes a
    WHERE a.tecnico_id = tecnicos.id AND (
      a.criado_por = auth.uid() OR
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = a.empresa_id)
    )
  )
);
