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

const SelectedServiceSchema = z.object({
  servico_id: z.string().uuid(),
  
  // Concrete specific fields
  volume_m3: z.number().min(0).max(10000).optional().nullable(),
  tamanho_betoneira: z.number().int().optional().nullable(),
  qtd_caminhoes: z.number().int().min(1).max(50).optional().nullable(),
  idades_cp: z.array(IdadeCpSchema).min(1).max(10).optional().nullable(),
  
  // Pull-off specific fields
  qtd_ensaios: z.number().int().min(1).optional().nullable(),
  pontos_por_ensaio: z.number().int().min(1).max(16).optional().nullable(),
  
  // General quantity
  quantidade: z.number().min(1).optional().nullable(),
});

const BookingSchema = z.object({
  obra_id: z.string().uuid().nullable(),
  nova_obra: NovaObraSchema.nullable(),
  data_servico: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horario_na_obra: z.string().regex(/^\d{2}:\d{2}$/),
  forma_pagamento: z.enum(["Pix", "Cartao", "Boleto_14", "Boleto_28", "Faturar_Depois"]),
  observacoes: z.string().max(2000).nullable().optional(),
  servicos: z.array(SelectedServiceSchema).min(1),
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
        throw new Error("Perfil sem empresa associada: " + (empErr?.message || "Erro desconhecido ao criar empresa."));
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
      // Check for duplicate work (same nome_obra, endereco, cep for this company)
      const cleanCep = data.nova_obra.cep?.replace(/\D/g, "") || "";
      const { data: existingObras } = await supabase
        .from("obras")
        .select("id, cidade, cep")
        .eq("empresa_id", empresaId)
        .ilike("nome_obra", data.nova_obra.nome_obra.trim())
        .ilike("endereco", data.nova_obra.endereco.trim());

      const duplicate = (existingObras || []).find(o => {
        const oCepClean = o.cep?.replace(/\D/g, "") || "";
        return oCepClean === cleanCep;
      });

      if (duplicate) {
        finalObraId = duplicate.id;
        cidadeObra = duplicate.cidade;
      } else {
        const { data: newObra, error: obraErr } = await supabase
          .from("obras")
          .insert({
            empresa_id: empresaId,
            nome_obra: data.nova_obra.nome_obra.trim(),
            cno: data.nova_obra.cno,
            responsavel: data.nova_obra.responsavel,
            cargo_responsavel: data.nova_obra.cargo_responsavel,
            endereco: data.nova_obra.endereco.trim(),
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
      }
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

    // Validate 48 hours notice
    const currentDateTime = new Date();
    const serviceDateTime = new Date(`${data.data_servico}T${data.horario_na_obra}:00`);
    const diffMs = serviceDateTime.getTime() - currentDateTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 48) {
      throw new Error("O agendamento deve ser feito com no mínimo 48 horas de antecedência.");
    }

    // Validate day of week and arrival times
    const checkDate = new Date(`${data.data_servico}T00:00:00`);
    const dow = checkDate.getDay();
    if (dow === 0) {
      throw new Error("Agendamentos aos domingos não são permitidos.");
    }

    const [hArrival, mArrival] = data.horario_na_obra.split(":").map(Number);
    const arrivalMinutes = hArrival * 60 + mArrival;

    if (dow === 6) { // Saturday
      if (arrivalMinutes < 7 * 60 || arrivalMinutes > 12 * 60) {
        throw new Error("O horário de chegada na obra aos sábados deve ser entre 07:00 e 12:00.");
      }
    } else { // Weekdays (1-5)
      if (arrivalMinutes < 7 * 60 || arrivalMinutes > 17 * 60) {
        throw new Error("O horário de chegada na obra nos dias de semana deve ser entre 07:00 e 17:00.");
      }
    }

    // Load city costs (only once)
    const { data: cidade } = await supabase
      .from("cidades_atendidas")
      .select("id, mobilizacao_base, pedagio_estimado")
      .ilike("nome_cidade", cidadeObra || "")
      .maybeSingle();
    const mobilizacao = cidade ? Number(cidade.mobilizacao_base) || 0 : 0;
    const pedagios = cidade ? Number(cidade.pedagio_estimado) || 0 : 0;

    // Overtime cost (calculated once for the entire visit)
    const JORNADA_TOTAL_H = 9;
    const [hInicio] = data.horario_na_obra.split(":").map(Number);
    const fimH = hInicio + JORNADA_TOTAL_H;

    let horasExtras = 0;
    let VALOR_HORA_EXTRA = 150;
    if (dow === 6) { // Saturday
      horasExtras = Math.max(0, fimH - 12);
      VALOR_HORA_EXTRA = 200;
    } else { // Weekdays
      horasExtras = Math.max(0, fimH - 17);
      VALOR_HORA_EXTRA = 150;
    }
    const custoExtra = horasExtras * VALOR_HORA_EXTRA;

    // Dynamic import for supabaseAdmin to insert default services if missing
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bookingsToInsert: any[] = [];
    let groupTotalValue = 0;

    for (let index = 0; index < data.servicos.length; index++) {
      const selectedSvc = data.servicos[index];

      // Self-healing: if the service is GTB-ARRANCAMENTO and doesn't exist, insert it!
      if (selectedSvc.servico_id === "e2b4f9b8-67a1-432d-94c0-0f04df5156a0") {
        const { data: existing } = await supabaseAdmin
          .from("servicos_catalogo")
          .select("id")
          .eq("id", selectedSvc.servico_id)
          .maybeSingle();
        if (!existing) {
          await supabaseAdmin.from("servicos_catalogo").insert({
            id: "e2b4f9b8-67a1-432d-94c0-0f04df5156a0",
            sku: "GTB-ARRANCAMENTO",
            nome_servico: "Ensaio de Arrancamento",
            unidade: "Ponto",
            valor_custo_base: 150.00,
            valor_venda_editavel: 250.00,
            equipamentos_inclusos: [],
            categoria: "Arrancamento",
            ativo: true
          });
        }
      }

      // Load service details
      const { data: servicoCatalog } = await supabaseAdmin
        .from("servicos_catalogo")
        .select("*")
        .eq("id", selectedSvc.servico_id)
        .single();

      if (!servicoCatalog || !servicoCatalog.ativo) {
        throw new Error("Serviço inválido ou inativo: " + selectedSvc.servico_id);
      }

      let servicePrice = Number(servicoCatalog.valor_venda_editavel) || 0;
      let requireManualQuote = false;

      if (cidade?.id) {
        const { data: precoCidade } = await supabase
          .from("servicos_precos_cidades")
          .select("*")
          .eq("servico_id", selectedSvc.servico_id)
          .eq("cidade_id", cidade.id)
          .maybeSingle();

        if (precoCidade) {
          servicePrice = Number(precoCidade.valor_fixo);
        } else {
          requireManualQuote = true;
        }
      } else {
        requireManualQuote = true;
      }

      const serviceCategory = servicoCatalog.categoria || "";
      const nomeServico = servicoCatalog.nome_servico || "";

      // Determine service type and calculate quantity/cost
      let cpsContratados = 0;
      let rawServiceCost = 0;
      
      const isConcrete = 
        nomeServico.toLowerCase().includes("concreto") ||
        nomeServico.toLowerCase().includes("graute") ||
        nomeServico.toLowerCase().includes("argamassa") ||
        nomeServico.toLowerCase().includes("cp") ||
        serviceCategory.toLowerCase().includes("concreto");

      const isArrancamento = 
        nomeServico.toLowerCase().includes("arrancamento") ||
        serviceCategory.toLowerCase().includes("arrancamento");

      if (isConcrete && selectedSvc.idades_cp && selectedSvc.qtd_caminhoes) {
        cpsContratados = selectedSvc.idades_cp.reduce((acc, i) => acc + i.qtd, 0) * selectedSvc.qtd_caminhoes;
      } else if (isArrancamento && selectedSvc.qtd_ensaios && selectedSvc.pontos_por_ensaio) {
        const totalPoints = selectedSvc.qtd_ensaios * selectedSvc.pontos_por_ensaio;
        cpsContratados = totalPoints;
      } else {
        const qty = selectedSvc.quantidade || 1;
        cpsContratados = qty;
      }

      // Check CP/quantity limit:
      if (cidade?.id) {
        const { data: precoCidade } = await supabase
          .from("servicos_precos_cidades")
          .select("limite_unidades")
          .eq("servico_id", selectedSvc.servico_id)
          .eq("cidade_id", cidade.id)
          .maybeSingle();
        if (precoCidade && cpsContratados > precoCidade.limite_unidades) {
          requireManualQuote = true;
        }
      }

      if (servicoCatalog.tipo_cobranca === "Por Unidade" || servicoCatalog.tipo_cobranca === "Por Hora") {
        rawServiceCost = cpsContratados * servicePrice;
      } else {
        rawServiceCost = servicePrice;
      }

      // Mobilization, tolls, and overtime are charged ONLY on the first service in the list
      const currentMob = index === 0 ? mobilizacao : 0;
      const currentPed = index === 0 ? pedagios : 0;
      const currentOvertime = index === 0 ? custoExtra : 0;

      const subtotal = rawServiceCost + currentMob + currentPed;
      const IMPOSTO_PCT = 0.12;
      const descontoPct =
        data.forma_pagamento === "Pix" || data.forma_pagamento === "Cartao" ? 0.05 : 0;
      const imposto = +(subtotal * IMPOSTO_PCT).toFixed(2);
      const desconto = +(subtotal * descontoPct).toFixed(2);
      const total = +(subtotal + imposto - desconto + currentOvertime).toFixed(2);

      groupTotalValue += total;

      // Calculate departure time
      const [h, m] = data.horario_na_obra.split(":").map(Number);
      const fimMin = h * 60 + m + JORNADA_TOTAL_H * 60;
      const fimHH = Math.floor(fimMin / 60) % 24;
      const fimMM = fimMin % 60;
      const horarioSaida = `${String(fimHH).padStart(2, "0")}:${String(fimMM).padStart(2, "0")}:00`;

      // Payment status
      const statusPagamento =
        data.forma_pagamento === "Pix" || data.forma_pagamento === "Cartao"
          ? "Pago"
          : "Pendente";

      const formaPagamentoDb =
        data.forma_pagamento === "Faturar_Depois" ? "Boleto_28" : data.forma_pagamento;

      bookingsToInsert.push({
        obra_id: finalObraId,
        empresa_id: empresaId,
        servico_id: selectedSvc.servico_id,
        criado_por: userId,
        data_servico: data.data_servico,
        horario_na_obra: data.horario_na_obra + ":00",
        horario_saida_lab: horarioSaida,
        volume_m3: selectedSvc.volume_m3 || 0,
        qtd_caminhoes: selectedSvc.qtd_caminhoes || 1,
        cps_contratados: cpsContratados,
        idades_cp: selectedSvc.idades_cp ? (selectedSvc.idades_cp as unknown as never) : null,
        idades_selecionadas: selectedSvc.idades_cp ? selectedSvc.idades_cp.map((i) => i.idade) : [],
        status_pagamento: statusPagamento,
        forma_pagamento: formaPagamentoDb,
        status_agendamento: "Pendente_Tecnico",
        is_orcamento_manual: requireManualQuote,
        orcamento_aprovado: !requireManualQuote,
        valor_subtotal: +subtotal.toFixed(2),
        valor_desconto: desconto,
        valor_imposto_12: imposto,
        valor_total: total,
        observacoes: data.observacoes || null,
        memoria_calculo: {
          servicePrice,
          cpsContratados,
          rawServiceCost,
          mobilizacao: currentMob,
          pedagios: currentPed,
          horasExtras: index === 0 ? horasExtras : 0,
          custoExtra: currentOvertime,
          impostoPct: IMPOSTO_PCT,
          descontoPct,
          formaPagamentoOriginal: data.forma_pagamento,
          tamanho_betoneira: selectedSvc.tamanho_betoneira || null,
          qtd_ensaios: selectedSvc.qtd_ensaios || null,
          pontos_por_ensaio: selectedSvc.pontos_por_ensaio || null,
        } as unknown as never,
      });
    }

    // Insert all bookings
    const { data: agendamentos, error: bookingErr } = await supabase
      .from("agendamentos_medicoes")
      .insert(bookingsToInsert)
      .select("id, codigo_pedido, valor_total, servico:servicos_catalogo_pub(categoria)");

    if (bookingErr || !agendamentos || agendamentos.length === 0) {
      throw new Error(bookingErr?.message || "Erro ao criar agendamento.");
    }

    // Run technician matching for each booking
    for (const ag of agendamentos) {
      try {
        await selectAndInviteTechnician(
          supabase,
          ag.id,
          data.data_servico,
          ag.servico?.categoria || "",
          []
        );
      } catch (matchErr) {
        console.error(`Erro ao alocar técnico automático para agendamento ${ag.id}:`, matchErr);
      }
    }

    // Return the first booking details but with the combined group total value
    const firstAgendamento = agendamentos[0];
    return {
      id: firstAgendamento.id,
      codigo_pedido: firstAgendamento.codigo_pedido,
      valor_total: +groupTotalValue.toFixed(2),
      obra_id: finalObraId,
    };
  });

async function selectAndInviteTechnician(
  supabase: any,
  bookingId: string,
  dataServico: string,
  serviceCategory: string,
  rejectedIds: string[]
) {
  // Find all available technicians
  const { data: allTecnicos, error: tecErr } = await supabase
    .from("tecnicos")
    .select("id, nome, status, ranking_score, user_id, certificacoes")
    .eq("status", "Disponivel");

  if (tecErr || !allTecnicos || allTecnicos.length === 0) {
    return null;
  }

  // Filter by compatibility
  let compativeis = allTecnicos.filter((t: any) => {
    if (!t.certificacoes || !serviceCategory) return true;
    const catLower = serviceCategory.toLowerCase();
    return (
      t.certificacoes.toLowerCase().includes(catLower) ||
      catLower.includes("concreto") ||
      catLower.includes("geral")
    );
  });

  // Exclude rejected ones
  if (rejectedIds && rejectedIds.length > 0) {
    compativeis = compativeis.filter((t: any) => !rejectedIds.includes(t.id));
  }

  const tecIds = compativeis.map((t: any) => t.id);
  if (tecIds.length === 0) {
    return null;
  }

  // Filter out technicians who already have a confirmed or pending booking on that date
  const { data: bookingsOnDate } = await supabase
    .from("agendamentos_medicoes")
    .select("tecnico_id")
    .eq("data_servico", dataServico)
    .in("status_agendamento", ["Confirmado", "Em_Execucao", "Pendente_Tecnico"])
    .in("tecnico_id", tecIds);

  // Filter out technicians who have an approved availability blocker covering that date
  const { data: blockersOnDate } = await supabase
    .from("bloqueios_tecnicos")
    .select("tecnico_id")
    .eq("status", "Aprovado")
    .lte("data_inicio", dataServico)
    .gte("data_fim", dataServico);

  const busyTecnicoIds = new Set((bookingsOnDate || []).map((b: any) => b.tecnico_id));
  if (blockersOnDate && blockersOnDate.length > 0) {
    const isGloballyBlocked = blockersOnDate.some((blk: any) => blk.tecnico_id === null);
    if (isGloballyBlocked) {
      return null;
    }
    blockersOnDate.forEach((blk: any) => {
      if (blk.tecnico_id) {
        busyTecnicoIds.add(blk.tecnico_id);
      }
    });
  }

  const availableTecnicos = compativeis.filter((t: any) => !busyTecnicoIds.has(t.id));

  if (availableTecnicos.length === 0) {
    return null;
  }

  // Load stats of completed bookings for sorting desempate (only status_agendamento = 'Validado')
  const { data: completedStats } = await supabase
    .from("agendamentos_medicoes")
    .select("tecnico_id")
    .eq("status_agendamento", "Validado")
    .in("tecnico_id", availableTecnicos.map((t: any) => t.id));

  const statsMap: Record<string, number> = {};
  (completedStats || []).forEach((c: any) => {
    if (c.tecnico_id) {
      statsMap[c.tecnico_id] = (statsMap[c.tecnico_id] || 0) + 1;
    }
  });

  // Sort:
  // 1. ranking_score DESC
  // 2. total completed services DESC
  availableTecnicos.sort((a: any, b: any) => {
    const rankA = Number(a.ranking_score) || 0;
    const rankB = Number(b.ranking_score) || 0;
    if (rankB !== rankA) {
      return rankB - rankA;
    }
    const countA = statsMap[a.id] || 0;
    const countB = statsMap[b.id] || 0;
    return countB - countA;
  });

  const bestTechnician = availableTecnicos[0];

  // Invite this technician
  await supabase
    .from("agendamentos_medicoes")
    .update({
      tecnico_id: bestTechnician.id,
      convidado_em: new Date().toISOString(),
    })
    .eq("id", bookingId);

  return bestTechnician;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    const { data: tecnico } = await supabase
      .from("tecnicos")
      .select("id, nome, laboratorio_padrao_id, raio_atuacao_km")
      .eq("user_id", userId)
      .single();

    if (!tecnico) {
      throw new Error("Acesso negado: Perfil de técnico não encontrado.");
    }

    const { data: booking } = await supabase
      .from("agendamentos_medicoes")
      .select("id, tecnico_id, status_agendamento, empresa_id, empresa:empresas_clientes(requer_aprovacao_tecnico), obra:obras(id, nome_obra, endereco, cidade, latitude, longitude)")
      .eq("id", input.bookingId)
      .single();

    if (!booking) {
      throw new Error("Agendamento não encontrado.");
    }
    if (booking.tecnico_id !== tecnico.id) {
      throw new Error("Este convite não foi enviado para você.");
    }
    if (booking.status_agendamento !== "Pendente_Tecnico") {
      throw new Error("Este convite já foi respondido ou expirou.");
    }

    const requerAprovacao = (booking as any)?.empresa?.requer_aprovacao_tecnico || false;
    const novoStatus = requerAprovacao ? "Pendente_Aprovacao_Gestor" : "Confirmado";

    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        status_agendamento: novoStatus,
      })
      .eq("id", input.bookingId);

    if (error) throw error;

    // Check distance / operating radius to generate manager alert
    if (tecnico.laboratorio_padrao_id) {
      const { data: base } = await supabase
        .from("locais_checkin")
        .select("nome, cidade, latitude, longitude")
        .eq("id", tecnico.laboratorio_padrao_id)
        .single();

      if (base && booking.obra) {
        let isOut = false;
        let distanceText = "";

        if (
          base.latitude !== null &&
          base.longitude !== null &&
          (booking.obra as any).latitude !== null &&
          (booking.obra as any).longitude !== null
        ) {
          const dist = getDistanceKm(
            Number(base.latitude),
            Number(base.longitude),
            Number((booking.obra as any).latitude),
            Number((booking.obra as any).longitude)
          );
          const limit = Number(tecnico.raio_atuacao_km || 50);
          if (dist > limit) {
            isOut = true;
            distanceText = `distância estimada de ${dist.toFixed(1)} km, excedendo o limite de ${limit} km`;
          }
        } else {
          // Fallback to city comparison if coordinates are missing
          const baseCity = (base.cidade || "").trim().toLowerCase();
          const obraCity = ((booking.obra as any).cidade || "").trim().toLowerCase();
          if (baseCity && obraCity && baseCity !== obraCity) {
            isOut = true;
            distanceText = `obra na cidade (${(booking.obra as any).cidade}) diferente da base do técnico (${base.cidade})`;
          }
        }

        if (isOut) {
          await supabase.from("alertas_gestao").insert({
            agendamento_id: booking.id,
            tecnico_id: tecnico.id,
            tipo: "Fora_Raio_Atuacao",
            descricao: `Técnico ${tecnico.nome} aceitou serviço fora do raio padrão (${distanceText}). É necessário cadastrar um local de check-in temporário (hotel/base de apoio).`,
          });
        }
      }
    }

    return { success: true };
  });

