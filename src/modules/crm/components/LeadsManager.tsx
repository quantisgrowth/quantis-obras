import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  PlusCircle,
  Search,
  Edit3,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  Building,
  Loader2,
  Download,
  Upload,
  FileSpreadsheet,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  MoreVertical,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getLeads,
  saveLead,
  deleteLead,
  getCompaniesForSelect,
  saveLeadsBatch,
  getLeadsTemplate,
  saveLeadsTemplate,
} from "../crm.api";

interface Lead {
  id?: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  empresa_cliente_id: string | null;
  empresa_cliente?: {
    id: string;
    razao_social: string;
  } | null;
  tags?: string[];
  ticket_medio?: number;
  total_compras?: number;
  compras_count?: number;
  ciclo_compra_dias?: number;
  ultima_compra_dias?: number;
  created_at?: string;
}

interface Company {
  id: string;
  razao_social: string;
  cnpj: string;
}

export function LeadsManager() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Filters & Sorting States
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all"); // all, today, week, month, custom
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "newest" | "oldest">("asc");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Form states
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [empresaClienteId, setEmpresaClienteId] = useState<string>("none");
  const [tagsInput, setTagsInput] = useState("");
  const [ticketMedio, setTicketMedio] = useState(0);
  const [totalCompras, setTotalCompras] = useState(0);
  const [comprasCount, setComprasCount] = useState(0);
  const [cicloCompra, setCicloCompra] = useState(0);
  const [ultimaCompra, setUltimaCompra] = useState(0);

  // Tab & Mock states to match screenshots
  const [activeFormTab, setActiveFormTab] = useState<"contato" | "dados" | "endereco" | "anotacoes">("contato");
  const [site, setSite] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [anotacoes, setAnotacoes] = useState("");
  const [documento, setDocumento] = useState("");
  const [origem, setOrigem] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");

  // Import Dialog states
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<any[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importPreview, setImportPreview] = useState<Lead[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadsData, companiesData] = await Promise.all([
        getLeads(),
        getCompaniesForSelect(),
      ]);
      setLeads((leadsData as any) || []);
      setCompanies((companiesData as any) || []);
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateForm = () => {
    setEditingLead(null);
    setNome("");
    setEmail("");
    setTelefone("");
    setCargo("");
    setEmpresaClienteId("none");
    setTagsInput("");
    setTicketMedio(0);
    setTotalCompras(0);
    setComprasCount(0);
    setCicloCompra(0);
    setUltimaCompra(0);
    setActiveFormTab("contato");
    setSite("");
    setCep("");
    setEndereco("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setUf("");
    setAnotacoes("");
    setDocumento("");
    setOrigem("");
    setDataNascimento("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (lead: Lead) => {
    setEditingLead(lead);
    setNome(lead.nome);
    setEmail(lead.email || "");
    setTelefone(lead.telefone || "");
    setCargo(lead.cargo || "");
    setEmpresaClienteId(lead.empresa_cliente_id || "none");
    setTagsInput((lead.tags || []).join(", "));
    setTicketMedio(lead.ticket_medio || 0);
    setTotalCompras(lead.total_compras || 0);
    setComprasCount(lead.compras_count || 0);
    setCicloCompra(lead.ciclo_compra_dias || 0);
    setUltimaCompra(lead.ultima_compra_dias || 0);
    setActiveFormTab("contato");
    setSite("");
    setCep("");
    setEndereco("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setUf("");
    setAnotacoes("");
    setDocumento("");
    setOrigem("");
    setDataNascimento("");
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("O nome do lead é obrigatório.");
      return;
    }

    setLoading(true);
    try {
      const parsedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await saveLead({
        data: {
          id: editingLead?.id,
          nome: nome.trim(),
          email: email.trim() || null,
          telefone: telefone.trim() || null,
          cargo: cargo.trim() || null,
          empresa_cliente_id: empresaClienteId === "none" ? null : empresaClienteId,
          tags: parsedTags,
          ticket_medio: Number(ticketMedio),
          total_compras: Number(totalCompras),
          compras_count: Number(comprasCount),
          ciclo_compra_dias: Number(cicloCompra),
          ultima_compra_dias: Number(ultimaCompra),
        },
      });

      toast.success(editingLead ? "Contato atualizado com sucesso!" : "Contato criado com sucesso!");
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao salvar contato: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este contato?")) return;

    setLoading(true);
    try {
      await deleteLead({ data: { id } });
      toast.success("Contato excluído com sucesso!");
      loadData();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
      setLoading(false);
    }
  };

  // --- FILTERS & SORTING LOGIC ---
  const filteredLeads = leads
    .filter((lead) => {
      // 1. Search term
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        lead.nome.toLowerCase().includes(search) ||
        (lead.email && lead.email.toLowerCase().includes(search)) ||
        (lead.telefone && lead.telefone.includes(search)) ||
        (lead.empresa_cliente?.razao_social &&
          lead.empresa_cliente.razao_social.toLowerCase().includes(search));

      if (!matchesSearch) return false;

      // 2. Company filter
      if (filterCompany !== "all" && lead.empresa_cliente_id !== filterCompany) {
        return false;
      }

      // 3. Date range filter
      if (filterDateRange !== "all" && lead.created_at) {
        const createdAtDate = new Date(lead.created_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (filterDateRange === "today") {
          const startOfToday = new Date(today);
          if (createdAtDate < startOfToday) return false;
        } else if (filterDateRange === "week") {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(today.getDate() - 7);
          if (createdAtDate < oneWeekAgo) return false;
        } else if (filterDateRange === "month") {
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(today.getMonth() - 1);
          if (createdAtDate < oneMonthAgo) return false;
        } else if (filterDateRange === "custom") {
          if (customStartDate) {
            const startLimit = new Date(customStartDate);
            startLimit.setHours(0, 0, 0, 0);
            if (createdAtDate < startLimit) return false;
          }
          if (customEndDate) {
            const endLimit = new Date(customEndDate);
            endLimit.setHours(23, 59, 59, 999);
            if (createdAtDate > endLimit) return false;
          }
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.nome.localeCompare(b.nome);
      } else if (sortOrder === "desc") {
        return b.nome.localeCompare(a.nome);
      } else if (sortOrder === "newest") {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      } else {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return da - db;
      }
    });

  // --- CHECKBOX SELECTION LOGIC ---
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(filteredLeads.map((l) => l.id || ""));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads((prev) => [...prev, id]);
    } else {
      setSelectedLeads((prev) => prev.filter((item) => item !== id));
    }
  };

  // --- EXPORT LOGIC ---
  const handleExport = (type: "csv" | "xls") => {
    if (filteredLeads.length === 0) {
      toast.warning("Nenhum lead encontrado para exportar.");
      return;
    }

    const headers = [
      "Nome",
      "E-mail",
      "Telefone",
      "Cargo",
      "Empresa Cliente",
      "Tags",
      "Ticket Médio",
      "Total Compras",
      "Número de Compras",
      "Ciclo de Compra (dias)",
      "Última Compra (dias)",
      "Data de Criação",
    ];

    const rows = filteredLeads.map((lead) => [
      lead.nome,
      lead.email || "",
      lead.telefone || "",
      lead.cargo || "",
      lead.empresa_cliente?.razao_social || "Avulso",
      (lead.tags || []).join(", "),
      lead.ticket_medio || 0,
      lead.total_compras || 0,
      lead.compras_count || 0,
      lead.ciclo_compra_dias || 0,
      lead.ultima_compra_dias || 0,
      lead.created_at ? new Date(lead.created_at).toLocaleDateString("pt-BR") : "",
    ]);

    // Format fields with semicolon separator and UTF-8 BOM to prevent Excel accent issues
    const csvContent =
      "\uFEFF" +
      headers.join(";") +
      "\n" +
      rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(";")).join("\n");

    const blob = new Blob([csvContent], {
      type: type === "csv" ? "text/csv;charset=utf-8;" : "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_crm.${type === "csv" ? "csv" : "xls"}`);
    link.click();
    toast.success(`Leads exportados em ${type.toUpperCase()} com sucesso!`);
  };

  // --- IMPORT & FILE MAPPING LOGIC ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const loadSheetJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = () => resolve((window as any).XLSX);
      script.onerror = (err) => reject(new Error("Erro ao carregar analisador XLSX: " + err));
      document.head.appendChild(script);
    });
  };

  const handleAdminUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB.");
      return;
    }

    try {
      const base64Data = await fileToBase64(file);
      await saveLeadsTemplate({
        data: {
          fileName: file.name,
          contentType: file.type,
          base64Data,
        },
      });
      toast.success("Template padrão de leads atualizado pelo administrador!");
    } catch (err: any) {
      toast.error("Erro ao subir template: " + err.message);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const template = await getLeadsTemplate();
      if (template && (template as any).base64Data) {
        const link = document.createElement("a");
        link.href = (template as any).base64Data;
        link.download = (template as any).fileName || "modelo_importacao_leads.csv";
        link.click();
        toast.success("Template personalizado baixado!");
      } else {
        // Fallback default CSV template
        const headers = [
          "Nome",
          "E-mail",
          "Telefone",
          "Cargo",
          "Tags (Separadas por vírgula)",
          "Ticket Médio",
          "Total Compras",
          "Qtd Compras",
          "Ciclo Compra (dias)",
          "Ultima Compra (dias)",
        ];
        const csvContent = "\uFEFF" + headers.join(";") + "\n";
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "modelo_leads.csv";
        link.click();
        toast.success("Template básico baixado!");
      }
    } catch (err: any) {
      toast.error("Erro ao baixar template: " + err.message);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (isXlsx) {
      toast.info("Processando arquivo Excel...");
      try {
        const XLSX = await loadSheetJS();
        const reader = new FileReader();
        reader.onload = (event) => {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          if (json.length > 0) {
            const fileHeaders = json[0].map((h) => String(h).trim());
            const fileRows = json.slice(1);
            setImportHeaders(fileHeaders);
            setImportRows(fileRows);
            autoMapColumns(fileHeaders);
          } else {
            toast.error("A planilha está vazia.");
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err: any) {
        toast.error("Erro ao ler planilha: " + err.message);
      }
    } else {
      toast.info("Processando arquivo CSV...");
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const delimiter = text.includes(";") ? ";" : ",";
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length > 0) {
          const fileHeaders = lines[0]
            .split(delimiter)
            .map((h) => h.replace(/^["\uFEFF]+|["\uFEFF]+$/g, "").trim());
          const fileRows = lines.slice(1).map((line) => {
            const cells: string[] = [];
            let currentCell = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === delimiter && !inQuotes) {
                cells.push(currentCell.trim());
                currentCell = "";
              } else {
                currentCell += char;
              }
            }
            cells.push(currentCell.trim());
            return cells.map((c) => c.replace(/^"+|"+$/g, ""));
          });
          setImportHeaders(fileHeaders);
          setImportRows(fileRows);
          autoMapColumns(fileHeaders);
        } else {
          toast.error("O arquivo CSV está vazio.");
        }
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const autoMapColumns = (fileHeaders: string[]) => {
    const newMappings: Record<string, string> = {};
    const crmFields = [
      { key: "nome", matches: ["nome", "name", "contato", "cliente", "lead"] },
      { key: "email", matches: ["email", "e-mail", "mail"] },
      { key: "telefone", matches: ["telefone", "tel", "celular", "cel", "phone", "whatsapp", "whats"] },
      { key: "cargo", matches: ["cargo", "funcao", "função", "role", "job"] },
      { key: "tags", matches: ["tags", "tag", "etiquetas", "etiqueta"] },
      { key: "ticket_medio", matches: ["ticket medio", "ticket médio", "ticket"] },
      { key: "total_compras", matches: ["total", "total compras", "valor total", "dados total"] },
      { key: "compras_count", matches: ["compras", "quantidade", "qtd compras", "compras count"] },
      { key: "ciclo_compra_dias", matches: ["ciclo", "ciclo compra", "ciclo dias"] },
      { key: "ultima_compra_dias", matches: ["ultima compra", "última compra", "dias ultima", "ultima"] },
    ];

    crmFields.forEach((field) => {
      const matchedHeader = fileHeaders.find((h) =>
        field.matches.some((m) => h.toLowerCase().includes(m))
      );
      if (matchedHeader) {
        newMappings[field.key] = matchedHeader;
      }
    });

    setMappings(newMappings);
  };

  useEffect(() => {
    if (importRows.length === 0 || !mappings.nome) {
      setImportPreview([]);
      return;
    }

    const previewData: Lead[] = importRows.slice(0, 5).map((row) => {
      const getVal = (field: string) => {
        const colHeader = mappings[field];
        if (!colHeader) return null;
        const colIndex = importHeaders.indexOf(colHeader);
        return colIndex !== -1 ? row[colIndex] : null;
      };

      const tagsStr = getVal("tags");
      const tagsArr = tagsStr
        ? String(tagsStr)
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : [];

      return {
        nome: String(getVal("nome") || "").trim(),
        email: getVal("email") ? String(getVal("email")).trim() : null,
        telefone: getVal("telefone") ? String(getVal("telefone")).trim() : null,
        cargo: getVal("cargo") ? String(getVal("cargo")).trim() : null,
        empresa_cliente_id: null,
        tags: tagsArr,
        ticket_medio: getVal("ticket_medio") ? Number(getVal("ticket_medio")) : 0,
        total_compras: getVal("total_compras") ? Number(getVal("total_compras")) : 0,
        compras_count: getVal("compras_count") ? Number(getVal("compras_count")) : 0,
        ciclo_compra_dias: getVal("ciclo_compra_dias") ? Number(getVal("ciclo_compra_dias")) : 0,
        ultima_compra_dias: getVal("ultima_compra_dias") ? Number(getVal("ultima_compra_dias")) : 0,
      };
    });

    setImportPreview(previewData.filter((p) => p.nome.length > 0));
  }, [mappings, importRows, importHeaders]);

  const handleConfirmImport = async () => {
    if (!mappings.nome) {
      toast.error("O mapeamento da coluna 'Nome' é obrigatório.");
      return;
    }

    setIsImporting(true);
    try {
      const leadsToSave: Lead[] = importRows
        .map((row) => {
          const getVal = (field: string) => {
            const colHeader = mappings[field];
            if (!colHeader) return null;
            const colIndex = importHeaders.indexOf(colHeader);
            return colIndex !== -1 ? row[colIndex] : null;
          };

          const tagsStr = getVal("tags");
          const tagsArr = tagsStr
            ? String(tagsStr)
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0)
            : [];

          return {
            nome: String(getVal("nome") || "").trim(),
            email: getVal("email") ? String(getVal("email")).trim() : null,
            telefone: getVal("telefone") ? String(getVal("telefone")).trim() : null,
            cargo: getVal("cargo") ? String(getVal("cargo")).trim() : null,
            empresa_cliente_id: null, // Default to null for raw import, can be linked manually
            tags: tagsArr,
            ticket_medio: getVal("ticket_medio") ? Number(getVal("ticket_medio")) : 0,
            total_compras: getVal("total_compras") ? Number(getVal("total_compras")) : 0,
            compras_count: getVal("compras_count") ? Number(getVal("compras_count")) : 0,
            ciclo_compra_dias: getVal("ciclo_compra_dias") ? Number(getVal("ciclo_compra_dias")) : 0,
            ultima_compra_dias: getVal("ultima_compra_dias") ? Number(getVal("ultima_compra_dias")) : 0,
          };
        })
        .filter((lead) => lead.nome.length > 0);

      if (leadsToSave.length === 0) {
        toast.error("Nenhum lead válido encontrado no arquivo.");
        setIsImporting(false);
        return;
      }

      await saveLeadsBatch({ data: leadsToSave });
      toast.success(`${leadsToSave.length} leads importados com sucesso!`);
      setIsImportOpen(false);
      setImportFile(null);
      setImportHeaders([]);
      setImportRows([]);
      setMappings({});
      loadData();
    } catch (err: any) {
      toast.error("Erro ao importar leads: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Consulte, crie, modifique ou remova seus leads</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {isAdmin && (
            <div className="relative">
              <input
                type="file"
                id="admin-template-upload"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleAdminUploadTemplate}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("admin-template-upload")?.click()}
                className="gap-1.5 h-9 bg-card border-border hover:bg-muted text-xs"
              >
                <Upload className="h-3.5 w-3.5" /> Def. Modelo Padrão
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="gap-1.5 h-9 bg-card border-border hover:bg-muted text-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> Importar Lista
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 bg-card border-border hover:bg-muted text-xs"
              >
                <Download className="h-3.5 w-3.5 text-blue-500" /> Exportar Leads
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover border border-border">
              <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Arquivo CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xls")} className="cursor-pointer gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-500" /> Arquivo Excel (XLS)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleOpenCreateForm} size="sm" className="gap-1.5 h-9 text-xs font-semibold">
            <PlusCircle className="h-3.5 w-3.5" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Main Search and Advanced Filters Panel */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 border-border bg-card pr-32"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/75 bg-muted/65 px-2 py-0.5 rounded font-medium">
              {filteredLeads.length} resultados
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 border-border bg-card gap-1.5 text-sm">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <span>Ordenação</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border">
                <DropdownMenuItem onClick={() => setSortOrder("asc")} className="cursor-pointer">
                  Nome (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("desc")} className="cursor-pointer">
                  Nome (Z-A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("newest")} className="cursor-pointer">
                  Data Cadastro (Mais Recente)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("oldest")} className="cursor-pointer">
                  Data Cadastro (Mais Antigo)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant={showFiltersPanel ? "secondary" : "outline"}
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className="h-10 border-border bg-card gap-1.5 text-sm"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span>Filtros</span>
            </Button>
          </div>
        </div>

        {/* Advanced Filters Expandable Card */}
        {showFiltersPanel && (
          <Card className="border border-border bg-card/60 backdrop-blur-sm p-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Filtrar por Empresa</Label>
                <Select value={filterCompany} onValueChange={setFilterCompany}>
                  <SelectTrigger className="bg-background border-border h-9">
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border">
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Filtrar por Data de Cadastro</Label>
                <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                  <SelectTrigger className="bg-background border-border h-9">
                    <SelectValue placeholder="Todo o período" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border">
                    <SelectItem value="all">Todo o período</SelectItem>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="week">Últimos 7 dias</SelectItem>
                    <SelectItem value="month">Último mês</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterDateRange === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Início</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-background border-border h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Fim</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-background border-border h-9 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border/60">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCompany("all");
                  setFilterDateRange("all");
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                className="text-xs h-8 hover:bg-muted"
              >
                Limpar Filtros
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="space-y-4">
        {/* Table List Section - Full Width */}
        <Card className="border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            {loading && leads.length === 0 ? (
              <div className="py-24 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p>Carregando banco de leads...</p>
              </div>
            ) : filteredLeads.length > 0 ? (
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold text-xs select-none">
                    <th className="py-3 px-4 w-12 text-center">
                      <Checkbox
                        checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th className="py-3.5 px-4 font-semibold">Nome</th>
                    <th className="py-3.5 px-4 font-semibold">Contatos</th>
                    <th className="py-3.5 px-4 font-semibold">Tags</th>
                    <th className="py-3.5 px-4 font-semibold">Dados</th>
                    <th className="py-3.5 px-4 font-semibold">Data de criação</th>
                    <th className="py-3.5 px-4 w-14 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLeads.map((lead) => {
                    const initials = lead.nome
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    const formattedTicket = new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(lead.ticket_medio || 0);

                    const formattedTotal = new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(lead.total_compras || 0);

                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-muted/20 transition-colors ${
                          selectedLeads.includes(lead.id || "") ? "bg-muted/10" : ""
                        }`}
                      >
                        <td className="py-4 px-4 text-center align-middle">
                          <Checkbox
                            checked={selectedLeads.includes(lead.id || "")}
                            onCheckedChange={(checked) => handleSelectOne(lead.id || "", !!checked)}
                            aria-label={`Selecionar ${lead.nome}`}
                          />
                        </td>
                        <td
                          className="py-4 px-4 align-middle cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleOpenEditForm(lead)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs select-none">
                              {initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground truncate max-w-[200px]">
                                {lead.nome}
                              </span>
                              <span className="text-[10px] text-muted-foreground/90 font-medium">
                                Ticket médio <span className="text-emerald-500">{formattedTicket}</span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td
                          className="py-4 px-4 align-middle cursor-pointer"
                          onClick={() => handleOpenEditForm(lead)}
                        >
                          {lead.telefone ? (
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground/75" />
                              <span>{lead.telefone}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40 italic">Sem telefone</span>
                          )}
                        </td>
                        <td
                          className="py-4 px-4 align-middle cursor-pointer"
                          onClick={() => handleOpenEditForm(lead)}
                        >
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {(lead.tags || []).length > 0 ? (
                              lead.tags?.map((tag, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-primary/5 text-primary border border-primary/10"
                                >
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground/35">-</span>
                            )}
                          </div>
                        </td>
                        <td
                          className="py-4 px-4 align-middle cursor-pointer"
                          onClick={() => handleOpenEditForm(lead)}
                        >
                          <div className="flex flex-col text-[11px] space-y-0.5 min-w-[120px]">
                            <div className="text-foreground">
                              Total <span className="font-semibold text-foreground/90">{formattedTotal}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-[10px]">
                              <span className="flex items-center gap-1">
                                <Badge className="h-4 px-1 rounded-sm bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-semibold">
                                  {lead.compras_count || 0}
                                </Badge>
                                compras
                              </span>
                              <span>•</span>
                              <span>{lead.ciclo_compra_dias || 0}d ciclo</span>
                              <span>•</span>
                              <span>{lead.ultima_compra_dias || 0}d últ.</span>
                            </div>
                          </div>
                        </td>
                        <td
                          className="py-4 px-4 align-middle text-xs font-medium text-muted-foreground cursor-pointer"
                          onClick={() => handleOpenEditForm(lead)}
                        >
                          {lead.created_at ? (
                            new Date(lead.created_at).toLocaleDateString("pt-BR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-4 px-4 text-center align-middle">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted text-muted-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border border-border">
                              <DropdownMenuItem onClick={() => handleOpenEditForm(lead)} className="cursor-pointer gap-2">
                                <Edit3 className="h-4 w-4 text-primary" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(lead.id || "")} className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10">
                                <Trash2 className="h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2 select-none">
                <SlidersHorizontal className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
                <p>Nenhum lead encontrado com os filtros aplicados.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Pop-up dialog for Create/Edit lead */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl bg-card border border-border select-none max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingLead ? "Editar Lead" : "Criar novo Lead"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Insira os detalhes do contato do CRM.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Nome and Tags at the top (always visible) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <Label htmlFor="lead-nome" className="text-xs font-semibold text-muted-foreground">Nome</Label>
                <Input
                  id="lead-nome"
                  placeholder="Informe o nome do lead"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="h-9 text-xs bg-card border-border"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="lead-tags" className="text-xs font-semibold text-muted-foreground">Tags (separadas por vírgula)</Label>
                <Input
                  id="lead-tags"
                  placeholder="Ex: WhatsApp, Tráfego Pago"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="h-9 text-xs bg-card border-border"
                />
              </div>
            </div>

            {/* Tabs Header Buttons */}
            <div className="flex flex-wrap gap-1 p-1 bg-muted/20 border border-border/80 rounded-lg w-full">
              {[
                { id: "contato", label: "Contato" },
                { id: "dados", label: "Dados da Empresa" },
                { id: "endereco", label: "Endereço" },
                { id: "anotacoes", label: "Anotações" },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveFormTab(tab.id as any)}
                  className={`text-xs h-7 px-3 flex-1 rounded-md transition-all font-semibold ${
                    activeFormTab === tab.id
                      ? "bg-muted text-foreground font-bold shadow-sm"
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Tab content area */}
            <div className="min-h-[220px] py-2">
              {activeFormTab === "contato" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <Label htmlFor="lead-phone" className="text-xs font-semibold text-muted-foreground">Telefone</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/40 border border-border rounded-md text-xs select-none h-9 shrink-0">
                        <span>🇧🇷</span>
                        <span className="text-muted-foreground font-semibold">+55</span>
                      </div>
                      <Input
                        id="lead-phone"
                        placeholder="Digite o telefone"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="h-9 text-xs flex-1 bg-card border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lead-email" className="text-xs font-semibold text-muted-foreground">E-mail</Label>
                    <Input
                      id="lead-email"
                      type="email"
                      placeholder="Exemplo: meulead@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9 text-xs bg-card border-border"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lead-site" className="text-xs font-semibold text-muted-foreground">Site</Label>
                    <Input
                      id="lead-site"
                      placeholder="Exemplo: www.meulead.com.br"
                      value={site}
                      onChange={(e) => setSite(e.target.value)}
                      className="h-9 text-xs bg-card border-border"
                    />
                  </div>
                </div>
              )}

              {activeFormTab === "dados" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label htmlFor="lead-documento" className="text-xs font-semibold text-muted-foreground">Documento</Label>
                      <Input
                        id="lead-documento"
                        placeholder="Informe o CPF ou CNPJ"
                        value={documento}
                        onChange={(e) => setDocumento(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="lead-empresa" className="text-xs font-semibold text-muted-foreground">Empresa</Label>
                      <Select value={empresaClienteId} onValueChange={setEmpresaClienteId}>
                        <SelectTrigger id="lead-empresa" className="h-9 text-xs bg-background border-border">
                          <SelectValue placeholder="Informe a empresa do lead" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border">
                          <SelectItem value="none">Nenhuma (Avulso)</SelectItem>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.razao_social}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label htmlFor="lead-origem" className="text-xs font-semibold text-muted-foreground">Origem</Label>
                      <Input
                        id="lead-origem"
                        placeholder="Como o lead ficou sabendo da sua empresa?"
                        value={origem}
                        onChange={(e) => setOrigem(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="lead-datanasc" className="text-xs font-semibold text-muted-foreground">Data de Nascimento</Label>
                      <Input
                        id="lead-datanasc"
                        type="date"
                        value={dataNascimento}
                        onChange={(e) => setDataNascimento(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lead-cargo" className="text-xs font-semibold text-muted-foreground">Cargo / Função</Label>
                    <Input
                      id="lead-cargo"
                      placeholder="Ex: Comprador, Engenheiro"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      className="h-9 text-xs bg-card border-border"
                    />
                  </div>

                  {/* Comercial/Métricas Section */}
                  <div className="pt-3 border-t border-border/60">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Indicadores de Compra (CRM)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <Label htmlFor="lead-ticket" className="text-xs font-semibold text-muted-foreground">Ticket Médio (R$)</Label>
                        <Input
                          id="lead-ticket"
                          type="number"
                          step="0.01"
                          min="0"
                          value={ticketMedio}
                          onChange={(e) => setTicketMedio(Number(e.target.value))}
                          className="h-9 text-xs bg-card border-border"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="lead-total" className="text-xs font-semibold text-muted-foreground">Total Compras (R$)</Label>
                        <Input
                          id="lead-total"
                          type="number"
                          step="0.01"
                          min="0"
                          value={totalCompras}
                          onChange={(e) => setTotalCompras(Number(e.target.value))}
                          className="h-9 text-xs bg-card border-border"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="space-y-1">
                        <Label htmlFor="lead-qtd" className="text-[10px] font-semibold text-muted-foreground">Qtd Compras</Label>
                        <Input
                          id="lead-qtd"
                          type="number"
                          min="0"
                          value={comprasCount}
                          onChange={(e) => setComprasCount(Number(e.target.value))}
                          className="h-9 text-xs bg-card border-border"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="lead-ciclo" className="text-[10px] font-semibold text-muted-foreground">Ciclo (dias)</Label>
                        <Input
                          id="lead-ciclo"
                          type="number"
                          min="0"
                          value={cicloCompra}
                          onChange={(e) => setCicloCompra(Number(e.target.value))}
                          className="h-9 text-xs bg-card border-border"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="lead-ult" className="text-[10px] font-semibold text-muted-foreground">Última (dias)</Label>
                        <Input
                          id="lead-ult"
                          type="number"
                          min="0"
                          value={ultimaCompra}
                          onChange={(e) => setUltimaCompra(Number(e.target.value))}
                          className="h-9 text-xs bg-card border-border"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeFormTab === "endereco" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">CEP</Label>
                      <Input
                        placeholder="Ex: 01311-200"
                        value={cep}
                        onChange={(e) => setCep(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">País</Label>
                      <div className="flex items-center gap-2 h-9 px-3 bg-muted/20 border border-border rounded-md text-xs select-none">
                        <span>🇧🇷</span>
                        <span>Brasil</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Endereço</Label>
                      <Input
                        placeholder="Ex: Avenida Paulista"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                    <div className="space-y-1 col-span-1">
                      <Label className="text-xs font-semibold text-muted-foreground">Número</Label>
                      <Input
                        placeholder="Ex: 1000"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                    <div className="space-y-1 col-span-1">
                      <Label className="text-xs font-semibold text-muted-foreground">Compl.</Label>
                      <Input
                        placeholder="Ex: Apto 101"
                        value={complemento}
                        onChange={(e) => setComplemento(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">Bairro</Label>
                      <Input
                        placeholder="Ex: Cerqueira César"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">Cidade</Label>
                      <Input
                        placeholder="Ex: São Paulo"
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">UF</Label>
                      <Input
                        placeholder="Ex: SP"
                        value={uf}
                        onChange={(e) => setUf(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeFormTab === "anotacoes" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <Label htmlFor="lead-anotacoes" className="text-xs font-semibold text-muted-foreground">Anotações do Lead</Label>
                    <textarea
                      id="lead-anotacoes"
                      rows={6}
                      placeholder="Escreva observações adicionais sobre o lead..."
                      value={anotacoes}
                      onChange={(e) => setAnotacoes(e.target.value)}
                      className="w-full text-xs p-3 bg-card border border-border rounded-md focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-4 border-t border-border/80 justify-end">
              <Button
                type="button"
                variant="outline"
                className="text-xs h-9 bg-card border-border hover:bg-muted px-4"
                onClick={() => setIsFormOpen(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" className="text-xs h-9 font-semibold px-5" disabled={loading}>
                {loading ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- IMPORT MODAL --- */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl bg-card border border-border select-none max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Importar Lista de Leads</DialogTitle>
            <DialogDescription className="text-xs">
              Suba arquivos em formato CSV ou Excel (.xlsx). Mapeie as colunas de sua planilha com os campos do CRM abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {/* Step 1: Download/Upload template */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3.5 rounded-lg border border-border/80 bg-muted/10">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-9 w-9 text-emerald-500" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Planilha Modelo</div>
                  <div className="text-xs text-muted-foreground">Baixe o template padrão configurado para preencher os dados.</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-1.5 bg-card border-border hover:bg-muted font-medium text-xs whitespace-nowrap shrink-0"
              >
                <Download className="h-4 w-4" /> Baixar Template
              </Button>
            </div>

            {/* Step 2: File upload input */}
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Escolha o Arquivo</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="bg-card border-border text-xs focus:ring-primary h-10 flex items-center pt-2.5 cursor-pointer"
              />
            </div>

            {/* Step 3: Column Mapping Section */}
            {importHeaders.length > 0 && (
              <div className="space-y-4 border-t border-border pt-4 text-left">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    2. Mapeie as Colunas do seu Arquivo
                  </Label>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/25">
                    Planilha lida com {importRows.length} linhas
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 p-3 border border-border/80 bg-muted/5 rounded-lg max-h-[30vh] overflow-y-auto">
                  {/* Nome field (Required) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <span>Nome Completo *</span>
                      <span className="text-[10px] text-red-500 font-bold">(Obrigatório)</span>
                    </Label>
                    <Select
                      value={mappings.nome || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, nome: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Selecione a coluna..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">E-mail</Label>
                    <Select
                      value={mappings.email || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, email: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Telefone */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                    <Select
                      value={mappings.telefone || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, telefone: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cargo */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Cargo / Função</Label>
                    <Select
                      value={mappings.cargo || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, cargo: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tags (Separadas por vírgula)</Label>
                    <Select
                      value={mappings.tags || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, tags: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ticket Medio */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Ticket Médio</Label>
                    <Select
                      value={mappings.ticket_medio || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, ticket_medio: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Total Compras */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Total Compras</Label>
                    <Select
                      value={mappings.total_compras || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, total_compras: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Qtd Compras */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Quantidade Compras</Label>
                    <Select
                      value={mappings.compras_count || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, compras_count: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ciclo Compra */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Ciclo de Compra (dias)</Label>
                    <Select
                      value={mappings.ciclo_compra_dias || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, ciclo_compra_dias: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ultima Compra */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Última Compra (dias)</Label>
                    <Select
                      value={mappings.ultima_compra_dias || ""}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, ultima_compra_dias: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Ignorar campo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="">Ignorar campo...</SelectItem>
                        {importHeaders.map((h, i) => (
                          <SelectItem key={i} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview */}
                {importPreview.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Visualização prévia (Primeiras linhas)
                    </Label>
                    <div className="border border-border/80 rounded-md overflow-hidden bg-card/60">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/15 border-b text-muted-foreground font-semibold">
                            <th className="py-2 px-3">Nome</th>
                            <th className="py-2 px-3">E-mail</th>
                            <th className="py-2 px-3">Telefone</th>
                            <th className="py-2 px-3">Tags</th>
                            <th className="py-2 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {importPreview.map((p, idx) => (
                            <tr key={idx} className="hover:bg-muted/10">
                              <td className="py-2 px-3 font-medium text-foreground truncate max-w-[130px]">{p.nome}</td>
                              <td className="py-2 px-3 truncate max-w-[150px]">{p.email || "-"}</td>
                              <td className="py-2 px-3">{p.telefone || "-"}</td>
                              <td className="py-2 px-3 max-w-[120px] truncate">
                                {(p.tags || []).map((t, idx) => (
                                  <Badge key={idx} variant="outline" className="text-[8px] px-1 py-0 rounded bg-primary/5 text-primary border-primary/10 mr-0.5">
                                    {t}
                                  </Badge>
                                ))}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-emerald-500">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.total_compras || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsImportOpen(false);
                setImportFile(null);
                setImportHeaders([]);
                setImportRows([]);
                setMappings({});
              }}
              disabled={isImporting}
              className="text-xs h-9 bg-card border-border hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={isImporting || importHeaders.length === 0 || !mappings.nome}
              className="text-xs h-9 font-semibold"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Importando...</span>
                </>
              ) : (
                "Confirmar Importação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
