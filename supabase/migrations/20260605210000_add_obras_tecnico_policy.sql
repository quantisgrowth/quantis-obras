-- Create policy to allow technicians to view obras they are allocated to
CREATE POLICY "obras_read_tecnico" ON public.obras FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.agendamentos_medicoes a
    JOIN public.tecnicos t ON t.id = a.tecnico_id
    WHERE a.obra_id = obras.id AND t.user_id = auth.uid()
  )
);
