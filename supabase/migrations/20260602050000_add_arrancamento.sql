-- Migration to add Ensaio de Arrancamento to servicos_catalogo
INSERT INTO public.servicos_catalogo (id, sku, nome_servico, unidade, valor_custo_base, valor_venda_editavel, equipamentos_inclusos, categoria, ativo)
VALUES (
  'e2b4f9b8-67a1-432d-94c0-0f04df5156a0',
  'GTB-ARRANCAMENTO',
  'Ensaio de Arrancamento',
  'Ponto',
  150.00,
  250.00,
  '[]'::jsonb,
  'Arrancamento',
  true
)
ON CONFLICT (sku) DO UPDATE SET
  nome_servico = EXCLUDED.nome_servico,
  unidade = EXCLUDED.unidade,
  valor_custo_base = EXCLUDED.valor_custo_base,
  valor_venda_editavel = EXCLUDED.valor_venda_editavel,
  categoria = EXCLUDED.categoria,
  ativo = EXCLUDED.ativo;