export const rejectInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    const { data: tecnico } = await supabase
      .from("tecnicos")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!tecnico) {
      throw new Error("Acesso negado: Perfil de técnico não encontrado.");
    }

    const { data: booking } = await supabase
      .from("agendamentos_medicoes")
      .select("*, servico:servicos_catalogo_pub(*)")
      .eq("id", input.bookingId)
      .single();

    if (!booking) {
      throw new Error("Agendamento não encontrado.");
    }
    if (booking.tecnico_id !== tecnico.id) {
      throw new Error("Este convite não pertence a você.");
    }

    const currentRejected = booking.tecnicos_rejeitados || [];
    const newRejected = [...new Set([...currentRejected, tecnico.id])];

    await supabase
      .from("agendamentos_medicoes")
      .update({
        tecnico_id: null,
        convidado_em: null,
        tecnicos_rejeitados: newRejected,
      })
      .eq("id", booking.id);

    await selectAndInviteTechnician(
      supabase,
      booking.id,
      booking.data_servico,
      booking.servico?.categoria || "",
      newRejected
    );

    return { success: true };
  });

let lastTimeoutProcess = 0;

export const processTimeouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    
    // Cooldown of 5 minutes to prevent heavy database queries on every page load
    if (Date.now() - lastTimeoutProcess < 5 * 60 * 1000) {
      return { processed: 0, skipped: true };
    }
    lastTimeoutProcess = Date.now();

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    let processedCount = 0;

    // 1. Process timed-out bookings
    const { data: timedOutBookings } = await supabase
      .from("agendamentos_medicoes")
      .select("*, servico:servicos_catalogo_pub(*)")
      .eq("status_agendamento", "Pendente_Tecnico")
      .not("tecnico_id", "is", null)
      .lt("convidado_em", threeHoursAgo);

    if (timedOutBookings && timedOutBookings.length > 0) {
      for (const booking of timedOutBookings) {
        const currentRejected = booking.tecnicos_rejeitados || [];
        const newRejected = [...new Set([...currentRejected, booking.tecnico_id])];

        await supabase
          .from("agendamentos_medicoes")
          .update({
            tecnico_id: null,
            convidado_em: null,
            tecnicos_rejeitados: newRejected,
          })
          .eq("id", booking.id);

        await selectAndInviteTechnician(
          supabase,
          booking.id,
          booking.data_servico,
          booking.servico?.categoria || "",
          newRejected
        );
        processedCount++;
      }
    }

    // 2. Process unassigned pending bookings
    const { data: unassignedBookings } = await supabase
      .from("agendamentos_medicoes")
      .select("*, servico:servicos_catalogo_pub(*)")
      .eq("status_agendamento", "Pendente_Tecnico")
      .is("tecnico_id", null);

    if (unassignedBookings && unassignedBookings.length > 0) {
      for (const booking of unassignedBookings) {
        await selectAndInviteTechnician(
          supabase,
          booking.id,
          booking.data_servico,
          booking.servico?.categoria || "",
          booking.tecnicos_rejeitados || []
        );
        processedCount++;
      }
    }

    return { processed: processedCount };
  });

