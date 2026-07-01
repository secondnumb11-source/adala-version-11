import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  ClipboardList,
  LayoutGrid,
  List,
  FileText,
  ChevronDown,
  User,
  Building2,
  Hash,
  Eye,
  Search,
  X,
  Scale,
  FileCheck,
  FileSignature,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useList, useUpsert, useDelete } from "@/lib/data-hooks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/lawsuit-requests")({
  component: LawsuitRequestsPage,
});

const STATUS_OPTIONS = [
  { value: "new", label: "جديد", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "in_review", label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "approved", label: "معتمد", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "rejected", label: "مرفوض", color: "bg-red-100 text-red-800 border-red-300" },
  { value: "in_progress", label: "قيد التنفيذ", color: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "completed", label: "مكتمل", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "closed", label: "مغلق", color: "bg-gray-100 text-gray-700 border-gray-300" },
];

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

function useRequestFields(casesList: any[]): Field[] {
  return [
    {
      name: "case_id",
      label: "القضية",
      type: "select",
      required: true,
      options: casesList.map((c) => ({ value: c.id, label: `${c.case_number} - ${c.title || ""}` })),
    },
    { name: "case_number", label: "رقم القضية" },
    { name: "case_date", label: "تاريخ القضية", type: "date" },
    { name: "court_name", label: "اسم المحكمة" },
    { name: "circuit_number", label: "رقم الدائرة" },
    {
      name: "case_status",
      label: "حالة القضية",
    },
    {
      name: "case_classification",
      label: "تصنيف القضية",
    },
    {
      name: "case_type_detail",
      label: "تفاصيل نوع القضية",
    },
    {
      name: "applicant_type",
      label: "نوع مقدم الطلب",
      type: "select",
      options: [
        { value: "plaintiff", label: "مدعي" },
        { value: "defendant", label: "مدعى عليه" },
        { value: "lawyer", label: "محامي" },
        { value: "other", label: "أخرى" },
      ],
    },
    { name: "applicant_name", label: "اسم مقدم الطلب" },
    {
      name: "request_type",
      label: "نوع الطلب",
      required: true,
      type: "select",
      options: [
        { value: "execution", label: "تنفيذ" },
        { value: "appeal", label: "استئناف" },
        { value: "objection", label: "اعتراض" },
        { value: "interim_measure", label: "تدبير تحفظي" },
        { value: "enforcement", label: "إنفاذ" },
        { value: "correction", label: "تصحيح" },
        { value: "other", label: "أخرى" },
      ],
    },
    {
      name: "status",
      label: "الحالة",
      type: "select",
      options: STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
    },
    { name: "judgment_number", label: "رقم الحكم" },
    { name: "submissions", label: "التسبيبات", type: "textarea", full: true },
    { name: "request_reasons", label: "أسباب الطلب", type: "textarea", full: true },
    { name: "reason_1", label: "السبب 1" },
    { name: "reason_2", label: "السبب 2" },
    { name: "reason_3", label: "السبب 3" },
    { name: "reason_4", label: "السبب 4" },
    { name: "reason_5", label: "السبب 5" },
    { name: "reason_6", label: "السبب 6" },
  ];
}

