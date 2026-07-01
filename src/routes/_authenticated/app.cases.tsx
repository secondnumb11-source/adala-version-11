import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import {
  Briefcase,
  LayoutGrid,
  List,
  FileText,
  Calendar,
  Gavel,
  AlertTriangle,
  Scale,
  ArrowRightLeft,
  ChevronDown,
  User,
  Building2,
  Hash,
  Clock,
  FileCheck,
  Eye,
  Search,
  X,
  ArrowUpRight,
  FileSignature,
  ClipboardList,
  Users,
  FileCheck2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/section-shell";
import { CrudDialog, AddButton, type Field } from "@/components/crud-dialog";
import { DataTable } from "@/components/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useList, useUpsert, useDelete } from "@/lib/data-hooks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/cases")({
  component: CasesPage,
});

// ─── Status configuration ────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "open", label: "مفتوحة", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "in_study", label: "قيد الدراسة", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "postponed", label: "مؤجلة", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "closed_final", label: "محكوم بها بحكم قطعي", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "closed_non_final", label: "محكوم بها بحكم غير نهائي", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "closed", label: "منتهية", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "appealed", label: "استئناف", color: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "archived", label: "مؤرشفة", color: "bg-slate-100 text-slate-700 border-slate-300" },
];

const TRANSFER_TARGETS = [
  { value: "executions", label: "طلبات التنفيذ", icon: "⚡" },
  { value: "powers_of_attorney", label: "الوكالات القضائية", icon: "📋" },
  { value: "documents_archive", label: "أرشيف المستندات والأحكام", icon: "📁" },
];

const TRANSFER_LABELS: Record<string, string> = Object.fromEntries(
  TRANSFER_TARGETS.map((t) => [t.value, t.label])
);

const CASE_TYPE_LABELS: Record<string, string> = {
  civil: "مدنية",
  commercial: "تجارية",
  labor: "عمالية",
  criminal: "جزائية",
  personal_status: "أحوال شخصية",
  administrative: "إدارية",
  execution: "تنفيذ",
  other: "أخرى",
};