export const registerTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    nome: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    telefone: z.string().nullable().optional(),
    cpf: z.string().nullable().optional(),
    rg: z.string().nullable().optional(),
    laboratorioPadraoId: z.string().uuid().nullable().optional(),
    raioAtuacaoKm: z.number().nullable().optional(),
    habilidades: z.array(z.object({
      servico_id: z.string().uuid(),
      nivel: z.number().int().min(1).max(10)
    })).default([]),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check if the current user is an admin
    const { data: adminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr || !adminRole) {
      throw new Error("Acesso negado: Apenas administradores podem cadastrar técnicos.");
    }

    // Import supabaseAdmin dynamically to avoid any client bundle leakage
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch service names to construct certifications text (backwards compatibility)
    let certString = "";
    if (input.habilidades.length > 0) {
      const { data: services } = await supabaseAdmin
        .from("servicos_catalogo")
        .select("id, nome_servico")
        .in("id", input.habilidades.map(h => h.servico_id));
      certString = (services || []).map(s => s.nome_servico).join(", ");
    }

    // Create user in Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        nome_completo: input.nome,
        telefone: input.telefone || "",
      },
    });

    if (authErr || !authData.user) {
      throw new Error("Erro ao criar usuário técnico: " + (authErr?.message || "Erro desconhecido"));
    }

    const newUserId = authData.user.id;

    // Update user_roles to 'tecnico' (since trigger defaults to 'cliente')
    const { error: roleUpdateErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: newUserId, role: "tecnico" }, { onConflict: "user_id,role" });

    if (roleUpdateErr) {
      console.error("Error setting technician role:", roleUpdateErr);
    }

    // Insert into 'tecnicos' table
    const { data: newTecnico, error: tecErr } = await supabaseAdmin
      .from("tecnicos")
      .insert({
        nome: input.nome,
        email: input.email,
        cpf: input.cpf || null,
        rg: input.rg || null,
        certificacoes: certString || null,
        status: "Disponivel",
        ranking_score: 5.0,
        user_id: newUserId,
        laboratorio_padrao_id: input.laboratorioPadraoId || null,
        raio_atuacao_km: input.raioAtuacaoKm ?? 50.00,
      })
      .select("id")
      .single();

    if (tecErr || !newTecnico) {
      throw new Error("Erro ao cadastrar perfil técnico: " + (tecErr?.message || "Erro desconhecido"));
    }

    // Insert skills into 'habilidades_tecnicos'
    if (input.habilidades.length > 0) {
      const skillsToInsert = input.habilidades.map(h => ({
        tecnico_id: newTecnico.id,
        servico_id: h.servico_id,
        nivel_conhecimento: h.nivel
      }));
      const { error: skillErr } = await supabaseAdmin
        .from("habilidades_tecnicos")
        .insert(skillsToInsert);
      if (skillErr) {
        console.error("Error inserting technician skills:", skillErr);
      }
    }

    // Update profiles table to associate tecnico_id
    const { error: profileUpdateErr } = await supabaseAdmin
      .from("profiles")
      .update({ tecnico_id: newTecnico.id })
      .eq("id", newUserId);

    if (profileUpdateErr) {
      console.error("Error updating profile with tecnico_id:", profileUpdateErr);
    }

    return { success: true, tecnicoId: newTecnico.id };
  });

