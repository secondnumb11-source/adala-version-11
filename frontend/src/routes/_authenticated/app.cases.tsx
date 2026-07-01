import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, LayoutGrid, List, FileText, Calendar, Gavel, AlertTriangle, Users, Scale, Hash, ArrowRightLeft, MoreVertical } from "lucide-react";
import { PageHeader } from "@/components/section-shell";
import { CrudDialog, AddButton, type Field } from "@/components/crud-dialog";
import { DataTable } from "@/components/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useList, useUpsert, useDelete } from "@/lib/data-hooks";

export const Route = createFileRoute("/_authenticated/app/cases")({
  component: CasesPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة",
  in_study: "قيد الدراسة",
  closed_final: "منتهية",
  closed_non_final: "محكوم بها بحكم غير نهائي",
  appealed: "مؤجلة",
  final_judgment: "محكوم بها بحكم قطعي",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-500/15 text-green-600 border-green-500/30",
  in_study: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  closed_final: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  closed_non_final: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  appealed: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  final_judgment: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const TRANSFER_LABELS: Record<string, string> = {
  executions: "طلبات التنفيذ",
  powers_of_attorney: "الوكالات القضائية",
  documents_archive: "أرشيف المستندات والأحكام",
};

function useCaseFields(clients: any[]): Field[] {
  return [
    { name: "title", label: "عنوان القضية", required: true, full: true },
    { name: "case_number", label: "رقم القضية", required: true },
    { name: "case_type", label: "نوع القضية", type: "select", required: true, options: [
      { value: "civil", label: "مدنية" }, { value: "commercial", label: "تجارية" },
      { value: "labor", label: "عمالية" }, { value: "criminal", label: "جزائية" },
      { value: "personal_status", label: "أحوال شخصية" }, { value: "administrative", label: "إدارية" },
      { value: "execution", label: "تنفيذ" }, { value: "other", label: "أخرى" },
    ]},
    { name: "status", label: "الحالة", type: "select", options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })) },
    { name: "plaintiff_name", label: "اسم المدعي" },
    { name: "defendant_name", label: "اسم المدعى عليه" },
    { name: "court", label: "المحكمة" },
    { name: "circuit_number", label: "رقم الدائرة" },
    { name: "judgment_number", label: "رقم الحكم" },
    { name: "judgment_date", label: "تاريخ الحكم", type: "date" },
    { name: "deed_number", label: "رقم صك الحكم" },
    { name: "opened_at", label: "تاريخ القيد", type: "date" },
    { name: "client_id", label: "العميل", type: "select", options: clients.map((c) => ({ value: c.id, label: c.full_name })) },
    { name: "description", label: "وصف القضية", type: "textarea", full: true },
  ];
}