function getStatusInfo(status: string) {
  return (
    STATUS_OPTIONS.find((s) => s.value === status) ?? {
      value: status,
      label: status,
      color: "bg-gray-100 text-gray-800 border-gray-300",
    }
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Form fields for create/edit dialog ──────────────────────────
function useCaseFields(clients: any[]): Field[] {
  return [
    { name: "title", label: "عنوان القضية", required: true, full: true },
    { name: "case_number", label: "رقم القضية", required: true },
    { name: "plaintiff_name", label: "اسم المدعي" },
    { name: "defendant_name", label: "اسم المدعى عليه" },
    {
      name: "case_type",
      label: "نوع القضية",
      type: "select",
      required: true,
      options: [
        { value: "civil", label: "مدنية" },
        { value: "commercial", label: "تجارية" },
        { value: "labor", label: "عمالية" },
        { value: "criminal", label: "جزائية" },
        { value: "personal_status", label: "أحوال شخصية" },
        { value: "administrative", label: "إدارية" },
        { value: "execution", label: "تنفيذ" },
        { value: "other", label: "أخرى" },
      ],
    },
    {
      name: "status",
      label: "الحالة",
      type: "select",
      options: STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
    },
    { name: "court", label: "اسم المحكمة" },
    { name: "circuit_number", label: "رقم الدائرة" },
    { name: "opened_at", label: "تاريخ القيد", type: "date" },
    { name: "judgment_number", label: "رقم الحكم" },
    { name: "judgment_date", label: "تاريخ الحكم", type: "date" },
    { name: "deed_number", label: "رقم صك الحكم" },
    { name: "appeal_deadline", label: "موعد الاستئناف", type: "date" },
    {
      name: "client_id",
      label: "العميل",
      type: "select",
      options: clients.map((c) => ({ value: c.id, label: c.full_name })),
    },
    { name: "description", label: "وصف القضية", type: "textarea", full: true },
  ];
}

// ─── Main Component ──────────────────────────────────────────────
function CasesPage() {
  const { data: cases = [], isLoading, refetch } = useList<any>("cases");
  const { data: clients = [] } = useList<any>("clients");
  const { data: sessions = [] } = useList<any>("sessions");
  const { data: docs = [] } = useList<any>("documents");
  const { data: caseDetails = [] } = useList<any>("case_details");
  const { data: caseParties = [] } = useList<any>("case_parties");
  const { data: caseJudgments = [] } = useList<any>("case_judgments");
  const { data: lawsuitRequests = [] } = useList<any>("lawsuit_requests");
  const upsert = useUpsert("cases");
  const del = useDelete("cases");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailCase, setDetailCase] = useState<any | null>(null);

  const fields = useCaseFields(clients);

  // ── Derived data helpers ─────────────────────────────────────
  const getSessionCount = useCallback(
    (caseId: string) => sessions.filter((s) => s.case_id === caseId).length,
    [sessions]
  );

  const getJudgmentCount = useCallback(
    (caseId: string) =>
      docs.filter(
        (d) =>
          d.case_id === caseId &&
          (d.doc_type === "judgment_final" || d.doc_type === "judgment_non_final")
      ).length,
    [docs]
  );

  const getMemoCount = useCallback(
    (caseId: string) =>
      docs.filter((d) => d.case_id === caseId && d.doc_type === "memorandum").length,
    [docs]
  );

  const getCaseSessions = useCallback(
    (caseId: string) =>
      sessions
        .filter((s) => s.case_id === caseId)
        .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()),
    [sessions]
  );

  const getNextSession = useCallback(
    (caseId: string) => {
      const now = new Date();
      return getCaseSessions(caseId).find(
        (s) => new Date(s.session_date) >= now && s.status === "scheduled"
      ) ?? null;
    },
    [getCaseSessions]
  );

  const getCaseParties = useCallback(
    (caseNumber: string) => caseParties.filter((p) => p.case_number === caseNumber),
    [caseParties]
  );

  const getCaseJudgmentsFromTable = useCallback(
    (caseNumber: string) => caseJudgments.filter((j) => j.case_number === caseNumber),
    [caseJudgments]
  );

  const getJudgmentDocs = useCallback(
    (caseId: string) =>
      docs.filter(
        (d) =>
          d.case_id === caseId &&
          (d.doc_type === "judgment_final" || d.doc_type === "judgment_non_final")
      ),
    [docs]
  );

  const isAppealDue = (c: any) =>
    c.appeal_deadline &&
    new Date(c.appeal_deadline) > new Date() &&
    new Date(c.appeal_deadline).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30;

  // ── Filtered + searched cases ────────────────────────────────
  const filteredCases = useMemo(() => {
    let result = filterStatus === "all" ? cases : cases.filter((c) => c.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.case_number?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.plaintiff_name?.toLowerCase().includes(q) ||
          c.defendant_name?.toLowerCase().includes(q) ||
          c.court?.toLowerCase().includes(q) ||
          c.judgment_number?.toLowerCase().includes(q) ||
          c.deed_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [cases, filterStatus, searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleStatusChange = async (caseId: string, newStatus: string) => {
    try {
      const updateData: Record<string, any> = { status: newStatus };
      if (newStatus === "closed" || newStatus === "closed_final") {
        updateData.closed_at = new Date().toISOString();
      }
      if (newStatus !== "closed" && newStatus !== "closed_final") {
        updateData.closed_at = null;
      }
      const { error } = await supabase.from("cases").update(updateData as never).eq("id", caseId);
      if (error) throw error;
      toast.success("تم تحديث حالة القضية بنجاح");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "فشل تحديث الحالة");
    }
  };

  const handleTransfer = async (caseId: string, target: string) => {
    try {
      const val = target || null;
      const { error } = await supabase.from("cases").update({ transferred_to: val }).eq("id", caseId);
      if (error) throw error;
      if (val) {
        toast.success(`تم نقل القضية إلى: ${TRANSFER_LABELS[val]}`);
      } else {
        toast.success("تم إلغاء نقل القضية");
      }
      refetch();
    } catch (err: any) {
      toast.error(err.message || "فشل نقل القضية");
    }
  };

  const startAdd = () => { setEditing(null); setOpen(true); };
  const startEdit = (row: any) => { setEditing(row); setOpen(true); };

  // ── Stats summary ────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = cases.length;
    const open = cases.filter((c) => c.status === "open").length;
    const inStudy = cases.filter((c) => c.status === "in_study").length;
    const closed = cases.filter((c) =>
      ["closed", "closed_final", "closed_non_final"].includes(c.status)
    ).length;
    return { total, open, inStudy, closed };
  }, [cases]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        icon={Briefcase}
        title="إدارة القضايا"
        subtitle={`${stats.total} قضية — ${stats.open} مفتوحة، ${stats.inStudy} قيد الدراسة، ${stats.closed} منتهية`}
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg border bg-card p-1">
              <Button
                size="sm"
                variant={view === "grid" ? "default" : "ghost"}
                onClick={() => setView("grid")}
                className="h-8 px-3 gap-1"
              >
                <LayoutGrid className="h-4 w-4" /> مربعات
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "default" : "ghost"}
                onClick={() => setView("list")}
                className="h-8 px-3 gap-1"
              >
                <List className="h-4 w-4" /> قائمة
              </Button>
            </div>
            <AddButton label="إضافة قضية" onClick={startAdd} />
          </div>
        }
      />

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالرقم، العنوان، الأطراف، المحكمة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pr-9 pl-8 rounded-lg border bg-card text-sm text-right"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="تصفية حسب الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات ({cases.length})</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label} ({cases.filter((c) => c.status === s.value).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Edit Dialog */}
      <CrudDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "تعديل قضية" : "قضية جديدة"}
        fields={fields}
        initial={editing ?? { status: "open", case_type: "civil" }}
        loading={upsert.isPending}
        onSubmit={async (v) => {
          await upsert.mutateAsync({ ...v, id: editing?.id });
        }}
      />

      {/* Detail Dialog */}
      <CaseDetailDialog
        caseData={detailCase}
        open={!!detailCase}
        onOpenChange={(v) => { if (!v) setDetailCase(null); }}
        sessions={sessions}
        docs={docs}
        clients={clients}
        caseDetails={caseDetails}
        caseParties={caseParties}
        caseJudgments={caseJudgments}
        lawsuitRequests={lawsuitRequests}
        onEdit={startEdit}
      />

      {/* Content */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">جارٍ التحميل...</p>
      ) : view === "list" ? (
        renderListView({
          filteredCases,
          getSessionCount,
          getJudgmentCount,
          STATUS_LABEL_MAP,
          getStatusInfo,
          handleStatusChange,
          handleTransfer,
          startEdit,
          del,
          setDetailCase,
        })
      ) : filteredCases.length === 0 ? (
        <Card className="card-luxe border-none p-10 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery || filterStatus !== "all"
              ? "لا توجد قضايا مطابقة لفلترك الحالي"
              : "لا توجد قضايا — ابدأ بإضافة قضية جديدة"}
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCases.map((c) =>
            renderCaseCard({
              c,
              statusInfo: getStatusInfo(c.status),
              sessionCount: getSessionCount(c.id),
              judgmentCount: getJudgmentCount(c.id),
              memoCount: getMemoCount(c.id),
              nextSession: getNextSession(c.id),
              judgmentDocs: getJudgmentDocs(c.id),
              isAppealDue: isAppealDue(c),
              caseParties: getCaseParties(c.case_number),
              caseJudgments: getCaseJudgmentsFromTable(c.case_number),
              onStatusChange: handleStatusChange,
              onTransfer: handleTransfer,
              onEdit: startEdit,
              onDetail: setDetailCase,
              onDelete: (row: any) => del.mutate(row.id),
              formatDate,
              CASE_TYPE_LABELS,
              TRANSFER_TARGETS,
              TRANSFER_LABELS,
            })
          )}
        </div>
      )}
    </>
  );
}