export const updateTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    nome: z.string().min(2),
    email: z.string().email(),
    status: z.string(),
    ranking_score: z.number().min(0).max(5),
    cpf: z.string().nullable().optional(),
    rg: z.string().nullable().optional(),
    laboratorioPadraoId: z.string().uuid().nullable().optional(),
    raioAtuacaoKm: z.number().nullable().optional(),
    habilidades: z.array(z.object({
      servico_id: z.string().uuid(),
      nivel: z.number().int().min(1).max(10)
    })).default([]),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check if the current user is an admin
    const { data: adminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr || !adminRole) {
      throw new Error("Acesso negado: Apenas administradores podem atualizar técnicos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch technician's current info
    const { data: currentTecnico, error: tecQueryErr } = await supabaseAdmin
      .from("tecnicos")
      .select("user_id, email")
      .eq("id", input.id)
      .single();

    if (tecQueryErr || !currentTecnico) {
      throw new Error("Erro ao buscar dados atuais do técnico: " + (tecQueryErr?.message || "Não encontrado"));
    }

    // Update email in Auth if it changed and user_id is set
    if (input.email.toLowerCase() !== (currentTecnico.email || "").toLowerCase()) {
      if (currentTecnico.user_id) {
        const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
          currentTecnico.user_id,
          { email: input.email }
        );
        if (authUpdateErr) {
          throw new Error("Erro ao atualizar e-mail na autenticação: " + authUpdateErr.message);
        }
      }
    }

    // Fetch service names to construct certifications text
    let certString = "";
    if (input.habilidades.length > 0) {
      const { data: services } = await supabaseAdmin
        .from("servicos_catalogo")
        .select("id, nome_servico")
        .in("id", input.habilidades.map(h => h.servico_id));
      certString = (services || []).map(s => s.nome_servico).join(", ");
    }

    // Update technician table
    const { error: updateErr } = await supabaseAdmin
      .from("tecnicos")
      .update({
        nome: input.nome,
        email: input.email,
        status: input.status as any,
        ranking_score: input.ranking_score,
        cpf: input.cpf || null,
        rg: input.rg || null,
        certificacoes: certString || null,
        laboratorio_padrao_id: input.laboratorioPadraoId || null,
        raio_atuacao_km: input.raioAtuacaoKm ?? 50.00,
      })
      .eq("id", input.id);

    if (updateErr) throw updateErr;

    // Update skills: delete old and insert new
    await supabaseAdmin
      .from("habilidades_tecnicos")
      .delete()
      .eq("tecnico_id", input.id);

    if (input.habilidades.length > 0) {
      const skillsToInsert = input.habilidades.map(h => ({
        tecnico_id: input.id,
        servico_id: h.servico_id,
        nivel_conhecimento: h.nivel
      }));
      const { error: skillErr } = await supabaseAdmin
        .from("habilidades_tecnicos")
        .insert(skillsToInsert);
      if (skillErr) throw skillErr;
    }

    return { success: true };
  });

export const addTechnicianDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    tecnicoId: z.string().uuid(),
    nomeDocumento: z.string().min(1),
    urlDocumento: z.string().url(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check if the current user is an admin
    const { data: adminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr || !adminRole) {
      throw new Error("Acesso negado: Apenas administradores podem adicionar documentos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: doc, error } = await supabaseAdmin
      .from("documentos_tecnicos")
      .insert({
        tecnico_id: input.tecnicoId,
        nome_documento: input.nomeDocumento,
        url_documento: input.urlDocumento,
      })
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, documentId: doc.id };
  });

export const deleteTechnicianDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    documentId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check if the current user is an admin
    const { data: adminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr || !adminRole) {
      throw new Error("Acesso negado: Apenas administradores podem excluir documentos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("documentos_tecnicos")
      .delete()
      .eq("id", input.documentId);

    if (error) throw error;
    return { success: true };
  });

export const registerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    nome: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    telefone: z.string().nullable().optional(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check if the current user is an admin
    const { data: adminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr || !adminRole) {
      throw new Error("Acesso negado: Apenas administradores podem cadastrar outros administradores.");
    }

    // Import supabaseAdmin dynamically
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if user already exists
    let userIdToUse: string | null = null;
    let isNewUser = false;

    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listErr) {
      console.error("Error listing users to check existence:", listErr);
    }

    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === input.email.toLowerCase()
    );

    if (existingUser) {
      userIdToUse = existingUser.id;
    } else {
      // Create user in Auth
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          nome_completo: input.nome,
          telefone: input.telefone || "",
        },
      });

      if (authErr || !authData.user) {
        throw new Error("Erro ao criar usuário administrativo: " + (authErr?.message || "Erro desconhecido"));
      }
      userIdToUse = authData.user.id;
      isNewUser = true;
    }

    // Update user_roles to 'admin'
    const { error: roleUpdateErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userIdToUse, role: "admin" }, { onConflict: "user_id,role" });

    if (roleUpdateErr) {
      console.error("Error setting admin role:", roleUpdateErr);
      throw new Error("Erro ao associar permissão administrativa.");
    }

    // Upsert profile info
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userIdToUse,
        nome_completo: input.nome,
        telefone: input.telefone || ""
      }, { onConflict: "id" });

    if (profileErr) {
      console.error("Error updating profile:", profileErr);
    }

    return { success: true, adminId: userIdToUse, isNewUser };
  });

export const startExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bookingId: z.string().uuid(),
    pontoPartidaId: z.string().uuid().nullable().optional(),
    partidaCustomEndereco: z.string().nullable().optional(),
    partidaLat: z.number().nullable().optional(),
    partidaLng: z.number().nullable().optional(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Get technician profile
    const { data: tecnico } = await supabase
      .from("tecnicos")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!tecnico) {
      throw new Error("Acesso negado: Perfil de técnico não encontrado.");
    }

    // Fetch and check booking
    const { data: booking } = await supabase
      .from("agendamentos_medicoes")
      .select("id, tecnico_id, status_agendamento")
      .eq("id", input.bookingId)
      .single();

    if (!booking) {
      throw new Error("Agendamento não encontrado.");
    }
    if (booking.tecnico_id !== tecnico.id) {
      throw new Error("Acesso negado: Você não é o técnico alocado para este serviço.");
    }

    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        status_agendamento: "Em_Execucao",
        ponto_partida_id: input.pontoPartidaId || null,
        partida_custom_endereco: input.partidaCustomEndereco || null,
        partida_lat: input.partidaLat || null,
        partida_lng: input.partidaLng || null,
        partido_em: new Date().toISOString(),
      })
      .eq("id", input.bookingId);

    if (error) throw error;
    return { success: true };
  });

