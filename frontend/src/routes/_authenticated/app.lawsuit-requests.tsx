import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Eye, LayoutGrid, List, Scale, Hash, Calendar, User, Gavel } from "lucide-react";
import { PageHeader } from "@/components/section-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { useList } from "@/lib/data-hooks";

export const Route = createFileRoute("/_authenticated/app/lawsuit-requests")({
  component: LawsuitRequestsPage,
});

function LawsuitRequestsPage() {
  const { data: requests = [], isLoading } = useList<any>("lawsuit_requests");
  const [selected, setSelected] = useState<any | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch { return dateStr; }
  };

  return (
    <>
      <PageHeader icon={FileText} title="الطلبات على القضايا" subtitle={`${requests.length} طلب`}
        action={
          <div className="flex rounded-lg border bg-card p-1">
            <Button size="sm" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")} className="h-8 px-3 gap-1">
              <LayoutGrid className="h-4 w-4" /> مربعات
            </Button>
            <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")} className="h-8 px-3 gap-1">
              <List className="h-4 w-4" /> قائمة
            </Button>
          </div>
        }
      />

      {isLoading ? <p className="text-center text-muted-foreground py-10">جارٍ التحميل...</p> :
      requests.length === 0 ? (
        <Card className="card-luxe border-none p-10 text-center">
          <p className="text-sm">لا توجد طلبات على القضايا — قم بمزامنة بيانات ناجز</p>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {requests.map((r: any) => (
            <Card key={r.id} className="card-luxe border-none p-0 cursor-pointer hover:shadow-2xl transition-all duration-300 overflow-hidden group" onClick={() => setSelected(r)}>
              <div className="h-2 bg-gradient-to-l from-purple-500 via-purple-400 to-purple-500" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300 text-[10px] font-bold">
                    {r.request_type || "طلب على قضية"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{r.case_number}</span>
                </div>

                <h3 className="font-extrabold text-base mb-3 text-[#1f1810]">
                  قضية #{r.case_number}
                </h3>

                <div className="space-y-2 mb-3">
                  {r.court_name && (
                    <div className="flex items-center gap-2">
                      <Scale className="h-3 w-3 text-purple-600" />
                      <span className="text-[10px] text-muted-foreground font-bold">المحكمة:</span>
                      <span className="text-xs font-semibold text-[#1f1810]">{r.court_name}</span>
                    </div>
                  )}
                  {r.circuit_number && (
                    <div className="flex items-center gap-2">
                      <Hash className="h-3 w-3 text-purple-600" />
                      <span className="text-[10px] text-muted-foreground font-bold">الدائرة:</span>
                      <span className="text-xs font-semibold text-[#1f1810]">{r.circuit_number}</span>
                    </div>
                  )}
                  {r.applicant_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-purple-600" />
                      <span className="text-[10px] text-muted-foreground font-bold">مقدم الطلب:</span>
                      <span className="text-xs font-semibold text-[#1f1810]">{r.applicant_name}</span>
                    </div>
                  )}
                  {r.case_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-purple-600" />
                      <span className="text-[10px] text-muted-foreground font-bold">التاريخ:</span>
                      <span className="text-xs font-semibold text-[#1f1810]">{formatDate(r.case_date)}</span>
                    </div>
                  )}
                  {r.judgment_number && (
                    <div className="flex items-center gap-2">
                      <Gavel className="h-3 w-3 text-purple-600" />
                      <span className="text-[10px] text-muted-foreground font-bold">رقم الحكم:</span>
                      <span className="text-xs font-semibold text-[#1f1810]">{r.judgment_number}</span>
                    </div>
                  )}
                </div>

                {r.case_status && (
                  <div className="mb-3">
                    <Badge variant="outline" className="text-[10px]">{r.case_status}</Badge>
                  </div>
                )}

                <Button size="sm" variant="outline" className="w-full h-8 text-[11px] gap-1 mt-2" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
                  <Eye className="h-3 w-3" /> الاطلاع على التفاصيل
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black text-[#1f1810]">
                <span className="text-purple-700">طلب على القضية</span> #{selected?.case_number}
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-5 w-5" /></Button>
            </div>
          </DialogHeader>

          {selected && (
            <ScrollArea className="flex-1 -mx-2">
              <div className="px-2 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="رقم القضية" value={selected.case_number} />
                  <InfoField label="تاريخ القضية" value={selected.case_date ? formatDate(selected.case_date) : null} />
                  <InfoField label="المحكمة" value={selected.court_name} />
                  <InfoField label="الدائرة" value={selected.circuit_number} />
                  <InfoField label="حالة القضية" value={selected.case_status} />
                  <InfoField label="تصنيف القضية" value={selected.case_classification} />
                  <InfoField label="نوع القضية" value={selected.case_type_detail} />
                  <InfoField label="نوع الطلب" value={selected.request_type} />
                  <InfoField label="بيانات مقدم الطلب" value={selected.applicant_name} />
                  <InfoField label="نوع مقدم الطلب" value={selected.applicant_type} />
                  <InfoField label="رقم الحكم" value={selected.judgment_number} />
                </div>

                {selected.submissions && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block mb-1">التسبيبات</span>
                    <div className="p-3 bg-muted/40 rounded-lg text-xs leading-relaxed">{selected.submissions}</div>
                  </div>
                )}

                {selected.request_reasons && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block mb-1">أسباب الطلب</span>
                    <div className="p-3 bg-muted/40 rounded-lg text-xs leading-relaxed">{selected.request_reasons}</div>
                  </div>
                )}

                {[1,2,3,4,5,6].map((n) => {
                  const reason = selected[`reason_${n}`];
                  if (!reason) return null;
                  const labels = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس"];
                  return (
                    <div key={n}>
                      <span className="text-[10px] font-bold text-purple-700 block mb-1">السبب {labels[n-1]}</span>
                      <div className="p-3 bg-purple-50/40 rounded-lg text-xs leading-relaxed border border-purple-200/30">{reason}</div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoField({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] font-bold text-muted-foreground block">{label}</span>
      <span className="text-xs font-semibold text-[#1f1810]">{value}</span>
    </div>
  );
}
