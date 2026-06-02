import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IdadeCpSchema = z.object({
  idade: z.number().int().positive().max(365),
  qtd: z.number().int().positive().max(50),
});

const NovaObraSchema = z.object({
  nome_obra: z.string().min(1).max(255),
  endereco: z.string().min(1).max(500),
  numero: z.string().min(1).max(50),
  bairro: z.string().min(1).max(255),
  cidade: z.string().min(1).max(255),
  estado: z.string().min(2).max(2),
  cep: z.string().max(20).nullable().optional(),
  cno: z.string().min(1).max(50),
  responsavel: z.string().min(1).max(255),
  cargo_responsavel: z.string().min(1).max(255),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

const BookingSchema = z.object({
  obra_id: z.string().uuid().nullable(),
  nova_obra: NovaObraSchema.nullable(),
  servico_id: z.string().uuid(),
  data_servico: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horario_na_obra: z.string().regex(/^\d{2}:\d{2}$/),
  qtd_caminhoes: z.number().int().min(1).max(50),
  idades_cp: z.array(IdadeCpSchema).min(1).max(10),
  volume_m3: z.number().min(0).max(10000),
  // Aceita todas as formas de pagamento incluindo Faturar_Depois
  forma_pagamento: z.enum(["Pix", "Cartao", "Boleto_14", "Boleto_28", "Faturar_Depois"]),
  observacoes: z.string().max(2000).nullable().optional(),
});

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BookingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load profile + empresa
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, empresa_id")
      .eq("id", userId)
      .single();

    // Se não tem empresa, criar uma automaticamente
    let empresaId = profile?.empresa_id;
    if (!empresaId) {
      // Tenta criar empresa padrão para o usuário
      const { data: novaEmpresa, error: empErr } = await supabase
        .from("empresas_clientes")
        .insert({
          razao_social: "Empresa Padrão",
          cnpj: `TEMP-${userId.substring(0, 8)}`,
        })
        .select("id")
        .single();

      if (empErr || !novaEmpresa) {
        throw new Error("Perfil sem empresa associada. Entre em contato com o suporte.");
      }

      empresaId = novaEmpresa.id;
      await supabase
        .from("profiles")
        .update({ empresa_id: empresaId })
        .eq("id", userId);
    }

    // Resolve or create obra
    let finalObraId = data.obra_id;
    let cidadeObra: string | null = null;

    if (!finalObraId && data.nova_obra) {
      const { data: newObra, error: obraErr } = await supabase
        .from("obras")
        .insert({
          empresa_id: empresaId,
          nome_obra: data.nova_obra.nome_obra,
          cno: data.nova_obra.cno,
          responsavel: data.nova_obra.responsavel,
          cargo_responsavel: data.nova_obra.cargo_responsavel,
          endereco: data.nova_obra.endereco,
          numero: data.nova_obra.numero,
          bairro: data.nova_obra.bairro,
          estado: data.nova_obra.estado,
          cidade: data.nova_obra.cidade,
          cep: data.nova_obra.cep || null,
          latitude: data.nova_obra.latitude ?? null,
          longitude: data.nova_obra.longitude ?? null,
        })
        .select("id, cidade, empresa_id")
        .single();
      if (obraErr || !newObra) throw new Error(obraErr?.message || "Erro ao criar obra.");
      finalObraId = newObra.id;
      cidadeObra = newObra.cidade;
    } else if (finalObraId) {
      const { data: obra, error: obraErr } = await supabase
        .from("obras")
        .select("id, cidade, empresa_id")
        .eq("id", finalObraId)
        .single();
      if (obraErr || !obra) throw new Error("Obra não encontrada.");
      if (obra.empresa_id !== empresaId) {
        throw new Error("Obra não pertence à sua empresa.");
      }
      cidadeObra = obra.cidade;
    } else {
      throw new Error("Selecione uma obra ou cadastre uma nova.");
    }

    // Load servico — tenta a view pub primeiro, depois a tabela diretamente
    let servicePrice = 0;
    const { data: servicoPub } = await supabase
      .from("servicos_catalogo_pub")
      .select("id, valor_venda_editavel, ativo")
      .eq("id", data.servico_id)
      .single();

    if (!servicoPub || !servicoPub.ativo) {
      throw new Error("Serviço inválido ou inativo.");
    }
    servicePrice = Number(servicoPub.valor_venda_editavel) || 0;

    // Load city costs
    const { data: cidade } = await supabase
      .from("cidades_atendidas")
      .select("mobilizacao_base, pedagio_estimado")
      .ilike("nome_cidade", cidadeObra || "")
      .maybeSingle();
    const mobilizacao = cidade ? Number(cidade.mobilizacao_base) || 0 : 0;
    const pedagios = cidade ? Number(cidade.pedagio_estimado) || 0 : 0;

    // Calculations
    const cpsContratados = data.idades_cp.reduce((acc, i) => acc + i.qtd, 0) * data.qtd_caminhoes;
    const JORNADA_TOTAL_H = 9;
    const [hInicio] = data.horario_na_obra.split(":").map(Number);
    const fimH = hInicio + JORNADA_TOTAL_H;
    const horasExtras = Math.max(0, fimH - 17);
    const VALOR_HORA_EXTRA = 150;
    const custoExtra = horasExtras * VALOR_HORA_EXTRA;

    const rawServiceCost = cpsContratados * servicePrice;
    const subtotal = rawServiceCost + mobilizacao + pedagios;
    const IMPOSTO_PCT = 0.12;
    const descontoPct =
      data.forma_pagamento === "Pix" || data.forma_pagamento === "Cartao" ? 0.05 : 0;
    const imposto = +(subtotal * IMPOSTO_PCT).toFixed(2);
    const desconto = +(subtotal * descontoPct).toFixed(2);
    const total = +(subtotal + imposto - desconto + custoExtra).toFixed(2);

    // Horario saida
    const [h, m] = data.horario_na_obra.split(":").map(Number);
    const fimMin = h * 60 + m + JORNADA_TOTAL_H * 60;
    const fimHH = Math.floor(fimMin / 60) % 24;
    const fimMM = fimMin % 60;
    const horarioSaida = `${String(fimHH).padStart(2, "0")}:${String(fimMM).padStart(2, "0")}:00`;

    // Status pagamento
    const statusPagamento =
      data.forma_pagamento === "Pix" || data.forma_pagamento === "Cartao"
        ? "Pago"
        : "Pendente";

    // Forma pagamento para DB — Faturar_Depois vai como Boleto_28 no ENUM mas marcado como Pendente
    const formaPagamentoDb =
      data.forma_pagamento === "Faturar_Depois" ? "Boleto_28" : data.forma_pagamento;

    const { data: agendamento, error: bookingErr } = await supabase
      .from("agendamentos_medicoes")
      .insert({
        obra_id: finalObraId,
        empresa_id: empresaId,
        servico_id: data.servico_id,
        criado_por: userId,
        data_servico: data.data_servico,
        horario_na_obra: data.horario_na_obra + ":00",
        horario_saida_lab: horarioSaida,
        volume_m3: data.volume_m3,
        qtd_caminhoes: data.qtd_caminhoes,
        cps_contratados: cpsContratados,
        idades_cp: data.idades_cp as unknown as never,
        idades_selecionadas: data.idades_cp.map((i) => i.idade),
        status_pagamento: statusPagamento,
        forma_pagamento: formaPagamentoDb,
        status_agendamento: "Pendente_Tecnico",
        valor_subtotal: +subtotal.toFixed(2),
        valor_desconto: desconto,
        valor_imposto_12: imposto,
        valor_total: total,
        observacoes: data.observacoes || null,
        memoria_calculo: {
          servicePrice,
          cpsContratados,
          rawServiceCost,
          mobilizacao,
          pedagios,
          horasExtras,
          custoExtra,
          impostoPct: IMPOSTO_PCT,
          descontoPct,
          formaPagamentoOriginal: data.forma_pagamento,
        } as unknown as never,
      })
      .select("id, codigo_pedido, valor_total")
      .single();

    if (bookingErr || !agendamento) {
      throw new Error(bookingErr?.message || "Erro ao criar agendamento.");
    }

    return {
      id: agendamento.id,
      codigo_pedido: agendamento.codigo_pedido,
      valor_total: Number(agendamento.valor_total),
      obra_id: finalObraId,
    };
  });