export const recordCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bookingId: z.string().uuid(),
    urlFoto: z.string(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check technician
    const { data: tecnico } = await supabase
      .from("tecnicos")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!tecnico) {
      throw new Error("Acesso negado: Perfil de técnico não encontrado.");
    }

    // Insert history record
    const { error } = await supabase
      .from("historico_fotos")
      .insert({
        agendamento_id: input.bookingId,
        tipo_foto: "Checkin_QR",
        url_foto: input.urlFoto,
        metadata: {
          latitude: input.lat,
          longitude: input.lng,
          horario_checkin: new Date().toISOString(),
        },
      });

    if (error) throw error;
    return { success: true };
  });

export const addMoldingCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bookingId: z.string().uuid(),
    urlFoto: z.string(),
    slump: z.number(),
    numeroCaminhao: z.string(),
    notaFiscal: z.string(),
    pecaConcretada: z.string(),
    cpsMoldados: z.number(),
    horarioMoldagem: z.string(),
    codigosBarras: z.array(z.string()),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check technician
    const { data: tecnico } = await supabase
      .from("tecnicos")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!tecnico) {
      throw new Error("Acesso negado: Perfil de técnico não encontrado.");
    }

    const { error } = await supabase
      .from("historico_fotos")
      .insert({
        agendamento_id: input.bookingId,
        tipo_foto: "Ciclo_CP",
        url_foto: input.urlFoto,
        metadata: {
          slump: input.slump,
          numero_caminhao: input.numeroCaminhao,
          nota_fiscal: input.notaFiscal,
          peca_concretada: input.pecaConcretada,
          cps_moldados: input.cpsMoldados,
          horario_moldagem: input.horarioMoldagem,
          codigos_barras: input.codigosBarras,
          horario_registro: new Date().toISOString(),
        },
      });

    if (error) throw error;
    return { success: true };
  });

export const finalizeExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bookingId: z.string().uuid(),
    cpsMoldadosReal: z.number(),
    urlFotoFinal: z.string().nullable().optional(),
    urlFotoRetorno: z.string().nullable().optional(),
    horarioSaida: z.string().nullable().optional(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check technician
    const { data: tecnico } = await supabase
      .from("tecnicos")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!tecnico) {
      throw new Error("Acesso negado: Perfil de técnico não encontrado.");
    }

    // Fetch booking
    const { data: booking } = await supabase
      .from("agendamentos_medicoes")
      .select("id, horario_saida_lab, data_servico")
      .eq("id", input.bookingId)
      .single();

    if (!booking) throw new Error("Agendamento não encontrado.");

    // Count actual trucks (number of Ciclo_CP cycles)
    const { count: cycleCount } = await supabase
      .from("historico_fotos")
      .select("id", { count: "exact", head: true })
      .eq("agendamento_id", input.bookingId)
      .eq("tipo_foto", "Ciclo_CP");

    const totalCycles = (cycleCount || 0);

    // Insert final overview photo if provided
    if (input.urlFotoFinal) {
      await supabase
        .from("historico_fotos")
        .insert({
          agendamento_id: input.bookingId,
          tipo_foto: "Final_Panoramica",
          url_foto: input.urlFotoFinal,
          metadata: { horario_registro: new Date().toISOString() },
        });
    }

    // Insert return load photo if provided
    if (input.urlFotoRetorno) {
      await supabase
        .from("historico_fotos")
        .insert({
          agendamento_id: input.bookingId,
          tipo_foto: "Retorno_Carga",
          url_foto: input.urlFotoRetorno,
          metadata: { horario_registro: new Date().toISOString() },
        });
    }

    // Calculate overtime if actual checkout is provided
    let statusHE = "Sem_Horas_Extras";
    let extraMinutos = 0;
    const checkoutTime = input.horarioSaida || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    if (booking.horario_saida_lab) {
      const [pH, pM] = booking.horario_saida_lab.split(":").map(Number);
      const [aH, aM] = checkoutTime.split(":").map(Number);
      
      const plannedMin = pH * 60 + pM;
      let actualMin = aH * 60 + aM;
      
      if (actualMin < plannedMin && actualMin < 4 * 60) {
        // Assume crossed midnight if actual checkout is early morning (e.g. before 4am) and planned was afternoon/evening
        actualMin += 24 * 60;
      }
      
      const diff = actualMin - plannedMin;
      if (diff > 0) {
        extraMinutos = diff;
        statusHE = "Pendente_Aprovacao";
      }
    }

    // Update booking status, actual molded CPs count, real trucks count and overtime
    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        status_agendamento: "Aguardando_Medicao",
        cps_moldados_real: input.cpsMoldadosReal,
        qtd_caminhoes_real: totalCycles,
        horario_saida_real: checkoutTime,
        horas_extras_minutos: extraMinutos,
        status_horas_extras: statusHE,
        justificativa_reprovacao: null,
      })
      .eq("id", input.bookingId);

    if (error) throw error;
    return { success: true };
  });

export const validateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Allow validation by either admin or the client who created the booking
    const { data: booking, error: getErr } = await supabase
      .from("agendamentos_medicoes")
      .select("id, criado_por, cps_contratados, cps_moldados_real, valor_total, memoria_calculo, servico:servicos_catalogo_pub(valor_cp_excedente)")
      .eq("id", input.bookingId)
      .single();

    if (getErr || !booking) {
      throw new Error("Agendamento não encontrado.");
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes("admin");
    const isOwner = booking.criado_por === userId;

    if (!isAdmin && !isOwner) {
      throw new Error("Acesso negado: Você não tem permissão para validar este agendamento.");
    }

    const molded = booking.cps_moldados_real || 0;
    const contracted = booking.cps_contratados || 0;
    let novoTotal = Number(booking.valor_total) || 0;

    if (molded > contracted) {
      const excessCps = molded - contracted;
      const rate = Number((booking as any).servico?.valor_cp_excedente) || 0;
      if (rate > 0) {
        novoTotal += (excessCps * rate);
      }
    }

    // Update status to Validado
    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        status_agendamento: "Validado",
        valor_total: +novoTotal.toFixed(2),
        memoria_calculo: {
          ...(typeof booking.memoria_calculo === "object" && booking.memoria_calculo !== null ? booking.memoria_calculo : {}),
          cpsExcedentesRealizados: molded > contracted ? molded - contracted : 0,
          custoExcedenteRealizado: molded > contracted ? (molded - contracted) * (Number((booking as any).servico?.valor_cp_excedente) || 0) : 0,
          valorTotalComExcedente: +novoTotal.toFixed(2),
        } as any
      })
      .eq("id", input.bookingId);

    if (error) throw error;
    return { success: true };
  });

export const rejectBookingMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid(), justificativa: z.string().min(1) }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Allow rejection by either admin or the client who created the booking
    const { data: booking, error: getErr } = await supabase
      .from("agendamentos_medicoes")
      .select("id, criado_por")
      .eq("id", input.bookingId)
      .single();

    if (getErr || !booking) {
      throw new Error("Agendamento não encontrado.");
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes("admin");
    const isOwner = booking.criado_por === userId;

    if (!isAdmin && !isOwner) {
      throw new Error("Acesso negado: Você não tem permissão para reprovar este agendamento.");
    }

    // Update status to Em_Execucao and save the rejection justification
    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        status_agendamento: "Em_Execucao",
        justificativa_reprovacao: input.justificativa,
      })
      .eq("id", input.bookingId);

    if (error) throw error;
    return { success: true };
  });

export const syncUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Check if this user is in public.tecnicos
    const { data: tecnico, error: tecErr } = await supabase
      .from("tecnicos")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (tecErr) {
      console.error("Error querying tecnico profile during sync:", tecErr);
      return { roleSynced: null };
    }

    if (tecnico) {
      // Ensure the user has the 'tecnico' role in user_roles
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "tecnico" }, { onConflict: "user_id,role" });
      
      // Also sync profiles.tecnico_id to link it with the technician
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({ tecnico_id: tecnico.id })
        .eq("id", userId);
      
      if (profileErr) {
        console.error("Error updating profile with tecnico_id during sync:", profileErr);
      }

      if (roleErr) {
        console.error("Error inserting role during sync:", roleErr);
      } else {
        console.log(`Successfully synced 'tecnico' role and profile for user ${userId}`);
        return { roleSynced: "tecnico" };
      }
    }

    return { roleSynced: null };
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ alertId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes("admin");

    if (!isAdmin) {
      throw new Error("Acesso negado: Apenas administradores podem resolver alertas.");
    }

    const { error } = await supabase
      .from("alertas_gestao")
      .update({
        resolvido: true,
        resolvido_em: new Date().toISOString(),
      })
      .eq("id", input.alertId);

    if (error) throw error;
    return { success: true };
  });

