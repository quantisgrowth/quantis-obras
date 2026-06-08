export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos_medicoes: {
        Row: {
          codigo_pedido: string
          cps_contratados: number
          cps_moldados_real: number | null
          created_at: string
          criado_por: string | null
          data_servico: string
          diarias_necessarias: number
          empresa_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          horario_na_obra: string
          horario_saida_lab: string | null
          id: string
          idades_cp: Json | null
          idades_selecionadas: number[]
          memoria_calculo: Json | null
          obra_id: string
          observacoes: string | null
          qtd_caminhoes: number
          servico_id: string
          status_agendamento: Database["public"]["Enums"]["agendamento_status"]
          status_pagamento: Database["public"]["Enums"]["pagamento_status"]
          tecnico_id: string | null
          convidado_em: string | null
          tecnicos_rejeitados: string[]
          updated_at: string
          valor_desconto: number
          valor_imposto_12: number
          valor_subtotal: number
          valor_total: number
          volume_m3: number
          is_orcamento_manual: boolean
          orcamento_aprovado: boolean
          qtd_caminhoes_real: number | null
          horario_saida_real: string | null
          horas_extras_minutos: number
          status_horas_extras: string
        }
        Insert: {
          codigo_pedido?: string
          cps_contratados?: number
          cps_moldados_real?: number | null
          created_at?: string
          criado_por?: string | null
          data_servico: string
          diarias_necessarias?: number
          empresa_id: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          horario_na_obra: string
          horario_saida_lab?: string | null
          id?: string
          idades_cp?: Json | null
          idades_selecionadas?: number[]
          memoria_calculo?: Json | null
          obra_id: string
          observacoes?: string | null
          qtd_caminhoes?: number
          servico_id: string
          status_agendamento?: Database["public"]["Enums"]["agendamento_status"]
          status_pagamento?: Database["public"]["Enums"]["pagamento_status"]
          tecnico_id?: string | null
          convidado_em?: string | null
          tecnicos_rejeitados?: string[]
          updated_at?: string
          valor_desconto?: number
          valor_imposto_12?: number
          valor_subtotal?: number
          valor_total?: number
          volume_m3?: number
          is_orcamento_manual?: boolean
          orcamento_aprovado?: boolean
          qtd_caminhoes_real?: number | null
          horario_saida_real?: string | null
          horas_extras_minutos?: number
          status_horas_extras?: string
        }
        Update: {
          codigo_pedido?: string
          cps_contratados?: number
          cps_moldados_real?: number | null
          created_at?: string
          criado_por?: string | null
          data_servico?: string
          diarias_necessarias?: number
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          horario_na_obra?: string
          horario_saida_lab?: string | null
          id?: string
          idades_cp?: Json | null
          idades_selecionadas?: number[]
          memoria_calculo?: Json | null
          obra_id?: string
          observacoes?: string | null
          qtd_caminhoes?: number
          servico_id?: string
          status_agendamento?: Database["public"]["Enums"]["agendamento_status"]
          status_pagamento?: Database["public"]["Enums"]["pagamento_status"]
          tecnico_id?: string | null
          convidado_em?: string | null
          tecnicos_rejeitados?: string[]
          updated_at?: string
          valor_desconto?: number
          valor_imposto_12?: number
          valor_subtotal?: number
          valor_total?: number
          volume_m3?: number
          is_orcamento_manual?: boolean
          orcamento_aprovado?: boolean
          qtd_caminhoes_real?: number | null
          horario_saida_real?: string | null
          horas_extras_minutos?: number
          status_horas_extras?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_medicoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_medicoes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_medicoes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_catalogo_pub"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_medicoes_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_medicoes_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos_pub"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          descricao: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          descricao?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          descricao?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      cidades_atendidas: {
        Row: {
          created_at: string
          id: string
          is_base: boolean
          minutos_deslocamento: number
          mobilizacao_base: number
          nome_cidade: string
          pedagio_estimado: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_base?: boolean
          minutos_deslocamento?: number
          mobilizacao_base?: number
          nome_cidade: string
          pedagio_estimado?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_base?: boolean
          minutos_deslocamento?: number
          mobilizacao_base?: number
          nome_cidade?: string
          pedagio_estimado?: number
        }
        Relationships: []
      }
      empresas_clientes: {
        Row: {
          cnpj: string
          created_at: string
          diarias_mes_atual: number
          id: string
          mes_referencia: string
          razao_social: string
          total_servicos_concluidos: number
          requer_aprovacao_tecnico: boolean
        }
        Insert: {
          cnpj: string
          created_at?: string
          diarias_mes_atual?: number
          id?: string
          mes_referencia?: string
          razao_social: string
          total_servicos_concluidos?: number
          requer_aprovacao_tecnico?: boolean
        }
        Update: {
          cnpj?: string
          created_at?: string
          diarias_mes_atual?: number
          id?: string
          mes_referencia?: string
          razao_social?: string
          total_servicos_concluidos?: number
          requer_aprovacao_tecnico?: boolean
        }
        Relationships: []
      }
      historico_fotos: {
        Row: {
          agendamento_id: string
          created_at: string
          id: string
          metadata: Json | null
          tipo_foto: Database["public"]["Enums"]["foto_tipo"]
          url_foto: string
        }
        Insert: {
          agendamento_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tipo_foto: Database["public"]["Enums"]["foto_tipo"]
          url_foto: string
        }
        Update: {
          agendamento_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tipo_foto?: Database["public"]["Enums"]["foto_tipo"]
          url_foto?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_fotos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos_medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_tecnicos: {
        Row: {
          id: string
          tecnico_id: string
          nome_documento: string
          url_documento: string
          created_at: string
        }
        Insert: {
          id?: string
          tecnico_id: string
          nome_documento: string
          url_documento: string
          created_at?: string
        }
        Update: {
          id?: string
          tecnico_id?: string
          nome_documento?: string
          url_documento?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_tecnicos_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          }
        ]
      }
      habilidades_tecnicos: {
        Row: {
          id: string
          tecnico_id: string
          servico_id: string
          nivel_conhecimento: number
          created_at: string
        }
        Insert: {
          id?: string
          tecnico_id: string
          servico_id: string
          nivel_conhecimento: number
          created_at?: string
        }
        Update: {
          id?: string
          tecnico_id?: string
          servico_id?: string
          nivel_conhecimento?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habilidades_tecnicos_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habilidades_tecnicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_catalogo"
            referencedColumns: ["id"]
          }
        ]
      }
      obras: {
        Row: {
          bairro: string | null
          cargo_responsavel: string | null
          cep: string | null
          cidade: string
          cno: string | null
          created_at: string
          empresa_id: string
          endereco: string
          estado: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome_obra: string
          numero: string | null
          responsavel: string | null
        }
        Insert: {
          bairro?: string | null
          cargo_responsavel?: string | null
          cep?: string | null
          cidade: string
          cno?: string | null
          created_at?: string
          empresa_id: string
          endereco: string
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome_obra: string
          numero?: string | null
          responsavel?: string | null
        }
        Update: {
          bairro?: string | null
          cargo_responsavel?: string | null
          cep?: string | null
          cidade?: string
          cno?: string | null
          created_at?: string
          empresa_id?: string
          endereco?: string
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome_obra?: string
          numero?: string | null
          responsavel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          nome_completo: string
          tecnico_id: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id: string
          nome_completo?: string
          tecnico_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome_completo?: string
          tecnico_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      servicos_catalogo: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          equipamentos_inclusos: Json
          id: string
          nome_servico: string
          sku: string
          unidade: string
          valor_custo_base: number
          valor_venda_editavel: number
          descricao: string | null
          tipo_cobranca: string
          formas_pagamento_aceitas: string[]
          regra_minimo_a_vista: number
          valor_cp_excedente: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          equipamentos_inclusos?: Json
          id?: string
          nome_servico: string
          sku: string
          unidade: string
          valor_custo_base?: number
          valor_venda_editavel?: number
          descricao?: string | null
          tipo_cobranca?: string
          formas_pagamento_aceitas?: string[]
          regra_minimo_a_vista?: number
          valor_cp_excedente?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          equipamentos_inclusos?: Json
          id?: string
          nome_servico?: string
          sku?: string
          unidade?: string
          valor_custo_base?: number
          valor_venda_editavel?: number
          descricao?: string | null
          tipo_cobranca?: string
          formas_pagamento_aceitas?: string[]
          regra_minimo_a_vista?: number
          valor_cp_excedente?: number
        }
        Relationships: []
      }
      servicos_precos_cidades: {
        Row: {
          id: string
          servico_id: string
          cidade_id: string
          valor_fixo: number
          limite_unidades: number
          created_at: string
        }
        Insert: {
          id?: string
          servico_id: string
          cidade_id: string
          valor_fixo?: number
          limite_unidades?: number
          created_at?: string
        }
        Update: {
          id?: string
          servico_id?: string
          cidade_id?: string
          valor_fixo?: number
          limite_unidades?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_precos_cidades_servico_id_fkey"
            columns: ["servico_id"]
            referencedRelation: "servicos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_precos_cidades_cidade_id_fkey"
            columns: ["cidade_id"]
            referencedRelation: "cidades_atendidas"
            referencedColumns: ["id"]
          }
        ]
      }
      tecnicos: {
        Row: {
          certificacoes: string | null
          cpf: string | null
          created_at: string
          email: string | null
          foto_url: string | null
          horario_fim_ultimo_servico: string | null
          id: string
          nome: string
          ranking_score: number
          rg: string | null
          status: Database["public"]["Enums"]["tecnico_status"]
          user_id: string | null
        }
        Insert: {
          certificacoes?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          horario_fim_ultimo_servico?: string | null
          id?: string
          nome: string
          ranking_score?: number
          rg?: string | null
          status?: Database["public"]["Enums"]["tecnico_status"]
          user_id?: string | null
        }
        Update: {
          certificacoes?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          horario_fim_ultimo_servico?: string | null
          id?: string
          nome?: string
          ranking_score?: number
          rg?: string | null
          status?: Database["public"]["Enums"]["tecnico_status"]
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      servicos_catalogo_pub: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          id: string | null
          nome_servico: string | null
          sku: string | null
          unidade: string | null
          valor_venda_editavel: number | null
          valor_cp_excedente: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          id?: string | null
          nome_servico?: string | null
          sku?: string | null
          unidade?: string | null
          valor_venda_editavel?: number | null
          valor_cp_excedente?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          id?: string | null
          nome_servico?: string | null
          sku?: string | null
          unidade?: string | null
          valor_venda_editavel?: number | null
          valor_cp_excedente?: number | null
        }
        Relationships: []
      }
      tecnicos_pub: {
        Row: {
          certificacoes: string | null
          created_at: string | null
          email: string | null
          foto_url: string | null
          id: string | null
          nome: string | null
          ranking_score: number | null
          status: Database["public"]["Enums"]["tecnico_status"] | null
        }
        Insert: {
          certificacoes?: string | null
          created_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string | null
          nome?: string | null
          ranking_score?: number | null
          status?: Database["public"]["Enums"]["tecnico_status"] | null
        }
        Update: {
          certificacoes?: string | null
          created_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string | null
          nome?: string | null
          ranking_score?: number | null
          status?: Database["public"]["Enums"]["tecnico_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_email_by_cpf: {
        Args: {
          p_cpf: string
        }
        Returns: string | null
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agendamento_status:
        | "Pendente_Tecnico"
        | "Pendente_Aprovacao_Gestor"
        | "Confirmado"
        | "Em_Execucao"
        | "Aguardando_Medicao"
        | "Validado"
        | "Laboratorio"
        | "Cancelado"
      app_role: "cliente" | "tecnico" | "admin"
      forma_pagamento: "Pix" | "Cartao" | "Boleto_14" | "Boleto_28"
      foto_tipo:
        | "Ciclo_CP"
        | "Final_Panoramica"
        | "Retorno_Carga"
        | "Checkin_QR"
      pagamento_status: "Pendente" | "Pago" | "Boleto_Aberto" | "Cancelado"
      tecnico_status: "Disponivel" | "Em_Campo" | "Folga"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agendamento_status: [
        "Pendente_Tecnico",
        "Pendente_Aprovacao_Gestor",
        "Confirmado",
        "Em_Execucao",
        "Aguardando_Medicao",
        "Validado",
        "Laboratorio",
        "Cancelado",
      ],
      app_role: ["cliente", "tecnico", "admin"],
      forma_pagamento: ["Pix", "Cartao", "Boleto_14", "Boleto_28"],
      foto_tipo: [
        "Ciclo_CP",
        "Final_Panoramica",
        "Retorno_Carga",
        "Checkin_QR",
      ],
      pagamento_status: ["Pendente", "Pago", "Boleto_Aberto", "Cancelado"],
      tecnico_status: ["Disponivel", "Em_Campo", "Folga"],
    },
  },
} as const