// ─── Status label map for list view ──────────────────────────────
const STATUS_LABEL_MAP: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
);

// ─── Case Card Renderer ──────────────────────────────────────────
function renderCaseCard({
  c,
  statusInfo,
  sessionCount,
  judgmentCount,
  memoCount,
  nextSession,
  judgmentDocs,
  isAppealDue,
  caseParties,
  caseJudgments,
  onStatusChange,
  onTransfer,
  onEdit,
  onDetail,
  onDelete,
  formatDate: fmtDate,
  CASE_TYPE_LABELS: typeLabels,
  TRANSFER_TARGETS: transferTargets,
  TRANSFER_LABELS: transferLabels,
}: {
  c: any;
  statusInfo: any;
  sessionCount: number;
  judgmentCount: number;
  memoCount: number;
  nextSession: any;
  judgmentDocs: any[];
  isAppealDue: boolean;
  caseParties: any[];
  caseJudgments: any[];
  onStatusChange: (id: string, status: string) => void;
  onTransfer: (id: string, target: string) => void;
  onEdit: (row: any) => void;
  onDetail: (row: any) => void;
  onDelete: (row: any) => void;
  formatDate: (d: string | null | undefined) => string;
  CASE_TYPE_LABELS: Record<string, string>;
  TRANSFER_TARGETS: { value: string; label: string; icon: string }[];
  TRANSFER_LABELS: Record<string, string>;
}) {
  return (
    <Card
      key={c.id}
      className={`card-luxe border-none p-0 overflow-hidden transition-all hover:shadow-lg ${
        c.transferred_to ? "ring-2 ring-blue-300/50" : ""
      }`}
    >
      {c.is_draft && (
        <div className="bg-orange-500/90 text-white text-center py-1 text-xs font-bold">
          صحيفة دعوي غير مكتملة
        </div>
      )}
      {/* ── Header: Status + Transfer controls ── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-2">
        {/* Status Dropdown */}
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={c.status} onValueChange={(v) => onStatusChange(c.id, v)}>
            <SelectTrigger className="h-7 w-auto min-w-[130px] border-0 p-0 px-0 [&>svg]:ml-1">
              <Badge
                className={`cursor-pointer text-[11px] ${statusInfo.color} border font-bold hover:opacity-80 transition`}
              >
                {statusInfo.label}
                <ChevronDown className="h-3 w-3 mr-1 opacity-60" />
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transfer Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              نقل
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>نقل القضية إلى</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {transferTargets.map((t) => (
              <DropdownMenuItem
                key={t.value}
                onClick={() => onTransfer(c.id, t.value)}
                className={`gap-2 ${c.transferred_to === t.value ? "bg-green-50 text-green-700 font-bold" : ""}`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {c.transferred_to === t.value && (
                  <span className="mr-auto text-green-600 font-bold">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            {c.transferred_to && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onTransfer(c.id, "")}
                  className="text-red-600"
                >
                  <X className="h-3.5 w-3.5 ml-1" /> إلغاء النقل
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Transferred badge */}
      {c.transferred_to && (
        <div className="px-5 pb-1">
          <Badge
            variant="outline"
            className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
          >
            ↗ منقولة إلى: {transferLabels[c.transferred_to] || c.transferred_to}
          </Badge>
        </div>
      )}

      {/* ── Body — click to edit ── */}
      <div className="px-5 pb-2 cursor-pointer" onClick={() => onEdit(c)}>
        {/* Case number + type */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Hash className="h-3.5 w-3.5 text-[#8a6a1a]" />
          <span className="text-xs font-bold text-[#8a6a1a]">#{c.case_number}</span>
          <Badge variant="outline" className="text-[10px] mr-auto">
            {typeLabels[c.case_type] || c.case_type}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="font-extrabold text-base mb-2 leading-snug text-[#1f1810] line-clamp-2">
          {c.title}
        </h3>

        {/* Parties */}
        <div className="space-y-1 mb-2">
          {c.plaintiff_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <span className="text-muted-foreground text-xs min-w-[55px]">المدعي:</span>
              <span className="font-medium text-[#1f1810] truncate">{c.plaintiff_name}</span>
            </div>
          )}
          {c.defendant_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span className="text-muted-foreground text-xs min-w-[55px]">المدعى عليه:</span>
              <span className="font-medium text-[#1f1810] truncate">{c.defendant_name}</span>
            </div>
          )}
        </div>

        {caseParties.length > 0 && (
          <div className="space-y-1 mb-2">
            {caseParties.filter((p) => p.party_type === "plaintiff").map((p, i) => (
              <div key={`cp-pl-${i}`} className="flex items-center gap-2 text-sm">
                <Users className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <span className="text-muted-foreground text-xs min-w-[55px]">مدعي:</span>
                <span className="font-medium text-[#1f1810] truncate">{p.party_name}</span>
              </div>
            ))}
            {caseParties.filter((p) => p.party_type === "defendant").map((p, i) => (
              <div key={`cp-df-${i}`} className="flex items-center gap-2 text-sm">
                <Users className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <span className="text-muted-foreground text-xs min-w-[55px]">مدعى عليه:</span>
                <span className="font-medium text-[#1f1810] truncate">{p.party_name}</span>
              </div>
            ))}
          </div>
        )}

        {c.court && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-muted-foreground text-xs min-w-[55px]">المحكمة:</span>
            <span className="font-medium text-[#1f1810] truncate">{c.court}</span>
          </div>
        )}

        {/* Circuit + Opened date */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          {c.circuit_number && (
            <span>الدائرة: {c.circuit_number}</span>
          )}
          {c.opened_at && (
            <span>القيد: {fmtDate(c.opened_at)}</span>
          )}
        </div>

        {/* Judgment Info */}
        {(c.judgment_number || c.judgment_date || c.deed_number) && (
          <div className="bg-amber-50/60 rounded-lg p-2.5 mb-2 border border-amber-200/60">
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileCheck className="h-3.5 w-3.5 text-amber-700" />
              <span className="text-xs font-bold text-amber-800">بيانات الحكم</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {c.judgment_number && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">رقم الحكم:</span>
                  <span className="font-semibold">{c.judgment_number}</span>
                </div>
              )}
              {c.deed_number && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">رقم الصك:</span>
                  <span className="font-semibold">{c.deed_number}</span>
                </div>
              )}
              {c.judgment_date && (
                <div className="flex items-center gap-1 col-span-2">
                  <span className="text-muted-foreground">تاريخ الحكم:</span>
                  <span className="font-semibold">{fmtDate(c.judgment_date)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appeal deadline warning */}
        {isAppealDue && (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-orange-700 bg-orange-50 rounded-md px-2 py-1.5 border border-orange-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="font-medium">مهلة الاستئناف: {fmtDate(c.appeal_deadline)}</span>
          </div>
        )}

        {/* Next session */}
        {nextSession && (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-blue-700 bg-blue-50 rounded-md px-2 py-1.5 border border-blue-200">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">الجلسة القادمة: {fmtDate(nextSession.session_date)}</span>
            {nextSession.court && (
              <span className="text-blue-600 truncate">— {nextSession.court}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Footer: Stats + Actions ── */}
      <div className="px-5 py-3 border-t-2 border-gold/20 bg-gradient-to-l from-gold/5 to-transparent">
        <div className="grid grid-cols-4 gap-2 mb-2">
          <CardStat icon={Calendar} label="جلسات" value={sessionCount} />
          <CardStat icon={FileText} label="مذكرات" value={memoCount} />
          <CardStat icon={Gavel} label="أحكام" value={judgmentCount} />
          <CardStat
            icon={Scale}
            label="نوع"
            value={typeLabels[c.case_type] || "—"}
            isText
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 pt-2 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 flex-1"
            onClick={(e) => { e.stopPropagation(); onDetail(c); }}
          >
            <Eye className="h-3 w-3" /> تفاصيل
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("هل أنت متأكد من حذف هذه القضية؟")) {
                onDelete(c);
              }
            }}
          >
            حذف
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── List View ───────────────────────────────────────────────────
function renderListView({
  filteredCases,
  getSessionCount,
  getJudgmentCount,
  STATUS_LABEL_MAP: statusLabels,
  getStatusInfo,
  handleStatusChange,
  handleTransfer,
  startEdit,
  del,
  setDetailCase,
}: any) {
  return (
    <DataTable
      rows={filteredCases}
      columns={[
        { key: "case_number", header: "رقم القضية" },
        { key: "title", header: "العنوان" },
        {
          key: "plaintiff_name",
          header: "المدعي",
          render: (r: any) => r.plaintiff_name || "—",
        },
        {
          key: "defendant_name",
          header: "المدعى عليه",
          render: (r: any) => r.defendant_name || "—",
        },
        {
          key: "court",
          header: "المحكمة",
          render: (r: any) => r.court || "—",
        },
        {
          key: "status",
          header: "الحالة",
          render: (r: any) => (
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={r.status}
                onValueChange={(v) => handleStatusChange(r.id, v)}
              >
                <SelectTrigger className="h-7 w-[150px] border-0 p-0">
                  <Badge
                    className={`text-[10px] ${getStatusInfo(r.status).color} border`}
                  >
                    {statusLabels[r.status] || r.status}
                    <ChevronDown className="h-3 w-3 mr-1 opacity-50" />
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ),
        },
        {
          key: "sessions",
          header: "جلسات",
          render: (r: any) => getSessionCount(r.id),
        },
        {
          key: "judgments",
          header: "أحكام",
          render: (r: any) => getJudgmentCount(r.id),
        },
        {
          key: "transfer",
          header: "منقولة",
          render: (r: any) =>
            r.transferred_to ? (
              <Badge
                variant="outline"
                className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
              >
                {TRANSFER_LABELS[r.transferred_to] || r.transferred_to}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            ),
        },
        {
          key: "actions",
          header: "",
          render: (r: any) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setDetailCase(r)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>نقل إلى قسم</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {TRANSFER_TARGETS.map((t) => (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={() => handleTransfer(r.id, t.value)}
                      className={
                        r.transferred_to === t.value
                          ? "bg-green-50 text-green-700"
                          : ""
                      }
                    >
                      {t.label}
                      {r.transferred_to === t.value && (
                        <span className="mr-2 text-green-600">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  {r.transferred_to && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleTransfer(r.id, "")}
                        className="text-red-600"
                      >
                        إلغاء النقل
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
        },
      ]}
      onEdit={startEdit}
      onDelete={(r: any) => {
        if (confirm("هل أنت متأكد من حذف هذه القضية؟")) del.mutate(r.id);
      }}
    />
  );
}

// ─── Case Detail Dialog ──────────────────────────────────────────
function CaseDetailDialog({
  caseData,
  open,
  onOpenChange,
  sessions,
  docs,
  clients,
  caseDetails,
  caseParties,
  caseJudgments,
  lawsuitRequests,
  onEdit,
}: {
  caseData: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: any[];
  docs: any[];
  clients: any[];
  caseDetails: any[];
  caseParties: any[];
  caseJudgments: any[];
  lawsuitRequests: any[];
  onEdit: (row: any) => void;
}) {
  if (!caseData) return null;

  const c = caseData;
  const client = clients.find((cl) => cl.id === c.client_id);
  const caseSessions = sessions
    .filter((s) => s.case_id === c.id)
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
  const caseDocs = docs.filter((d) => d.case_id === c.id);
  const statusInfo = getStatusInfo(c.status);
  const detail = caseDetails.find((d) => d.case_number === c.case_number);
  const parties = caseParties.filter((p) => p.case_number === c.case_number);
  const judgments = caseJudgments.filter((j) => j.case_number === c.case_number);
  const linkedRequests = lawsuitRequests.filter((r) => r.case_number === c.case_number);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-xl flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => {
                onOpenChange(false);
                onEdit(c);
              }}
            >
              <FileText className="h-4 w-4" /> تعديل
            </Button>
            <span>تفاصيل القضية #{c.case_number}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-3">
          {/* Status + Type row */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`${statusInfo.color} border font-bold`}>
              {statusInfo.label}
            </Badge>
            <Badge variant="outline">
              {CASE_TYPE_LABELS[c.case_type] || c.case_type}
            </Badge>
            {c.transferred_to && (
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                ↗ منقولة إلى: {TRANSFER_LABELS[c.transferred_to]}
              </Badge>
            )}
          </div>

          {/* Main Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="عنوان القضية" value={c.title} />
            <InfoBlock label="رقم القضية" value={c.case_number} />
            <InfoBlock label="المدعي" value={c.plaintiff_name || "—"} />
            <InfoBlock label="المدعى عليه" value={c.defendant_name || "—"} />
            <InfoBlock label="المحكمة" value={c.court || "—"} />
            <InfoBlock label="رقم الدائرة" value={c.circuit_number || "—"} />
            <InfoBlock label="تاريخ القيد" value={formatDate(c.opened_at)} />
            {client && (
              <InfoBlock label="العميل" value={client.full_name} />
            )}
          </div>

          {detail?.subject_matter && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                موضوع الدعوي
              </h4>
              <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3">
                {detail.subject_matter}
              </p>
            </div>
          )}

          {detail?.plaintiff_requests && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                طلبات المدعي
              </h4>
              <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3">
                {detail.plaintiff_requests}
              </p>
            </div>
          )}

          {detail?.case_foundations && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5" />
                أسانيد الدعوي
              </h4>
              <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3">
                {detail.case_foundations}
              </p>
            </div>
          )}

          {parties.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                أطراف الدعوي ({parties.length})
              </h4>
              <div className="space-y-2">
                {parties.filter((p) => p.party_type === "plaintiff").length > 0 && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <span className="text-xs font-bold text-green-800 mb-1 block">المدعون</span>
                    {parties
                      .filter((p) => p.party_type === "plaintiff")
                      .map((p, i) => (
                        <div key={`dp-pl-${i}`} className="text-sm py-0.5">
                          {p.party_name}
                          {p.role && <span className="text-muted-foreground text-xs mr-2">({p.role})</span>}
                        </div>
                      ))}
                  </div>
                )}
                {parties.filter((p) => p.party_type === "defendant").length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <span className="text-xs font-bold text-red-800 mb-1 block">المدعى عليهم</span>
                    {parties
                      .filter((p) => p.party_type === "defendant")
                      .map((p, i) => (
                        <div key={`dp-df-${i}`} className="text-sm py-0.5">
                          {p.party_name}
                          {p.role && <span className="text-muted-foreground text-xs mr-2">({p.role})</span>}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {caseSessions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                الجلسات ({caseSessions.length})
              </h4>
              <div className="space-y-2">
                {caseSessions.map((s: any) => (
                  <div
                    key={s.id}
                    className="bg-muted/30 rounded-lg px-3 py-2 border text-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                      >
                        {s.status === "scheduled"
                          ? "مجدولة"
                          : s.status === "held"
                            ? "منعقدة"
                            : s.status === "postponed"
                              ? "مؤجلة"
                              : s.status}
                      </Badge>
                      <span className="font-medium">{formatDate(s.session_date)}</span>
                      {s.session_time && (
                        <span className="text-xs text-muted-foreground">{s.session_time}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {s.court && <span>{s.court}</span>}
                      {s.circuit && <span>دائرة: {s.circuit}</span>}
                      {s.mechanism && <span>آلية: {s.mechanism}</span>}
                      {s.degree && <span>درجة: {s.degree}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {judgments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5" />
                الأحكام ({judgments.length})
              </h4>
              <div className="space-y-2">
                {judgments.map((j: any, i: number) => (
                  <div
                    key={j.id || i}
                    className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {j.finality && (
                        <Badge variant="outline" className="text-[10px]">
                          {j.finality === "final" ? "قطعي" : j.finality === "non_final" ? "غير نهائي" : j.finality}
                        </Badge>
                      )}
                      {j.deed_number && (
                        <span className="text-xs">صك: {j.deed_number}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {j.deed_date && (
                        <div><span className="text-muted-foreground">تاريخ الصك:</span> {formatDate(j.deed_date)}</div>
                      )}
                      {j.court && (
                        <div><span className="text-muted-foreground">المحكمة:</span> {j.court}</div>
                      )}
                      {j.circuit && (
                        <div><span className="text-muted-foreground">الدائرة:</span> {j.circuit}</div>
                      )}
                      {j.degree && (
                        <div><span className="text-muted-foreground">الدرجة:</span> {j.degree}</div>
                      )}
                      {j.appeal_type && (
                        <div><span className="text-muted-foreground">الاستئناف:</span> {j.appeal_type}</div>
                      )}
                      {j.appeal_number && (
                        <div><span className="text-muted-foreground">رقم الاستئناف:</span> {j.appeal_number}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {linkedRequests.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileSignature className="h-3.5 w-3.5" />
                الطلبات علي القضية ({linkedRequests.length})
              </h4>
              <div className="space-y-2">
                {linkedRequests.map((r: any, i: number) => (
                  <div
                    key={r.id || i}
                    className="bg-muted/30 rounded-lg px-3 py-2 border text-sm"
                  >
                    <div className="font-medium">{r.request_type || r.title || `طلب #${i + 1}`}</div>
                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                    )}
                    {r.status && (
                      <Badge variant="outline" className="text-[10px] mt-1">{r.status}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf,.jpg,.jpeg,.png";
                input.onchange = async (e: any) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fileName = `judgment_${c.case_number}_${Date.now()}_${file.name}`;
                  const { error } = await supabase.storage
                    .from("documents")
                    .upload(fileName, file);
                  if (error) {
                    toast.error("فشل رفع المستند");
                    return;
                  }
                  const { data: urlData } = supabase.storage
                    .from("documents")
                    .getPublicUrl(fileName);
                  await supabase.from("documents").insert({
                    case_id: c.id,
                    title: `صك الحكم - ${c.case_number}`,
                    doc_type: "judgment_deed",
                    file_url: urlData.publicUrl,
                  } as never);
                  toast.success("تم رفع مستند صك الحكم بنجاح");
                };
                input.click();
              }}
            >
              <Upload className="h-4 w-4" />
              رفع مستند صك الحكم
            </Button>
          </div>

          {/* Judgment Info */}
          {(c.judgment_number || c.judgment_date || c.deed_number) && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="h-4 w-4 text-amber-700" />
                <span className="font-bold text-amber-800">بيانات الحكم</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoBlock label="رقم الحكم" value={c.judgment_number || "—"} />
                <InfoBlock label="رقم الصك" value={c.deed_number || "—"} />
                <InfoBlock label="تاريخ الحكم" value={formatDate(c.judgment_date)} />
              </div>
            </div>
          )}

          {/* Appeal Deadline */}
          {c.appeal_deadline && (
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-700" />
                <span className="font-bold text-orange-800 text-sm">
                  مهلة الاستئناف: {formatDate(c.appeal_deadline)}
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          {c.description && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-1">
                وصف القضية
              </h4>
              <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3">
                {c.description}
              </p>
            </div>
          )}

          {/* Documents */}
          {caseDocs.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileSignature className="h-3.5 w-3.5" />
                المستندات ({caseDocs.length})
              </h4>
              <div className="space-y-2">
                {caseDocs.map((d: any) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 text-sm bg-muted/30 rounded-lg px-3 py-2 border"
                  >
                    <FileText className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="font-medium truncate">{d.title || d.doc_type}</span>
                    <span className="text-xs text-muted-foreground mr-auto">
                      {formatDate(d.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Small reusable components ───────────────────────────────────
function CardStat({
  icon: Icon,
  label,
  value,
  isText = false,
}: {
  icon: any;
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-gold mb-1" />
      <div className={`font-bold ${isText ? "text-[10px]" : "text-base"}`}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <p className="text-sm font-semibold mt-0.5 break-words">{value}</p>
    </div>
  );
}