export const requestBlocker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    dataInicio: z.string(),
    dataFim: z.string(),
    tipo: z.enum(['Medico', 'Folga', 'Problema_Veiculo', 'Outro']),
    descricao: z.string().nullable().optional(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Get technician profile
    const { data: tecnico } = await supabase
      .from("tecnicos")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!tecnico) {
      throw new Error("Acesso negado: Perfil de técnico não encontrado.");
    }

    const { error } = await supabase
      .from("bloqueios_tecnicos")
      .insert({
        tecnico_id: tecnico.id,
        data_inicio: input.dataInicio,
        data_fim: input.dataFim,
        tipo: input.tipo,
        descricao: input.descricao || null,
        status: 'Pendente'
      });

    if (error) throw error;
    return { success: true };
  });

export const updateBlockerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    blockerId: z.string().uuid(),
    status: z.enum(['Aprovado', 'Rejeitado'])
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes("admin");

    if (!isAdmin) {
      throw new Error("Acesso negado: Apenas administradores podem aprovar ou rejeitar bloqueios.");
    }

    const { error } = await supabase
      .from("bloqueios_tecnicos")
      .update({
        status: input.status,
        resolvido_em: new Date().toISOString(),
        resolvido_por: userId
      })
      .eq("id", input.blockerId);

    if (error) throw error;
    return { success: true };
  });

export const resolveMapsUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().url() }).parse(input))
  .handler(async ({ data: input }) => {
    try {
      const res = await fetch(input.url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      return { resolvedUrl: res.url };
    } catch (err: any) {
      console.error("Error resolving maps URL:", err);
      return { resolvedUrl: null };
    }
  });

// ── ABANDONO / TRANSFERÊNCIA ────────────────────────────────────────────────

export const abandonBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bookingId: z.string().uuid(),
    motivo: z.string().min(1).max(500),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Get technician profile
    const { data: tecnico } = await supabase
      .from("tecnicos")
      .select("id, ranking_score")
      .eq("user_id", userId)
      .single();

    if (!tecnico) throw new Error("Perfil de técnico não encontrado.");

    // Get the booking
    const { data: booking, error: bookingErr } = await supabase
      .from("agendamentos_medicoes")
      .select("id, tecnico_id, status_agendamento, data_servico, servico:servicos_catalogo_pub(categoria)")
      .eq("id", input.bookingId)
      .single();

    if (bookingErr || !booking) throw new Error("Agendamento não encontrado.");
    if (booking.tecnico_id !== tecnico.id) throw new Error("Acesso negado: este agendamento não pertence a você.");

    // Block abandonment if already in active execution
    if (booking.status_agendamento === "Em_Execucao") {
      throw new Error("Não é possível abandonar um serviço que já está em execução ativa. Contate o gestor.");
    }

    if (!["Confirmado", "Pendente_Tecnico"].includes(booking.status_agendamento)) {
      throw new Error("Só é possível transferir agendamentos com status Confirmado.");
    }

    // Load configuration for penalty window
    const { data: config } = await supabase
      .from("configuracoes_agendamento")
      .select("janela_abandono_horas, penalidade_abandono")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const janelaHoras: number = config?.janela_abandono_horas ?? 24;
    const penalidade: number = config?.penalidade_abandono ?? 0.5;

    // Check if within penalty window
    const serviceDateTime = new Date(booking.data_servico + "T00:00:00");
    const hoursUntilService = (serviceDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const applyPenalty = hoursUntilService < janelaHoras;

    // Apply penalty if too close to service date
    if (applyPenalty) {
      const currentScore = Number(tecnico.ranking_score) || 5.0;
      const newScore = Math.max(0, currentScore - penalidade);
      await supabase
        .from("tecnicos")
        .update({ ranking_score: newScore })
        .eq("id", tecnico.id);
    }

    // Clear technician from booking and reset to pending
    const { error: updateErr } = await supabase
      .from("agendamentos_medicoes")
      .update({
        tecnico_id: null,
        status_agendamento: "Pendente_Tecnico",
        convidado_em: null,
        abandonado_por: tecnico.id,
        motivo_abandono: input.motivo,
        realocado_em: new Date().toISOString(),
      })
      .eq("id", input.bookingId);

    if (updateErr) throw updateErr;

    // Reallocate to next best technician (exclude the one who just abandoned)
    try {
      const serviceCategory = (booking.servico as any)?.categoria || "";
      await selectAndInviteTechnician(
        supabase,
        input.bookingId,
        booking.data_servico,
        serviceCategory,
        [tecnico.id]
      );
    } catch (reallocErr) {
      console.error("Erro ao realocar após abandono:", reallocErr);
      // Non-fatal: booking stays as Pendente_Tecnico for manual admin action
    }

    return {
      success: true,
      penaltyApplied: applyPenalty,
      penaltyAmount: applyPenalty ? penalidade : 0,
    };
  });

// Fix variable name typo in abandonBooking (horasUntilService should be hoursUntilService)
// Note: horasUntilService is a reference to hoursUntilService — handled by closure.

// ── CONFIGURAÇÕES DE AGENDAMENTO ────────────────────────────────────────────

export const getAgendamentoSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("configuracoes_agendamento")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Return defaults if no config exists
    return data ?? {
      janela_abandono_horas: 24,
      penalidade_abandono: 0.5,
      tempo_aceite_convite_horas: 3,
      antecedencia_minima_horas: 48,
      prioridade_ranking: true,
    };
  });

export const saveAgendamentoSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    janela_abandono_horas: z.number().int().min(1).max(168),
    penalidade_abandono: z.number().min(0).max(5),
    tempo_aceite_convite_horas: z.number().int().min(1).max(48),
    antecedencia_minima_horas: z.number().int().min(1).max(168),
    prioridade_ranking: z.boolean(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem alterar configurações.");

    // Upsert config (always replace the single config row)
    const { data: existing } = await supabase
      .from("configuracoes_agendamento")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("configuracoes_agendamento")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("configuracoes_agendamento")
        .insert({ ...input });
    }

    return { success: true };
  });

// ── AVALIAÇÕES DE TÉCNICOS ──────────────────────────────────────────────────

export const submitTechnicianRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bookingId: z.string().uuid(),
    tecnicoId: z.string().uuid(),
    notaComunicacao: z.number().min(1).max(5),
    notaConhecimentoTecnico: z.number().min(1).max(5),
    notaPontualidade: z.number().min(1).max(5),
    notaLimpezaMateriais: z.number().min(1).max(5),
    notaOrganizacaoTrabalho: z.number().min(1).max(5),
    comentario: z.string().max(1000).optional().nullable(),
    tipoAvaliador: z.enum(["cliente", "gestor"]),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check if already rated this booking
    const { data: existing } = await supabase
      .from("avaliacoes_tecnicos")
      .select("id")
      .eq("agendamento_id", input.bookingId)
      .eq("avaliador_id", userId)
      .maybeSingle();

    if (existing) {
      throw new Error("Você já avaliou este atendimento.");
    }

    const avgNota = +(
      (input.notaComunicacao +
        input.notaConhecimentoTecnico +
        input.notaPontualidade +
        input.notaLimpezaMateriais +
        input.notaOrganizacaoTrabalho) /
      5
    ).toFixed(2);

    // Insert rating
    const { error } = await supabase
      .from("avaliacoes_tecnicos")
      .insert({
        tecnico_id: input.tecnicoId,
        agendamento_id: input.bookingId,
        avaliador_id: userId,
        tipo_avaliador: input.tipoAvaliador,
        nota: avgNota,
        comentario: input.comentario || null,
        nota_comunicacao: input.notaComunicacao,
        nota_conhecimento_tecnico: input.notaConhecimentoTecnico,
        nota_pontualidade: input.notaPontualidade,
        nota_limpeza_materiais: input.notaLimpezaMateriais,
        nota_organizacao_trabalho: input.notaOrganizacaoTrabalho,
      });

    if (error) throw error;

    // Recalculate technician average score from all ratings
    const { data: allRatings } = await supabase
      .from("avaliacoes_tecnicos")
      .select("nota")
      .eq("tecnico_id", input.tecnicoId);

    if (allRatings && allRatings.length > 0) {
      const avg = allRatings.reduce((sum: number, r: any) => sum + Number(r.nota), 0) / allRatings.length;
      await supabase
        .from("tecnicos")
        .update({ ranking_score: +avg.toFixed(2) })
        .eq("id", input.tecnicoId);
    }

    return { success: true };
  });

