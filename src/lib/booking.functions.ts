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
      .select("mobilizacao_base, pedagio_estimado")
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
      const { data: servicoPub } = await supabase
        .from("servicos_catalogo_pub")
        .select("id, valor_venda_editavel, ativo, categoria, nome_servico")
        .eq("id", selectedSvc.servico_id)
        .single();

      if (!servicoPub || !servicoPub.ativo) {
        throw new Error("Serviço inválido ou inativo: " + selectedSvc.servico_id);
      }

      const servicePrice = Number(servicoPub.valor_venda_editavel) || 0;
      const serviceCategory = servicoPub.categoria || "";
      const nomeServico = servicoPub.nome_servico || "";

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
        rawServiceCost = cpsContratados * servicePrice;
      } else if (isArrancamento && selectedSvc.qtd_ensaios && selectedSvc.pontos_por_ensaio) {
        const totalPoints = selectedSvc.qtd_ensaios * selectedSvc.pontos_por_ensaio;
        cpsContratados = totalPoints;
        rawServiceCost = totalPoints * servicePrice;
      } else {
        const qty = selectedSvc.quantidade || 1;
        cpsContratados = qty;
        rawServiceCost = qty * servicePrice;
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
      .select("id, codigo_pedido, valor_total, servico:servicos_catalogo(categoria)");

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
    return (
      t.certificacoes.toLowerCase().includes(serviceCategory.toLowerCase()) ||
      serviceCategory.toLowerCase().includes("concreto")
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

  const busyTecnicoIds = new Set((bookingsOnDate || []).map((b: any) => b.tecnico_id));
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

export const acceptInvite = createServerFn({ method: "POST" })
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
      .select("id, tecnico_id, status_agendamento")
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

    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        status_agendamento: "Confirmado",
      })
      .eq("id", input.bookingId);

    if (error) throw error;
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
      .select("*, servico:servicos_catalogo(*)")
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

export const processTimeouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data: timedOutBookings } = await supabase
      .from("agendamentos_medicoes")
      .select("*, servico:servicos_catalogo(*)")
      .eq("status_agendamento", "Pendente_Tecnico")
      .not("tecnico_id", "is", null)
      .lt("convidado_em", threeHoursAgo);

    if (!timedOutBookings || timedOutBookings.length === 0) {
      return { processed: 0 };
    }

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
    }

    return { processed: timedOutBookings.length };
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
    certificacoes: z.string().nullable().optional(),
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
      .upsert({ user_id: newUserId, role: "tecnico" }, { onConflict: "user_id" });

    if (roleUpdateErr) {
      console.error("Error setting technician role:", roleUpdateErr);
    }

    // Insert into 'tecnicos' table
    const { data: newTecnico, error: tecErr } = await supabaseAdmin
      .from("tecnicos")
      .insert({
        nome: input.nome,
        cpf: input.cpf || null,
        rg: input.rg || null,
        certificacoes: input.certificacoes || null,
        status: "Disponivel",
        ranking_score: 5.0,
        user_id: newUserId,
      })
      .select("id")
      .single();

    if (tecErr || !newTecnico) {
      throw new Error("Erro ao cadastrar perfil técnico: " + (tecErr?.message || "Erro desconhecido"));
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

export const startExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
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

    // Update booking status and actual molded CPs count
    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        status_agendamento: "Aguardando_Medicao",
        cps_moldados_real: input.cpsMoldadosReal,
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
      throw new Error("Acesso negado: Você não tem permissão para validar este agendamento.");
    }

    // Update status to Validado
    const { error } = await supabase
      .from("agendamentos_medicoes")
      .update({
        status_agendamento: "Validado",
      })
      .eq("id", input.bookingId);

    if (error) throw error;
    return { success: true };
  });
