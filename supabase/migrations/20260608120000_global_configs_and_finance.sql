-- Semeia chaves de configurações globais na tabela app_settings
INSERT INTO public.app_settings (key, value, descricao)
VALUES (
  'configuracoes_globais', 
  '{"eficiencia_cp": 95, "coeficiente_he": 1.5, "prazo_faturamento_dias": 28}'::jsonb, 
  'Configurações globais de operação, como eficiência esperada de CPs e coeficiente base de horas extras.'
)
ON CONFLICT (key) DO NOTHING;