export const getTechnicianRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("avaliacoes_tecnicos")
      .select("*, tecnico:tecnicos(nome, ranking_score), agendamento:agendamentos_medicoes(codigo_pedido, data_servico)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });

export const saveServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid().optional(),
    sku: z.string().min(1),
    nome_servico: z.string().min(1),
    unidade: z.string().min(1),
    valor_custo_base: z.number().min(0),
    valor_venda_editavel: z.number().min(0),
    equipamentos_inclusos: z.array(z.string()).optional(),
    categoria: z.string().min(1),
    ativo: z.boolean().default(true),
    descricao: z.string().optional(),
    tipo_cobranca: z.string().default("Por Execucao"),
    formas_pagamento_aceitas: z.array(z.string()).default(["PIX", "Boleto", "Cartao"]),
    regra_minimo_a_vista: z.number().default(1000.00),
    valor_cp_excedente: z.number().default(0.00)
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem gerenciar serviços.");

    const row = {
      sku: input.sku,
      nome_servico: input.nome_servico,
      unidade: input.unidade,
      valor_custo_base: input.valor_custo_base,
      valor_venda_editavel: input.valor_venda_editavel,
      equipamentos_inclusos: input.equipamentos_inclusos || [],
      categoria: input.categoria,
      ativo: input.ativo,
      descricao: input.descricao || null,
      tipo_cobranca: input.tipo_cobranca,
      formas_pagamento_aceitas: input.formas_pagamento_aceitas,
      regra_minimo_a_vista: input.regra_minimo_a_vista,
      valor_cp_excedente: input.valor_cp_excedente
    };

    if (input.id) {
      const { data, error } = await supabase
        .from("servicos_catalogo")
        .update(row)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } else {
      const { data, error } = await supabase
        .from("servicos_catalogo")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    }
  });

export const saveServicoPrecoCidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid().optional(),
    servicoId: z.string().uuid(),
    cidadeId: z.string().uuid(),
    valorFixo: z.number().min(0),
    limiteUnidades: z.number().int().min(1).default(50)
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem gerenciar precificação por cidade.");

    const row = {
      servico_id: input.servicoId,
      cidade_id: input.cidadeId,
      valor_fixo: input.valorFixo,
      limite_unidades: input.limiteUnidades
    };

    if (input.id) {
      const { error } = await supabase
        .from("servicos_precos_cidades")
        .update(row)
        .eq("id", input.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("servicos_precos_cidades")
        .upsert(row, { onConflict: "servico_id,cidade_id" });
      if (error) throw error;
    }

    return { success: true };
  });

export const calculateBookingPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    servicoId: z.string().uuid(),
    cidadeId: z.string().uuid().optional().nullable(),
    quantidade: z.number().min(0)
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase } = context;

    // 1. Fetch service details
    const { data: servico, error: sError } = await supabase
      .from("servicos_catalogo_pub")
      .select("*")
      .eq("id", input.servicoId)
      .single();

    if (sError || !servico) throw new Error("Serviço não encontrado.");

    if (!input.cidadeId) {
      return {
        success: true,
        valorTotal: 0,
        requireManualQuote: true,
        reason: "Cidade não selecionada ou não atendida."
      };
    }

    // 2. Fetch city custom price
    const { data: precoCidade, error: pError } = await supabase
      .from("servicos_precos_cidades")
      .select("*")
      .eq("servico_id", input.servicoId)
      .eq("cidade_id", input.cidadeId)
      .maybeSingle();

    if (pError || !precoCidade) {
      return {
        success: true,
        valorTotal: 0,
        requireManualQuote: true,
        reason: "Cidade sem preço fixo cadastrado para este serviço."
      };
    }

    // 3. Check quantity limit
    if (input.quantidade > precoCidade.limite_unidades) {
      return {
        success: true,
        valorTotal: 0,
        requireManualQuote: true,
        reason: `A quantidade de CPs/unidades (${input.quantidade}) ultrapassa o limite máximo (${precoCidade.limite_unidades}) estabelecido para preço fixo nesta cidade.`
      };
    }

    // 4. Calculate total price based on charging type
    let valorTotal = 0;
    if (servico.tipo_cobranca === "Por Unidade" || servico.tipo_cobranca === "Por Hora") {
      valorTotal = Number(precoCidade.valor_fixo) * input.quantidade;
    } else {
      // Por Execucao (flat fee)
      valorTotal = Number(precoCidade.valor_fixo);
    }

    // 5. Check if it requires upfront payment
    const requireUpfrontPayment = valorTotal < Number(servico.regra_minimo_a_vista);

    return {
      success: true,
      valorTotal,
      requireManualQuote: false,
      requireUpfrontPayment,
      formasPagamento: servico.formas_pagamento_aceitas,
      regraMinimo: servico.regra_minimo_a_vista
    };
  });

export const saveCidadeAtendida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid().optional(),
    nomeCidade: z.string().min(1),
    mobilizacaoBase: z.number().min(0),
    pedagioEstimado: z.number().min(0),
    minutosDeslocamento: z.number().int().min(0),
    isBase: z.boolean().default(false)
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem gerenciar cidades.");

    const row = {
      nome_cidade: input.nomeCidade,
      mobilizacao_base: input.mobilizacaoBase,
      pedagio_estimado: input.pedagioEstimado,
      minutos_deslocamento: input.minutosDeslocamento,
      is_base: input.isBase
    };

    if (input.id) {
      const { error } = await supabase
        .from("cidades_atendidas")
        .update(row)
        .eq("id", input.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("cidades_atendidas")
        .insert(row);
      if (error) throw error;
    }

    return { success: true };
  });

export const deleteCidadeAtendida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    cidadeId: z.string().uuid()
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem gerenciar cidades.");

    const { error } = await supabase
      .from("cidades_atendidas")
      .delete()
      .eq("id", input.cidadeId);

    if (error) throw error;
    return { success: true };
  });

export const saveGlobalSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    eficiencia_cp: z.number().min(0).max(100),
    coeficiente_he: z.number().min(1).max(5),
    prazo_faturamento_dias: z.number().int().min(1)
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem alterar configurações globais.");

    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "configuracoes_globais",
        value: input as any,
        descricao: "Configurações globais da plataforma (eficiência CPs, HE e faturamento)"
      }, { onConflict: "key" });

    if (error) throw error;
    return { success: true };
  });

export const getFinancialSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem ver dados financeiros.");

    const { data: bookings, error } = await supabase
      .from("agendamentos_medicoes")
      .select("id, codigo_pedido, data_servico, valor_total, status_pagamento, status_agendamento, servico_id, empresa_id, empresa:empresas_clientes(id, razao_social), servico:servicos_catalogo_pub(id, nome_servico, sku)");

    if (error) throw error;

    let totalFaturado = 0;
    let totalPendente = 0;
    const porCliente: Record<string, { cliente: string; total: number; pendente: number }> = {};

    (bookings || []).forEach((b: any) => {
      const val = Number(b.valor_total) || 0;
      const rSocial = b.empresa?.razao_social || "Empresa Desconhecida";
      const empId = b.empresa?.id || "unknown";

      if (b.status_pagamento === "Pago") {
        totalFaturado += val;
      } else {
        totalPendente += val;
      }

      if (!porCliente[empId]) {
        porCliente[empId] = { cliente: rSocial, total: 0, pendente: 0 };
      }

      if (b.status_pagamento === "Pago") {
        porCliente[empId].total += val;
      } else {
        porCliente[empId].pendente += val;
      }
    });

    return {
      success: true,
      totalFaturado,
      totalPendente,
      porCliente: Object.values(porCliente),
      bookings: bookings || []
    };
  });

