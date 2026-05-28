
# Geraltest Brasil — PWA de Controle Tecnológico

App web responsivo (instalável) com 3 personas (Cliente, Técnico, Admin), motor de orçamento, escalonamento de técnicos com gamificação e travas operacionais. Backend em **Lovable Cloud** (Postgres + Auth + Storage + server functions).

Pelo tamanho do escopo, proponho **entregar em 4 fases** para você validar a cada passo, em vez de despejar tudo numa única build (que seria difícil de revisar e provavelmente teria regressões).

---

## Fase 1 — Fundação (Cloud + Schema + Auth + Design System)

1. Habilitar Lovable Cloud.
2. Migrations Postgres com todas as tabelas pedidas:
   - `empresas_clientes`, `obras`, `servicos_catalogo`, `cidades_atendidas`,
     `tecnicos`, `agendamentos_medicoes`, `historico_fotos`.
   - + `profiles` (vínculo `auth.users`), `user_roles` (`cliente | tecnico | admin`) via enum,
     `app_settings` (chave/valor — coeficiente HE, default eficiência CPs = 70,
     limite caminhões/técnico = 12, desconto PIX/Cartão = 5%, valor mínimo R$ 1.750, imposto 12%, limite 10 diárias/mês/CNPJ, janela aceitação 60min).
   - Triggers: auto-criar profile no signup, atualizar `total_servicos_concluidos`
     no CNPJ ao validar medição (libera regras de boleto).
   - RLS em todas as tabelas + `has_role()` security definer.
   - GRANTs explícitos (authenticated/service_role).
3. Auth: email/senha + Google. Tela de login, signup com seleção de persona
   (admin é promovido manualmente via painel).
4. Design system em `src/styles.css` (oklch). Paleta industrial/técnica (azul profundo + âmbar de alerta + neutros), tipografia legível (Inter), tokens semânticos completos, componentes Shadcn customizados.
5. Configuração PWA mínima (manifest + ícones — **sem service worker** por padrão, para não quebrar o preview do Lovable).
6. Seed do catálogo (serviços principais: moldagem CP, ensaios concreto fresco/endurecido, ensaios de solo) e cidades base (Sorocaba, Votorantim, Itu, Salto, Boituva) com mobilização/pedágio.

## Fase 2 — Cliente + Motor de Orçamento

1. Dashboard cliente: calendário + lista de "Medições Pendentes".
2. Wizard de agendamento (Categoria → Serviço → Volume M³ → Qtd caminhões → idades 7/14/28/63 → endereço/obra com GPS).
3. **Motor de cálculo (server function)** com toda a lógica:
   - CPs contratados = caminhões × idades × 2.
   - Escalonamento técnicos: ceil(caminhões/12) ou ceil(CPs/eficiência) — o maior.
   - Cálculo retroativo da jornada (horário na obra − tempo deslocamento da cidade).
   - Adicional de mobilização + pedágio por cidade.
   - Trava de mínimo R$ 1.750 (Sorocaba/Votorantim, escopo ≤ 50 CPs / 1 diária / 1 coleta).
   - Imposto 12% sobre faturamento.
   - Desconto 5% PIX/Cartão.
   - Trava de boleto por CNPJ (0→bloqueado, ≥3 serviços→14d, ≥5 serviços→28d).
   - Trava de 10 diárias/mês/CNPJ → checkout bloqueia e gera link WhatsApp pré-formatado para Thais.
4. Checkout transparente com memória de cálculo linha-a-linha.
5. Pós-aceite: card do técnico alocado (nome, RG, CPF, foto) para portaria.
6. Tela de validação diária com foto panorâmica + CPs reais, botão "Validar Medição".

## Fase 3 — Técnico de Campo

1. Tela de convite com **cronômetro regressivo de 60min** e botão Aceitar.
2. Check-in QR Code (simulado) + checklist de equipamentos embarcados.
3. Check-in na obra com **gate de GPS** (raio configurável do endereço).
4. Tela de execução: escopo + botão "Anexar foto do ciclo" (a cada 2 CPs), upload para Lovable Cloud Storage.
5. Fechamento do dia: CPs reais moldados + foto panorâmica.
6. Rotina de retorno: foto CPs no carro + relatório para expedição.
7. Atualiza `horario_fim_ultimo_servico` (alimenta trava 11h).

## Fase 4 — Admin/Gestor + Algoritmo de Atribuição

1. **Algoritmo de atribuição** (server function, roda no `confirmado pagamento`):
   - Filtra técnicos qualificados, disponíveis, com ≥11h de descanso interjornada.
   - Fluxo padrão: notifica top-3 por `ranking_score` (Realtime).
   - Emergência mesmo-dia: top-2.
   - Timeout 60min → reatribui sequencialmente.
2. Dashboard gerencial em grid (ensaios do dia × técnicos × obras).
3. Alertas visuais (banco de horas, risco 11h).
4. CRUD completo: serviços/SKU, cidades+custos, técnicos, empresas, configurações globais (coef HE útil/fim de semana, eficiência CPs, etc.).
5. Visão de fechamento mensal por CNPJ.

---

## Decisões técnicas

- **Backend**: 100% server functions TanStack Start (`createServerFn`) + Supabase (Lovable Cloud). Sem Edge Functions.
- **Cálculo**: centralizado em `src/lib/pricing.functions.ts` para garantir consistência cliente/admin e ser auditável.
- **Realtime**: Supabase Realtime para notificar técnicos e atualizar dashboards.
- **Storage**: bucket privado `field-photos` com RLS por agendamento.
- **PWA**: somente manifest (instalável). Sem service worker (incompatível com preview).
- **WhatsApp**: link `wa.me` com texto pré-formatado, sem integração de API.

## Perguntas para destravar a Fase 1

1. **Número da Thais** para o link WhatsApp (posso usar placeholder e você troca depois)?
2. **Logo/identidade visual** da Geraltest — você anexa, ou gero uma marca-conceito?
3. Posso seguir com **paleta azul-profundo + âmbar** ou prefere outra direção visual?

---

Confirma o plano e respondo as 3 perguntas acima para eu começar pela **Fase 1**? Se preferir, posso já iniciar a Fase 1 com placeholders nessas decisões e você ajusta depois.