function LawsuitRequestsPage() {
  const { data: requests = [], isLoading, refetch } = useList<any>("lawsuit_requests");
  const { data: casesList = [] } = useList<any>("cases");
  const upsert = useUpsert("lawsuit_requests");
  const del = useDelete("lawsuit_requests");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailRequest, setDetailRequest] = useState<any | null>(null);

  const fields = useRequestFields(casesList);

  const requestTypes = useMemo(() => {
    const types = new Set<string>();
    requests.forEach((r) => { if (r.request_type) types.add(r.request_type); });
    return Array.from(types);
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let result = filterStatus === "all" ? requests : requests.filter((r) => r.status === filterStatus);
    if (filterType !== "all") {
      result = result.filter((r) => r.request_type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.case_number?.toLowerCase().includes(q) ||
          r.request_type?.toLowerCase().includes(q) ||
          r.court_name?.toLowerCase().includes(q) ||
          r.applicant_name?.toLowerCase().includes(q) ||
          r.judgment_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [requests, filterStatus, filterType, searchQuery]);

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("lawsuit_requests")
        .update({ status: newStatus } as never)
        .eq("id", requestId);
      if (error) throw error;
      toast.success("تم تحديث حالة الطلب بنجاح");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "فشل تحديث الحالة");
    }
  };

  const startAdd = () => { setEditing(null); setOpen(true); };
  const startEdit = (row: any) => { setEditing(row); setOpen(true); };

  const stats = useMemo(() => {
    const total = requests.length;
    const newCount = requests.filter((r) => r.status === "new").length;
    const inReview = requests.filter((r) => r.status === "in_review").length;
    const completed = requests.filter((r) =>
      ["completed", "approved", "closed"].includes(r.status)
    ).length;
    return { total, newCount, inReview, completed };
  }, [requests]);

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="الطلبات علي القضايا"
        subtitle={`${stats.total} طلب — ${stats.newCount} جديد، ${stats.inReview} قيد المراجعة، ${stats.completed} مكتمل`}
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
            <AddButton label="إضافة طلب" onClick={startAdd} />
          </div>
        }
      />

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث برقم القضية، المحكمة، مقدم الطلب..."
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
            <SelectItem value="all">جميع الحالات ({requests.length})</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label} ({requests.filter((r) => r.status === s.value).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="تصفية حسب نوع الطلب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأنواع</SelectItem>
            {requestTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t} ({requests.filter((r) => r.request_type === t).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Edit Dialog */}
      <CrudDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "تعديل طلب" : "طلب جديد"}
        fields={fields}
        initial={editing ?? { status: "new" }}
        loading={upsert.isPending}
        onSubmit={async (v) => {
          await upsert.mutateAsync({ ...v, id: editing?.id });
        }}
      />

      {/* Detail Dialog */}
      <RequestDetailDialog
        requestData={detailRequest}
        open={!!detailRequest}
        onOpenChange={(v) => { if (!v) setDetailRequest(null); }}
        onEdit={startEdit}
      />

      {/* Content */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">جارٍ التحميل...</p>
      ) : view === "list" ? (
        <ListView
          filteredRequests={filteredRequests}
          getStatusInfo={getStatusInfo}
          handleStatusChange={handleStatusChange}
          startEdit={startEdit}
          del={del}
          setDetailRequest={setDetailRequest}
        />
      ) : filteredRequests.length === 0 ? (
        <Card className="card-luxe border-none p-10 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery || filterStatus !== "all" || filterType !== "all"
              ? "لا توجد طلبات مطابقة لفلترك الحالي"
              : "لا توجد طلبات — ابدأ بإضافة طلب جديد"}
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredRequests.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              statusInfo={getStatusInfo(r.status)}
              onStatusChange={handleStatusChange}
              onEdit={startEdit}
              onDetail={setDetailRequest}
              onDelete={(row: any) => del.mutate(row.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Request Card ────────────────────────────────────────────────
function RequestCard({
  r,
  statusInfo,
  onStatusChange,
  onEdit,
  onDetail,
  onDelete,
}: {
  r: any;
  statusInfo: any;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (row: any) => void;
  onDetail: (row: any) => void;
  onDelete: (row: any) => void;
}) {
  return (
    <Card className="card-luxe border-none p-0 overflow-hidden transition-all hover:shadow-lg">
      {/* Header: Status */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-2">
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={r.status} onValueChange={(v) => onStatusChange(r.id, v)}>
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

        <Badge
          variant="outline"
          className="text-[10px] bg-purple-50 text-purple-700 border-purple-200"
        >
          {r.request_type || "—"}
        </Badge>
      </div>

      {/* Body */}
      <div className="px-5 pb-2 cursor-pointer" onClick={() => onDetail(r)}>
        {/* Case number */}
        {r.case_number && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Hash className="h-3.5 w-3.5 text-[#8a6a1a]" />
            <span className="text-xs font-bold text-[#8a6a1a]">#{r.case_number}</span>
          </div>
        )}

        {/* Court */}
        {r.court_name && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-muted-foreground text-xs min-w-[55px]">المحكمة:</span>
            <span className="font-medium text-[#1f1810] truncate">{r.court_name}</span>
          </div>
        )}

        {/* Applicant */}
        {r.applicant_name && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <User className="h-3.5 w-3.5 text-green-600 shrink-0" />
            <span className="text-muted-foreground text-xs min-w-[55px]">مقدم الطلب:</span>
            <span className="font-medium text-[#1f1810] truncate">{r.applicant_name}</span>
          </div>
        )}

        {/* Judgment Number */}
        {r.judgment_number && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <FileCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-muted-foreground text-xs min-w-[55px]">رقم الحكم:</span>
            <span className="font-medium text-[#1f1810] truncate">{r.judgment_number}</span>
          </div>
        )}
      </div>

      {/* Footer: Actions */}
      <div className="px-5 py-3 border-t-2 border-gold/20 bg-gradient-to-l from-gold/5 to-transparent">
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 flex-1"
            onClick={(e) => { e.stopPropagation(); onDetail(r); }}
          >
            <Eye className="h-3 w-3" /> تفاصيل
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 flex-1"
            onClick={(e) => { e.stopPropagation(); onEdit(r); }}
          >
            <FileText className="h-3 w-3" /> تعديل
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
                onDelete(r);
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
function ListView({
  filteredRequests,
  getStatusInfo: getSI,
  handleStatusChange,
  startEdit,
  del,
  setDetailRequest,
}: {
  filteredRequests: any[];
  getStatusInfo: (s: string) => any;
  handleStatusChange: (id: string, status: string) => void;
  startEdit: (row: any) => void;
  del: any;
  setDetailRequest: (row: any) => void;
}) {
  return (
    <DataTable
      rows={filteredRequests}
      columns={[
        { key: "case_number", header: "رقم القضية" },
        { key: "request_type", header: "نوع الطلب" },
        { key: "applicant_name", header: "مقدم الطلب" },
        { key: "court_name", header: "المحكمة" },
        { key: "judgment_number", header: "رقم الحكم" },
        {
          key: "status",
          header: "الحالة",
          render: (r: any) => {
            const si = getSI(r.status);
            return (
              <div onClick={(e) => e.stopPropagation()}>
                <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v)}>
                  <SelectTrigger className="h-7 w-[150px] border-0 p-0">
                    <Badge className={`text-[10px] ${si.color} border`}>
                      {si.label}
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
            );
          },
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
                onClick={() => setDetailRequest(r)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          ),
        },
      ]}
      onEdit={startEdit}
      onDelete={(r: any) => {
        if (confirm("هل أنت متأكد من حذف هذا الطلب؟")) del.mutate(r.id);
      }}
    />
  );
}

// ─── Detail Dialog ───────────────────────────────────────────────
function RequestDetailDialog({
  requestData,
  open,
  onOpenChange,
  onEdit,
}: {
  requestData: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (row: any) => void;
}) {
  if (!requestData) return null;

  const r = requestData;
  const statusInfo = getStatusInfo(r.status);

  const reasons = [r.reason_1, r.reason_2, r.reason_3, r.reason_4, r.reason_5, r.reason_6].filter(
    (v) => v && String(v).trim() !== ""
  );

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
                onEdit(r);
              }}
            >
              <FileText className="h-4 w-4" /> تعديل
            </Button>
            <span>تفاصيل الطلب {r.request_type ? `— ${r.request_type}` : ""}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-3">
          {/* Status badge */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`${statusInfo.color} border font-bold`}>
              {statusInfo.label}
            </Badge>
            {r.request_type && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                {r.request_type}
              </Badge>
            )}
          </div>

          {/* بيانات القضية */}
          <div className="bg-muted/30 rounded-lg p-4 border">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-[#8a6a1a]" />
              <span className="font-bold text-sm">بيانات القضية</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoBlock label="رقم القضية" value={r.case_number || "—"} />
              <InfoBlock label="تاريخ القضية" value={formatDate(r.case_date)} />
              <InfoBlock label="اسم المحكمة" value={r.court_name || "—"} />
              <InfoBlock label="رقم الدائرة" value={r.circuit_number || "—"} />
              <InfoBlock label="حالة القضية" value={r.case_status || "—"} />
              <InfoBlock label="تصنيف القضية" value={r.case_classification || "—"} />
              <InfoBlock label="تفاصيل نوع القضية" value={r.case_type_detail || "—"} />
            </div>
          </div>

          {/* بيانات مقدم الطلب */}
          <div className="bg-muted/30 rounded-lg p-4 border">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-green-600" />
              <span className="font-bold text-sm">بيانات مقدم الطلب</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoBlock label="نوع مقدم الطلب" value={r.applicant_type || "—"} />
              <InfoBlock label="اسم مقدم الطلب" value={r.applicant_name || "—"} />
            </div>
          </div>

          {/* نوع الطلب */}
          <div className="bg-muted/30 rounded-lg p-4 border">
            <div className="flex items-center gap-2 mb-3">
              <FileSignature className="h-4 w-4 text-purple-600" />
              <span className="font-bold text-sm">نوع الطلب</span>
            </div>
            <InfoBlock label="نوع الطلب" value={r.request_type || "—"} />
          </div>

          {/* رقم الحكم */}
          {(r.judgment_number) && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="h-4 w-4 text-amber-700" />
                <span className="font-bold text-sm text-amber-800">رقم الحكم</span>
              </div>
              <InfoBlock label="رقم الحكم" value={r.judgment_number} />
            </div>
          )}

          {/* التسبيبات */}
          {r.submissions && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-1">التسبيبات</h4>
              <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3">
                {r.submissions}
              </p>
            </div>
          )}

          {/* أسباب الطلب */}
          {r.request_reasons && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-1">أسباب الطلب</h4>
              <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3">
                {r.request_reasons}
              </p>
            </div>
          )}

          {/* الأسباب التفصيلية */}
          {reasons.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-2">الأسباب</h4>
              <div className="space-y-2">
                {reasons.map((reason, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2 border">
                    <span className="text-muted-foreground text-xs font-bold mt-0.5">{idx + 1}.</span>
                    <span className="break-words">{reason}</span>
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
function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <p className="text-sm font-semibold mt-0.5 break-words">{value}</p>
    </div>
  );
}