export const deleteObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ obraId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Verify if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");

    // Fetch the obra to verify existence and check company ownership
    const { data: obra, error: obraErr } = await supabase
      .from("obras")
      .select("id, empresa_id")
      .eq("id", input.obraId)
      .maybeSingle();

    if (obraErr || !obra) {
      throw new Error("Obra não encontrada.");
    }

    if (!isAdmin) {
      // Check if client belongs to the same company
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .maybeSingle();
      if (!profile || profile.empresa_id !== obra.empresa_id) {
        throw new Error("Acesso negado: você não tem permissão para excluir esta obra.");
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Check if there are any agendamentos linked to this obra
    const { data: bookings, error: queryErr } = await supabaseAdmin
      .from("agendamentos_medicoes")
      .select("id, status_agendamento")
      .eq("obra_id", input.obraId);

    if (queryErr) throw queryErr;

    if (bookings && bookings.length > 0) {
      // Check if there are any active or completed agendamentos
      const hasActiveOrCompleted = bookings.some(
        (b: any) => b.status_agendamento !== "Cancelado"
      );

      if (hasActiveOrCompleted) {
        throw new Error("Não é possível excluir esta obra pois existem agendamentos ativos ou concluídos vinculados a ela. Reassocie os agendamentos antes de excluí-la.");
      }

      // If all are Cancelado, delete the cancelled bookings first
      const bookingIds = bookings.map((b: any) => b.id);
      const { error: delBookingsErr } = await supabaseAdmin
        .from("agendamentos_medicoes")
        .delete()
        .in("id", bookingIds);

      if (delBookingsErr) throw delBookingsErr;
    }

    // 2. Now delete the obra
    const { error: delObraErr } = await supabaseAdmin
      .from("obras")
      .delete()
      .eq("id", input.obraId);

    if (delObraErr) throw delObraErr;

    return { success: true };
  });

export const approveTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check permissions
    const { data: booking } = await supabase
      .from("agendamentos_medicoes")
      .select("id, status_agendamento, empresa_id")
      .eq("id", input.bookingId)
      .single();

    if (!booking) throw new Error("Agendamento não encontrado.");
    if (booking.status_agendamento !== "Pendente_Aprovacao_Gestor") {
      throw new Error("Agendamento não está pendente de aprovação do gestor.");
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .single();
      if (!profile || profile.empresa_id !== booking.empresa_id) {
        throw new Error("Acesso negado: você não tem permissão para aprovar este técnico.");
      }
    }

    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({ status_agendamento: "Confirmado" })
      .eq("id", input.bookingId);

    if (error) throw error;
    return { success: true };
  });

export const reallocateTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check permissions
    const { data: booking } = await supabase
      .from("agendamentos_medicoes")
      .select("*, servico:servicos_catalogo_pub(*)")
      .eq("id", input.bookingId)
      .single();

    if (!booking) throw new Error("Agendamento não encontrado.");

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .single();
      if (!profile || profile.empresa_id !== booking.empresa_id) {
        throw new Error("Acesso negado: você não tem permissão para remanejar este agendamento.");
      }
    }

    // Add current technician to rejected lists to avoid inviting them again immediately
    const currentRejected = booking.tecnicos_rejeitados || [];
    const newRejected = [...new Set([...currentRejected, booking.tecnico_id])].filter(Boolean);

    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        tecnico_id: null,
        convidado_em: null,
        status_agendamento: "Pendente_Tecnico",
        tecnicos_rejeitados: newRejected,
      })
      .eq("id", input.bookingId);

    if (error) throw error;

    // Re-trigger allocation algorithm
    await selectAndInviteTechnician(
      supabase,
      booking.id,
      booking.data_servico,
      booking.servico?.categoria || "",
      newRejected
    );

    return { success: true };
  });

export const approveOvertime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bookingId: z.string().uuid(),
    approved: z.boolean(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Check permissions
    const { data: booking } = await supabase
      .from("agendamentos_medicoes")
      .select("*")
      .eq("id", input.bookingId)
      .single();

    if (!booking) throw new Error("Agendamento não encontrado.");
    if (booking.status_horas_extras !== "Pendente_Aprovacao") {
      throw new Error("Não há solicitação de horas extras pendente de aprovação para este agendamento.");
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .single();
      if (!profile || profile.empresa_id !== booking.empresa_id) {
        throw new Error("Acesso negado: você não tem permissão para responder a esta solicitação.");
      }
    }

    if (input.approved) {
      // Calculate overtime cost
      // Weekdays: R$150/h, Saturdays (day 6): R$200/h
      const serviceDate = new Date(`${booking.data_servico}T00:00:00`);
      const dow = serviceDate.getDay();
      const hourlyRate = dow === 6 ? 200 : 150;
      const extraCost = +( (booking.horas_extras_minutos / 60) * hourlyRate ).toFixed(2);

      const novoTotal = +(Number(booking.valor_total) + extraCost).toFixed(2);

      const { error } = await supabase
        .from("agendamentos_medicoes")
        .update({
          status_horas_extras: "Aprovado",
          valor_total: novoTotal,
          memoria_calculo: {
            ...(booking.memoria_calculo as any),
            horasExtrasAprovadas: true,
            custoExtraRealizado: extraCost,
            valorTotalComExtra: novoTotal,
          }
        })
        .eq("id", input.bookingId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("agendamentos_medicoes")
        .update({
          status_horas_extras: "Reprovado",
        })
        .eq("id", input.bookingId);

      if (error) throw error;
    }

    return { success: true };
  });

export const updateCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    empresaId: z.string().uuid(),
    requerAprovacaoTecnico: z.boolean(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Verify if user is admin or is manager of the company
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .single();
      if (!profile || profile.empresa_id !== input.empresaId) {
        throw new Error("Acesso negado: você não tem permissão para alterar as configurações desta empresa.");
      }
    }

    const { error } = await supabase
      .from("empresas_clientes")
      .update({
        requer_aprovacao_tecnico: input.requerAprovacaoTecnico,
      })
      .eq("id", input.empresaId);

    if (error) throw error;
    return { success: true };
  });

export const allocateTechnicianManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    bookingId: z.string().uuid(),
    tecnicoId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores podem alocar técnicos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Update booking to Confirmado with the allocated technician
    const { error } = await supabaseAdmin
      .from("agendamentos_medicoes")
      .update({
        tecnico_id: input.tecnicoId,
        status_agendamento: "Confirmado",
        convidado_em: new Date().toISOString(),
      })
      .eq("id", input.bookingId);

    if (error) throw error;

    // Notify technician via WhatsApp
    try {
      const { data: tecnico } = await supabaseAdmin
        .from("tecnicos")
        .select("nome, user_id")
        .eq("id", input.tecnicoId)
        .single();
        
      if (tecnico?.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("telefone")
          .eq("id", tecnico.user_id)
          .single();
          
        if (profile?.telefone) {
          const { data: booking } = await supabaseAdmin
            .from("agendamentos_medicoes")
            .select("codigo_pedido, data_servico, horario_na_obra, obra:obras(nome_obra, endereco)")
            .eq("id", input.bookingId)
            .single();
            
          if (booking) {
            const messageText = 
              `📅 *Quantis Obras - Nova Escala Confirmada*\n\n` +
              `Olá, *${tecnico.nome}*!\n` +
              `Você foi escalado para um novo serviço.\n\n` +
              `📝 *Código do Pedido:* ${booking.codigo_pedido}\n` +
              `📅 *Data:* ${new Date(booking.data_servico + "T00:00:00").toLocaleDateString("pt-BR")}\n` +
              `⏰ *Horário na Obra:* ${booking.horario_na_obra?.substring(0, 5)}\n` +
              `🏗️ *Obra:* ${(booking.obra as any)?.nome_obra}\n` +
              `📍 *Endereço:* ${(booking.obra as any)?.endereco}\n\n` +
              `Por favor, acesse seu painel para mais detalhes. Bom trabalho!`;
              
            await sendServerWhatsappMessage(profile.telefone, messageText);
          }
        }
      }
    } catch (notifErr) {
      console.error("Erro ao notificar técnico por WhatsApp:", notifErr);
    }

    return { success: true };
  });

async function sendServerWhatsappMessage(number: string, text: string) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiToken = process.env.EVOLUTION_API_TOKEN;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

  let cleanNumber = number.replace(/\D/g, "");
  if (cleanNumber.length === 11 || cleanNumber.length === 10) {
    cleanNumber = "55" + cleanNumber;
  }

  if (!apiUrl || !apiToken || !instanceName) {
    console.warn("[Evolution API Backend] Simulation mode — credentials not set. Would send to", cleanNumber, text);
    return;
  }

  try {
    const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${instanceName}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiToken },
      body: JSON.stringify({ number: cleanNumber, text, delay: 1200, linkPreview: true }),
    });
  } catch (error) {
    console.error("[Evolution API Backend] Exception:", error);
  }
}