function CasesPage() {
  const { data: cases = [], isLoading } = useList<any>("cases");
  const { data: clients = [] } = useList<any>("clients");
  const { data: sessions = [] } = useList<any>("sessions");
  const { data: docs = [] } = useList<any>("documents");
  const upsert = useUpsert("cases");
  const del = useDelete("cases");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const fields = useCaseFields(clients);
  const startAdd = () => { setEditing(null); setOpen(true); };
  const startEdit = (row: any) => { setEditing(row); setOpen(true); };

  // Handle status change
  const handleStatusChange = async (caseId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const caseData = cases.find(c => c.id === caseId);
    if (caseData) {
      await upsert.mutateAsync({ ...caseData, status: newStatus });
    }
  };

  // Handle transfer
  const handleTransfer = async (caseId: string, section: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const caseData = cases.find(c => c.id === caseId);
    if (caseData) {
      await upsert.mutateAsync({ ...caseData, transferred_to: section || null });
    }
  };

  // counts per case
  const countFor = (caseId: string, type: "session" | "memo" | "judgment") => {
    if (type === "session") return sessions.filter((s) => s.case_id === caseId).length;
    if (type === "memo") return docs.filter((d) => d.case_id === caseId && d.doc_type === "memorandum").length;
    return docs.filter((d) => d.case_id === caseId && (d.doc_type === "judgment_final" || d.doc_type === "judgment_non_final")).length;
  };

  // Detect placeholder/incomplete cases (auto-created from sessions without full data scraped yet)
  const isIncomplete = (c: any): boolean => {
    if (!c) return false;
    const title: string = c.title || "";
    if (/قضية\s*\(?من جلسة\)?|بانتظار اكتمال|قضية مرتبطة بجلسة/.test(title)) return true;
    // Heuristic: synced from najiz but missing key contextual fields
    if (c.najiz_synced_at && !c.court && !c.description) {
      const courtFromTitle = /محكمة/.test(title);
      if (!courtFromTitle) return true;
    }
    return false;
  };

  const isAppealDue = (c: any) => c.appeal_deadline && new Date(c.appeal_deadline) > new Date()
    && (new Date(c.appeal_deadline).getTime() - Date.now()) < 1000 * 60 * 60 * 24 * 30;

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <>
      <PageHeader icon={Briefcase} title="إدارة القضايا" subtitle={`${cases.length} قضية`}
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg border bg-card p-1">
              <Button size="sm" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")} className="h-8 px-3 gap-1">
                <LayoutGrid className="h-4 w-4" /> مربعات
              </Button>
              <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")} className="h-8 px-3 gap-1">
                <List className="h-4 w-4" /> قائمة
              </Button>
            </div>
            <AddButton label="إضافة قضية" onClick={startAdd} />
          </div>
        }
      />

      <CrudDialog open={open} onOpenChange={setOpen} title={editing ? "تعديل قضية" : "قضية جديدة"}
        fields={fields} initial={editing ?? { status: "open", case_type: "civil" }}
        loading={upsert.isPending}
        onSubmit={async (v) => { await upsert.mutateAsync({ ...v, id: editing?.id }); }} />

      {isLoading ? <p className="text-center text-muted-foreground py-10">جارٍ التحميل...</p> : view === "list" ? (
        <DataTable rows={cases} columns={[
          { key: "case_number", header: "رقم القضية" },
          { key: "title", header: "العنوان" },
          { key: "parties", header: "الأطراف", render: (r) => (
            <div className="text-xs">
              {r.plaintiff_name && <div>المدعي: {r.plaintiff_name}</div>}
              {r.defendant_name && <div>المدعى عليه: {r.defendant_name}</div>}
              {!r.plaintiff_name && !r.defendant_name && <span className="text-muted-foreground">—</span>}
            </div>
          )},
          { key: "court", header: "المحكمة" },
          { key: "status", header: "الحالة", render: (r) => (
            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[r.status] || ""}`}>
              {STATUS_LABEL[r.status] || r.status}
            </Badge>
          )},
          { key: "judgment", header: "الحكم", render: (r) => (
            <div className="text-xs">
              {r.judgment_number && <div>رقم: {r.judgment_number}</div>}
              {r.judgment_date && <div>تاريخ: {formatDate(r.judgment_date)}</div>}
              {!r.judgment_number && !r.judgment_date && <span className="text-muted-foreground">—</span>}
            </div>
          )},
          { key: "sessions", header: "جلسات", render: (r) => countFor(r.id, "session") },
          { key: "memos", header: "مذكرات", render: (r) => countFor(r.id, "memo") },
          { key: "judgments", header: "أحكام", render: (r) => countFor(r.id, "judgment") },
        ]} onEdit={startEdit} onDelete={(r) => del.mutate(r.id)} />
      ) : (
        cases.length === 0 ? (
          <Card className="card-luxe border-none p-10 text-center">
            <p className="text-sm">لا توجد قضايا — ابدأ بإضافة قضية جديدة</p>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((c) => (
              <Card key={c.id} className="card-luxe border-none p-6 cursor-pointer relative hover:shadow-xl transition-all" onClick={() => startEdit(c)} data-testid={`case-card-${c.id}`}>
                {isIncomplete(c) && (
                  <div className="absolute -top-2 right-3 z-10">
                    <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-400 font-bold text-[10px] px-2 py-0.5 shadow-sm" data-testid="case-incomplete-badge">
                      غير مكتملة
                    </Badge>
                  </div>
                )}
                
                {/* Transfer indicator */}
                {c.transferred_to && (
                  <div className="absolute -top-2 left-3 z-10">
                    <Badge variant="outline" className="bg-blue-50 text-blue-900 border-blue-400 font-bold text-[10px] px-2 py-0.5 shadow-sm flex items-center gap-1">
                      <ArrowRightLeft className="h-3 w-3" />
                      منقولة إلى {TRANSFER_LABELS[c.transferred_to]}
                    </Badge>
                  </div>
                )}

                {/* Status and Transfer Dropdowns */}
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex-1">
                    <Select
                      value={c.status || "open"}
                      onValueChange={(value) => handleStatusChange(c.id, value, { stopPropagation: () => {} } as any)}
                    >
                      <SelectTrigger 
                        className={`h-8 text-xs font-bold border-2 ${STATUS_COLORS[c.status] || STATUS_COLORS.open}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent onClick={(e) => e.stopPropagation()}>
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Select
                      value={c.transferred_to || ""}
                      onValueChange={(value) => handleTransfer(c.id, value, { stopPropagation: () => {} } as any)}
                    >
                      <SelectTrigger 
                        className="h-8 text-xs border border-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue placeholder="نقل إلى..." />
                      </SelectTrigger>
                      <SelectContent onClick={(e) => e.stopPropagation()}>
                        <SelectItem value="">-- لا نقل --</SelectItem>
                        {Object.entries(TRANSFER_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Case number and appeal deadline */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-[#8a6a1a]">#{c.case_number}</div>
                  {isAppealDue(c) && (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertTriangle className="h-3 w-3" />
                      مهلة استئناف
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-extrabold text-lg mb-3 leading-snug text-[#1f1810]">{c.title}</h3>

                {/* Parties (plaintiff and defendant) */}
                {(c.plaintiff_name || c.defendant_name) && (
                  <div className="mb-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">أطراف الدعوى</span>
                    </div>
                    {c.plaintiff_name && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">المدعي:</span>
                        <span className="text-sm font-semibold text-foreground">{c.plaintiff_name}</span>
                      </div>
                    )}
                    {c.defendant_name && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">المدعى عليه:</span>
                        <span className="text-sm font-semibold text-foreground">{c.defendant_name}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Court and Circuit */}
                <div className="mb-3 space-y-1.5">
                  {c.court && (
                    <div className="flex items-center gap-2">
                      <Scale className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs text-muted-foreground">المحكمة:</span>
                      <span className="text-sm font-semibold text-foreground">{c.court}</span>
                    </div>
                  )}
                  {c.circuit_number && (
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs text-muted-foreground">رقم الدائرة:</span>
                      <span className="text-sm font-semibold text-foreground">{c.circuit_number}</span>
                    </div>
                  )}
                </div>

                {/* Judgment Information */}
                {(c.judgment_number || c.judgment_date || c.deed_number) && (
                  <div className="mb-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Gavel className="h-4 w-4 text-emerald-700" />
                      <span className="text-xs font-bold text-emerald-900">معلومات الحكم</span>
                    </div>
                    {c.judgment_number && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-emerald-800">رقم الحكم:</span>
                        <span className="text-sm font-bold text-emerald-900">{c.judgment_number}</span>
                      </div>
                    )}
                    {c.judgment_date && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-emerald-800">تاريخ الحكم:</span>
                        <span className="text-sm font-semibold text-emerald-900">{formatDate(c.judgment_date)}</span>
                      </div>
                    )}
                    {c.deed_number && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-800">رقم الصك:</span>
                        <span className="text-sm font-semibold text-emerald-900">{c.deed_number}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t-2 border-gold/20">
                  <Stat icon={Calendar} label="جلسات" value={countFor(c.id, "session")} />
                  <Stat icon={FileText} label="مذكرات" value={countFor(c.id, "memo")} />
                  <Stat icon={Gavel} label="أحكام" value={countFor(c.id, "judgment")} />
                </div>

                {/* Opened date */}
                {c.opened_at && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">تاريخ القيد:</span>
                    <span className="text-xs font-semibold text-foreground">{formatDate(c.opened_at)}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>

        )
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-gold mb-1" />
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
