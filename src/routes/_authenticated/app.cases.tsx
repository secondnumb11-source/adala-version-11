import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Briefcase, LayoutGrid, List, FileText, Calendar, Gavel, AlertTriangle,
  Users, Scale, Hash, ArrowRightLeft, Eye, Trash2, Upload, X, Edit,
  ChevronLeft, ChevronRight, Clock, BookOpen, Shield, MoreVertical, Download,
} from "lucide-react";
import { PageHeader } from "@/components/section-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useList, useUpsert, useDelete } from "@/lib/data-hooks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app/cases")({
  component: CasesPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة",
  in_study: "قيد الدراسة",
  closed_final: "محكوم بها بحكم نهائي",
  closed_non_final: "محكوم بها بحكم غير نهائي",
  appealed: "مؤجلة",
  final_judgment: "نهائية",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  in_study: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  closed_final: "bg-gray-500/15 text-gray-700 border-gray-500/30",
  closed_non_final: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  appealed: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  final_judgment: "bg-teal-500/15 text-teal-700 border-teal-500/30",
};

const TRANSFER_LABELS: Record<string, string> = {
  executions: "طلبات التنفيذ",
  powers_of_attorney: "الوكالات القضائية",
  documents_archive: "أرشيف المستندات والأحكام",
};

function CasesPage() {
  const queryClient = useQueryClient();
  const { data: cases = [], isLoading } = useList<any>("cases");
  const { data: sessions = [] } = useList<any>("sessions");
  const { data: docs = [] } = useList<any>("documents");
  const { data: caseDetails = [] } = useList<any>("case_details");
  const { data: caseParties = [] } = useList<any>("case_parties");
  const { data: caseSessions = [] } = useList<any>("case_sessions_detail");
  const { data: caseJudgments = [] } = useList<any>("case_judgments");
  const { data: lawsuitRequests = [] } = useList<any>("lawsuit_requests");
  const upsert = useUpsert("cases");
  const del = useDelete("cases");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTestData, setShowTestData] = useState(false);

  // Listen for refresh events (e.g. after document upload or sync)
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["case_judgments"] });
      queryClient.invalidateQueries({ queryKey: ["case_details"] });
      queryClient.invalidateQueries({ queryKey: ["case_parties"] });
      queryClient.invalidateQueries({ queryKey: ["case_sessions_detail"] });
      queryClient.invalidateQueries({ queryKey: ["lawsuit_requests"] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    };
    window.addEventListener("adala-refresh-data", handler);
    // Also listen for Supabase realtime changes on these tables
    const channel = supabase
      .channel("cases-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "case_judgments" }, () => handler())
      .on("postgres_changes", { event: "*", schema: "public", table: "case_details" }, () => handler())
      .on("postgres_changes", { event: "*", schema: "public", table: "case_parties" }, () => handler())
      .on("postgres_changes", { event: "*", schema: "public", table: "case_sessions_detail" }, () => handler())
      .on("postgres_changes", { event: "*", schema: "public", table: "lawsuit_requests" }, () => handler())
      .subscribe();
    return () => {
      window.removeEventListener("adala-refresh-data", handler);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch { return dateStr; }
  };

  const getPartiesForCase = (caseId: string) => {
    const byId = caseParties.filter((p: any) => p.case_id === caseId);
    if (byId.length > 0) return byId;
    // Fallback: match by case_number
    const c = cases.find((x: any) => x.id === caseId);
    if (!c?.case_number) return [];
    return caseParties.filter((p: any) => p.case_number === c.case_number);
  };
  const getSessionsForCase = (caseId: string) => {
    const byId = caseSessions.filter((s: any) => s.case_id === caseId);
    if (byId.length > 0) return byId;
    const c = cases.find((x: any) => x.id === caseId);
    if (!c?.case_number) return [];
    return caseSessions.filter((s: any) => s.case_number === c.case_number);
  };
  const getJudgmentsForCase = (caseId: string) => {
    const byId = caseJudgments.filter((j: any) => j.case_id === caseId);
    if (byId.length > 0) return byId;
    const c = cases.find((x: any) => x.id === caseId);
    if (!c?.case_number) return [];
    return caseJudgments.filter((j: any) => j.case_number === c.case_number);
  };
  const getRequestsForCase = (caseId: string) => {
    const byId = lawsuitRequests.filter((r: any) => r.case_id === caseId);
    if (byId.length > 0) return byId;
    const c = cases.find((x: any) => x.id === caseId);
    if (!c?.case_number) return [];
    return lawsuitRequests.filter((r: any) => r.case_number === c.case_number);
  };
  const getDetailsForCase = (caseId: string) => {
    const byId = caseDetails.find((d: any) => d.case_id === caseId);
    if (byId) return byId;
    const c = cases.find((x: any) => x.id === caseId);
    if (!c?.case_number) return null;
    return caseDetails.find((d: any) => d.case_number === c.case_number) || null;
  };

  const handleStatusChange = async (caseId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const caseData = cases.find((c: any) => c.id === caseId);
    if (caseData) await upsert.mutateAsync({ ...caseData, status: newStatus });
  };

  const handleTransfer = async (caseId: string, section: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const caseData = cases.find((c: any) => c.id === caseId);
    if (caseData) await upsert.mutateAsync({ ...caseData, transferred_to: section || null });
  };

  const handleDelete = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("هل أنت متأكد من حذف هذه القضية؟")) del.mutate(caseId);
  };

  const countFor = (caseId: string, type: "session" | "memo" | "judgment") => {
    if (type === "session") return sessions.filter((s: any) => s.case_id === caseId).length;
    if (type === "memo") return docs.filter((d: any) => d.case_id === caseId && d.doc_type === "memorandum").length;
    return docs.filter((d: any) => d.case_id === caseId && (d.doc_type === "judgment_final" || d.doc_type === "judgment_non_final")).length;
  };

  // Filter cases by search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter((c: any) =>
      c.case_number?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.court?.toLowerCase().includes(q)
    );
  }, [cases, searchQuery]);

  return (
    <>
      <PageHeader icon={Briefcase} title="إدارة القضايا" subtitle={`${cases.length} قضية`}
        action={
          <div className="flex gap-2 items-center">
            {/* Test Data Button */}
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleTestWithDummyData}
              className="h-9 px-3 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              اختبار ببيانات وهمية
            </Button>
            {/* Search */}
            <div className="relative">
              <Input
                placeholder="بحث برقم القضية..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 h-9 pr-3 text-right"
              />
            </div>
            {/* View Toggle */}
            <div className="flex rounded-lg border bg-card p-1">
              <Button size="sm" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")} className="h-8 px-3 gap-1">
                <LayoutGrid className="h-4 w-4" /> مربعات
              </Button>
              <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")} className="h-8 px-3 gap-1">
                <List className="h-4 w-4" /> قائمة
              </Button>
            </div>
          </div>
        }
      />

      {isLoading ? <p className="text-center text-muted-foreground py-10">جارٍ التحميل...</p> :
      cases.length === 0 ? (
        <Card className="card-luxe border-none p-10 text-center">
          <p className="text-sm">لا توجد قضايا — قم بمزامنة بيانات ناجز أو أضف قضية يدوياً</p>
        </Card>
      ) : view === "grid" ? (
        /* ===== GRID VIEW ===== */
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCases.map((c: any) => {
            const parties = getPartiesForCase(c.id);
            const plaintiffs = parties.filter((p: any) => p.party_type === "plaintiff");
            const defendants = parties.filter((p: any) => p.party_type === "defendant");
            const caseSessionsList = getSessionsForCase(c.id);
            const details = getDetailsForCase(c.id);
            const nextSession = caseSessionsList
              .filter((s: any) => s.session_date && new Date(s.session_date) >= new Date())
              .sort((a: any, b: any) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0];

            return (
              <Card key={c.id} className="card-luxe border-none p-0 cursor-pointer relative hover:shadow-2xl transition-all duration-300 overflow-hidden group" onClick={() => setSelectedCase(c)}>
                <div className="h-2 bg-gradient-to-l from-[#c9a227] via-[#d4af37] to-[#c9a227]" />
                <div className="p-5">
                  {/* Status and Transfer Row */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1">
                      <Select value={c.status || "open"} onValueChange={(value) => handleStatusChange(c.id, value, { stopPropagation: () => {} } as any)}>
                        <SelectTrigger className={`h-7 text-[11px] font-bold border-2 ${STATUS_COLORS[c.status] || STATUS_COLORS.open}`} onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                          {Object.entries(STATUS_LABEL).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-36">
                      <Select value={c.transferred_to || ""} onValueChange={(value) => handleTransfer(c.id, value, { stopPropagation: () => {} } as any)}>
                        <SelectTrigger className="h-7 text-[10px] border border-border" onClick={(e) => e.stopPropagation()}>
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

                  {/* Case Number & Date */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-[#8a6a1a] tracking-wide">#{c.case_number}</span>
                    {(details?.case_date || c.opened_at) && <span className="text-[10px] text-muted-foreground">{formatDate(details?.case_date || c.opened_at)}</span>}
                  </div>

                  {/* Case Type & Classification */}
                  <div className="flex gap-2 mb-2">
                    {details?.case_type_detail && <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">{details.case_type_detail}</Badge>}
                    {details?.case_classification && <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">{details.case_classification}</Badge>}
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-base mb-3 leading-snug text-[#1f1810] line-clamp-2">{c.title || details?.subject_matter || `قضية ${c.case_number}`}</h3>

                  {/* Parties */}
                  <div className="mb-3 p-3 bg-gradient-to-l from-amber-50/80 to-amber-50/30 rounded-lg border border-amber-200/40">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-3.5 w-3.5 text-[#8a6a1a]" />
                      <span className="text-[11px] font-bold text-[#5a4510]">أطراف الدعوى</span>
                    </div>
                    {plaintiffs.length > 0 && (
                      <div className="mb-1.5">
                        <span className="text-[10px] font-bold text-emerald-700">المدعون:</span>
                        {plaintiffs.map((p: any, i: number) => (
                          <span key={i} className="text-xs font-semibold text-[#1f1810] mr-1">{p.party_name}{i < plaintiffs.length - 1 ? "،" : ""}</span>
                        ))}
                      </div>
                    )}
                    {defendants.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-rose-700">المدعى عليهم:</span>
                        {defendants.map((p: any, i: number) => (
                          <span key={i} className="text-xs font-semibold text-[#1f1810] mr-1">{p.party_name}{i < defendants.length - 1 ? "،" : ""}</span>
                        ))}
                      </div>
                    )}
                    {plaintiffs.length === 0 && defendants.length === 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {c.plaintiff_name && <span className="font-semibold">المدعي: {c.plaintiff_name}</span>}
                        {c.defendant_name && <span className="font-semibold mr-2">المدعى عليه: {c.defendant_name}</span>}
                        {!c.plaintiff_name && !c.defendant_name && <span>لا توجد بيانات أطراف</span>}
                      </div>
                    )}
                  </div>

                  {/* Court and Circuit */}
                  <div className="mb-3 space-y-1">
                    {(details?.court_name || c.court) && (
                      <div className="flex items-center gap-2">
                        <Scale className="h-3 w-3 text-[#8a6a1a]" />
                        <span className="text-[10px] text-muted-foreground font-bold">المحكمة:</span>
                        <span className="text-xs font-semibold text-[#1f1810]">{details?.court_name || c.court}</span>
                      </div>
                    )}
                    {(details?.circuit_number || c.circuit_number) && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-3 w-3 text-[#8a6a1a]" />
                        <span className="text-[10px] text-muted-foreground font-bold">الدائرة:</span>
                        <span className="text-xs font-semibold text-[#1f1810]">{details?.circuit_number || c.circuit_number}</span>
                      </div>
                    )}
                  </div>

                  {/* Next Session */}
                  {nextSession && (
                    <div className="mb-3 p-2 bg-blue-50/60 rounded-lg border border-blue-200/40">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-blue-700" />
                        <span className="text-[10px] font-bold text-blue-800">الجلسة القادمة:</span>
                        <span className="text-xs font-semibold text-blue-900">{formatDate(nextSession.session_date)}</span>
                        {nextSession.session_time && <span className="text-[10px] text-blue-700">({nextSession.session_time})</span>}
                      </div>
                    </div>
                  )}

                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t-2 border-[#c9a227]/20">
                    <div className="text-center">
                      <Calendar className="h-3.5 w-3.5 mx-auto text-[#8a6a1a] mb-0.5" />
                      <div className="text-sm font-black text-[#1f1810]">{caseSessionsList.length || countFor(c.id, "session")}</div>
                      <div className="text-[9px] text-muted-foreground font-bold">جلسات</div>
                    </div>
                    <div className="text-center">
                      <FileText className="h-3.5 w-3.5 mx-auto text-[#8a6a1a] mb-0.5" />
                      <div className="text-sm font-black text-[#1f1810]">{countFor(c.id, "memo")}</div>
                      <div className="text-[9px] text-muted-foreground font-bold">مذكرات</div>
                    </div>
                    <div className="text-center">
                      <Gavel className="h-3.5 w-3.5 mx-auto text-[#8a6a1a] mb-0.5" />
                      <div className="text-sm font-black text-[#1f1810]">{getJudgmentsForCase(c.id).length || countFor(c.id, "judgment")}</div>
                      <div className="text-[9px] text-muted-foreground font-bold">أحكام</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px] gap-1" onClick={(e) => { e.stopPropagation(); setSelectedCase(c); }}>
                      <Eye className="h-3 w-3" /> الاطلاع على التفاصيل
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50" onClick={(e) => handleDelete(c.id, e)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ===== LIST VIEW (Najiz-style) ===== */
        <Card className="border-none shadow-sm overflow-hidden">
          {/* Table Header - Najiz style */}
          <div className="bg-[#f8f7f4] border-b border-[#e5e2db]">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1.2fr_1.2fr_1fr_0.5fr] gap-2 px-4 py-3 text-[11px] font-bold text-[#5a4510]">
              <div>رقم القضية</div>
              <div>تاريخ القضية</div>
              <div>نوع القضية</div>
              <div>الصفة</div>
              <div>المدعي</div>
              <div>المدعى عليه</div>
              <div>الحالة</div>
              <div></div>
            </div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-[#f0ede6]">
            {filteredCases.map((c: any) => {
              const parties = getPartiesForCase(c.id);
              const plaintiffs = parties.filter((p: any) => p.party_type === "plaintiff");
              const defendants = parties.filter((p: any) => p.party_type === "defendant");
              const details = getDetailsForCase(c.id);
              const plaintiffNames = plaintiffs.map((p: any) => p.party_name).join("، ") || c.plaintiff_name || "—";
              const defendantNames = defendants.map((p: any) => p.party_name).join("، ") || c.defendant_name || "—";
              
              // Determine user's role in the case
              const userRole = plaintiffs.length > 0 ? "المدعي" : defendants.length > 0 ? "المدعى عليه" : "—";

  const handleTestWithDummyData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("غير مسجل دخول");
    
    try {
      // Create test case
      const testCase = {
        owner_id: user.id,
        case_number: "1445/12345",
        title: "قضية اختبار - مطالبة مالية",
        court: "المحكمة العامة بالرياض",
        case_type: "civil",
        status: "open",
        opened_at: "2024-01-15",
        plaintiff_name: "أحمد محمد العلي",
        defendant_name: "شركة التقنية المتقدمة",
        najiz_id: "case_1445_12345",
      };
      
      const { data: insertedCase, error: caseError } = await supabase
        .from("cases")
        .insert(testCase)
        .select()
        .single();
      
      if (caseError) throw caseError;
      
      // Create test case details
      const testDetails = {
        owner_id: user.id,
        case_id: insertedCase.id,
        case_number: insertedCase.case_number,
        case_classification: "مدني",
        case_type_detail: "مطالبة مالية",
        case_date: "2024-01-15",
        subject_matter: "يقوم المدعي بمطالبة المدعى عليه بمبلغ 50,000 ريال سعودي عن أضرار ناتجة عن breach of contract. تم توقيع العقد في تاريخ 2023-06-01 ولم يقم المدعى عليه بتنفيذ التزاماته.",
        plaintiff_requests: "يلتزم المدعى عليه بدفع مبلغ 50,000 ريال سعودي كتعويض عن الأضرار المادية والمعنوية.",
        case_foundations: "1. وجود عقد موقع بين الطرفين\n2. عدم تنفيذ المدعى عليه لالتزاماته\n3. الأضرار المادية المتمثلة في الخسائر المالية\n4. الأضرار المعنوية الناتجة عن الإخلال بالعقد",
        court_name: "المحكمة العامة بالرياض",
        circuit_number: "الدائرة 15",
      };
      
      await supabase.from("case_details").insert(testDetails);
      
      // Create test parties
      await supabase.from("case_parties").insert([
        {
          owner_id: user.id,
          case_id: insertedCase.id,
          case_number: insertedCase.case_number,
          party_type: "plaintiff",
          party_name: "أحمد محمد العلي",
          party_nationality: "سعودي",
          party_identity_type: "هوية وطنية",
          party_id_number: "1234567890",
          party_capacity: "مدعي",
        },
        {
          owner_id: user.id,
          case_id: insertedCase.id,
          case_number: insertedCase.case_number,
          party_type: "defendant",
          party_name: "شركة التقنية المتقدمة",
          party_nationality: "سعودي",
          party_identity_type: "سجل تجاري",
          party_id_number: "1010123456",
          party_capacity: "مدعى عليه",
        },
      ]);
      
      // Create test sessions
      await supabase.from("case_sessions_detail").insert([
        {
          owner_id: user.id,
          case_id: insertedCase.id,
          case_number: insertedCase.case_number,
          session_status: "مجدولة",
          court_name: "المحكمة العامة بالرياض",
          circuit_number: "الدائرة 15",
          mechanism: "حضوري",
          degree: "أولى",
          session_date: "2024-02-20",
          session_time: "10:00",
          session_details: "جلسة استماع أولية",
        },
      ]);
      
      // Create test judgments
      await supabase.from("case_judgments").insert([
        {
          owner_id: user.id,
          case_id: insertedCase.id,
          case_number: insertedCase.case_number,
          judgment_finality: "ابتدائي",
          deed_number: "صك-12345",
          deed_date: "2024-03-01",
          court_name: "المحكمة العامة بالرياض",
          circuit_number: "الدائرة 15",
          degree: "أولى",
          judgment_details: "حكم ابتدائي لصالح المدعي بمبلغ 50,000 ريال",
        },
      ]);
      
      toast.success("تم إنشاء بيانات اختبار بنجاح!");
      queryClient.invalidateQueries();
    } catch (error: any) {
      console.error("Test data error:", error);
      toast.error("فشل إنشاء بيانات الاختبار: " + error.message);
    }
  };

  return (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr_1.2fr_1.2fr_1fr_0.5fr] gap-2 px-4 py-3 items-center hover:bg-[#faf9f6] transition-colors cursor-pointer group"
                  onClick={() => setSelectedCase(c)}
                >
                  {/* Case Number */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1f1810]">{c.case_number}</span>
                  </div>
                  
                  {/* Case Date */}
                  <div className="text-xs text-[#5a4510]">
                    {formatDate(details?.case_date || c.opened_at) || "—"}
                  </div>
                  
                  {/* Case Type */}
                  <div className="text-xs text-[#5a4510]">
                    {details?.case_type_detail || c.case_type || "—"}
                  </div>
                  
                  {/* Role */}
                  <div>
                    <Badge variant="outline" className="text-[10px] bg-[#f8f7f4] text-[#5a4510] border-[#e5e2db]">
                      {userRole}
                    </Badge>
                  </div>
                  
                  {/* Plaintiff */}
                  <div className="text-xs text-[#1f1810] font-medium truncate" title={plaintiffNames}>
                    {plaintiffNames}
                  </div>
                  
                  {/* Defendant */}
                  <div className="text-xs text-[#1f1810] font-medium truncate" title={defendantNames}>
                    {defendantNames}
                  </div>
                  
                  {/* Status */}
                  <div>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[c.status] || STATUS_COLORS.open}`}>
                      {STATUS_LABEL[c.status] || "مفتوحة"}
                    </Badge>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setSelectedCase(c); }}>
                      <Eye className="h-3.5 w-3.5 text-[#8a6a1a]" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleDelete(c.id, e); }}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Table Footer */}
          <div className="bg-[#f8f7f4] border-t border-[#e5e2db] px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-[#5a4510]">{filteredCases.length} نتيجة</span>
          </div>
        </Card>
      )}

      {/* Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={(v) => !v && setSelectedCase(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black text-[#1f1810]">
                <span className="text-[#8a6a1a]">#{selectedCase?.case_number}</span> تفاصيل القضية
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCase(null)}><X className="h-5 w-5" /></Button>
            </div>
          </DialogHeader>

          {selectedCase && <CaseDetailView caseData={selectedCase} formatDate={formatDate} getDetailsForCase={getDetailsForCase} getPartiesForCase={getPartiesForCase} getSessionsForCase={getSessionsForCase} getJudgmentsForCase={getJudgmentsForCase} getRequestsForCase={getRequestsForCase} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CaseDetailView({ caseData, formatDate, getDetailsForCase, getPartiesForCase, getSessionsForCase, getJudgmentsForCase, getRequestsForCase }: any) {
  const details = getDetailsForCase(caseData.id);
  const parties = getPartiesForCase(caseData.id);
  const sessions = getSessionsForCase(caseData.id);
  const judgments = getJudgmentsForCase(caseData.id);
  const requests = getRequestsForCase(caseData.id);
  const [activeTab, setActiveTab] = useState("info");

  const plaintiffs = parties.filter((p: any) => p.party_type === "plaintiff");
  const defendants = parties.filter((p: any) => p.party_type === "defendant");

  const handleUploadJudgmentDoc = async (judgmentId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return toast.error("غير مسجل دخول");
      const safeName = file.name.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, "_");
      const path = `${user.id}/judgments/${Date.now()}-${safeName}`;
      const { error: upErr } = await (supabase as any).storage.from("judgment-documents").upload(path, file, { upsert: true });
      if (upErr) {
        console.error("[upload] error:", upErr);
        return toast.error("فشل رفع المستند: " + upErr.message);
      }
      const { data: urlData } = await (supabase as any).storage.from("judgment-documents").getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) return toast.error("فشل الحصول على رابط المستند");
      
      // Update the judgment record
      const { error: updateErr } = await (supabase as any)
        .from("case_judgments")
        .update({ judgment_document_url: publicUrl })
        .eq("id", judgmentId);
      
      if (updateErr) {
        console.error("[upload] update error:", updateErr);
        return toast.error("فشل حفظ رابط المستند: " + updateErr.message);
      }
      
      // Update local state so the preview button appears immediately
      if (typeof getJudgmentsForCase === "function") {
        // Trigger re-fetch by invalidating React Query
        window.dispatchEvent(new CustomEvent("adala-refresh-data"));
      }
      toast.success("تم رفع المستند بنجاح");
    };
    input.click();
  };

  const tabs = [
    { id: "info", label: "معلومات القضية", icon: BookOpen },
    { id: "parties", label: `أطراف الدعوى (${parties.length})`, icon: Users },
    { id: "sessions", label: `الجلسات (${sessions.length})`, icon: Calendar },
    { id: "judgments", label: `الأحكام (${judgments.length})`, icon: Gavel },
    { id: "requests", label: `الطلبات (${requests.length})`, icon: FileText },
  ];

  return (
    <ScrollArea className="flex-1 -mx-2">
      <div className="px-2 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-[#c9a227]/15 text-[#8a6a1a] border border-[#c9a227]/30" : "text-muted-foreground hover:bg-muted"}`}>
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          ))}
        </div>

        {/* Info Tab */}
        {activeTab === "info" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoField label="رقم القضية" value={caseData.case_number} />
              <InfoField label="تاريخ القضية" value={details?.case_date ? formatDate(details.case_date) : formatDate(caseData.opened_at)} />
              <InfoField label="تصنيف القضية" value={details?.case_classification} />
              <InfoField label="نوع القضية" value={details?.case_type_detail || caseData.case_type} />
              <InfoField label="المحكمة" value={details?.court_name || caseData.court} />
              <InfoField label="رقم الدائرة" value={details?.circuit_number || caseData.circuit_number} />
            </div>
            <InfoField label="موضوع الدعوى" value={details?.subject_matter} full />
            <InfoField label="طلبات المدعي" value={details?.plaintiff_requests} full />
            <InfoField label="أسانيد الدعوى" value={details?.case_foundations} full />
          </div>
        )}

        {/* Parties Tab */}
        {activeTab === "parties" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-black text-emerald-800 mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" /> قائمة المدعين
              </h4>
              {plaintiffs.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد بيانات</p> :
                plaintiffs.map((p: any, i: number) => (
                  <Card key={i} className="p-3 mb-2 border-emerald-200/50 bg-emerald-50/30">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <InfoField label="الاسم" value={p.party_name} />
                      <InfoField label="الصفة" value={p.party_capacity} />
                      <InfoField label="الجنسية" value={p.party_nationality} />
                      <InfoField label="نوع الهوية" value={p.party_identity_type} />
                      <InfoField label="رقم الهوية" value={p.party_id_number} />
                      <InfoField label="الحالة في الدعوى" value={p.party_status_in_case} />
                    </div>
                  </Card>
                ))}
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-black text-rose-800 mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-500" /> قائمة المدعى عليهم
              </h4>
              {defendants.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد بيانات</p> :
                defendants.map((p: any, i: number) => (
                  <Card key={i} className="p-3 mb-2 border-rose-200/50 bg-rose-50/30">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <InfoField label="الاسم" value={p.party_name} />
                      <InfoField label="الصفة" value={p.party_capacity} />
                      <InfoField label="الجنسية" value={p.party_nationality} />
                      <InfoField label="نوع الهوية" value={p.party_identity_type} />
                      <InfoField label="رقم الهوية" value={p.party_id_number} />
                      <InfoField label="الحالة في الدعوى" value={p.party_status_in_case} />
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === "sessions" && (
          <div className="space-y-3">
            <h4 className="text-sm font-black text-[#8a6a1a]">تفاصيل الجلسات</h4>
            {sessions.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد جلسات</p> :
              sessions.map((s: any, i: number) => (
                <Card key={i} className="p-4 border-[#c9a227]/20 bg-gradient-to-l from-amber-50/40 to-transparent">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <InfoField label="حالة الجلسة" value={s.session_status} />
                    <InfoField label="المحكمة" value={s.court_name} />
                    <InfoField label="الدائرة" value={s.circuit_number} />
                    <InfoField label="آلية الانعقاد" value={s.mechanism} />
                    <InfoField label="الدرجة" value={s.degree} />
                    <InfoField label="التاريخ" value={s.session_date ? formatDate(s.session_date) : null} />
                    <InfoField label="الوقت" value={s.session_time} />
                  </div>
                  {s.session_details && <div className="mt-2 p-2 bg-muted/40 rounded text-xs">{s.session_details}</div>}
                </Card>
              ))}
          </div>
        )}

        {/* Judgments Tab */}
        {activeTab === "judgments" && (
          <div className="space-y-3">
            <h4 className="text-sm font-black text-[#8a6a1a]">تفاصيل الأحكام</h4>
            {judgments.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد أحكام</p> :
              judgments.map((j: any, i: number) => (
                <Card key={i} className="p-4 border-emerald-200/40 bg-gradient-to-l from-emerald-50/40 to-transparent">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <InfoField label="نهائي / غير قطعي" value={j.judgment_finality} />
                    <InfoField label="رقم الصك" value={j.deed_number} />
                    <InfoField label="تاريخ صك الحكم" value={j.deed_date ? formatDate(j.deed_date) : null} />
                    <InfoField label="المحكمة" value={j.court_name} />
                    <InfoField label="الدائرة" value={j.circuit_number} />
                    <InfoField label="الدرجة" value={j.degree} />
                    <InfoField label="تاريخ صك الاستئناف" value={j.appeal_deed_date ? formatDate(j.appeal_deed_date) : null} />
                    <InfoField label="رقم دائرة الاستئناف" value={j.appeal_circuit_number} />
                  </div>
                  {j.judgment_details && <div className="mt-2 p-2 bg-muted/40 rounded text-xs">{j.judgment_details}</div>}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleUploadJudgmentDoc(j.id)}>
                      <Upload className="h-3 w-3" /> رفع مستند صك الحكم
                    </Button>
                    {j.judgment_document_url && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => window.open(j.judgment_document_url, "_blank")}>
                        <Eye className="h-3 w-3" /> معاينة المستند
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-3">
            <h4 className="text-sm font-black text-[#8a6a1a]">الطلبات على القضية</h4>
            {requests.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد طلبات</p> :
              requests.map((r: any, i: number) => (
                <Card key={i} className="p-4 border-purple-200/40 bg-gradient-to-l from-purple-50/40 to-transparent">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <InfoField label="بيانات القضية" value={r.case_number} />
                    <InfoField label="تاريخ القضية" value={r.case_date ? formatDate(r.case_date) : null} />
                    <InfoField label="المحكمة" value={r.court_name} />
                    <InfoField label="الدائرة" value={r.circuit_number} />
                    <InfoField label="حالة القضية" value={r.case_status} />
                    <InfoField label="تصنيف القضية" value={r.case_classification} />
                    <InfoField label="نوع القضية" value={r.case_type_detail} />
                    <InfoField label="نوع الطلب" value={r.request_type} />
                    <InfoField label="بيانات مقدم الطلب" value={r.applicant_name} />
                    <InfoField label="رقم الحكم" value={r.judgment_number} />
                  </div>
                  {r.submissions && <div className="mt-2"><span className="text-[10px] font-bold text-muted-foreground">التسبيبات:</span><div className="p-2 bg-muted/40 rounded text-xs mt-1">{r.submissions}</div></div>}
                  {r.request_reasons && <div className="mt-2"><span className="text-[10px] font-bold text-muted-foreground">أسباب الطلب:</span><div className="p-2 bg-muted/40 rounded text-xs mt-1">{r.request_reasons}</div></div>}
                  {[1,2,3,4,5,6].map((n) => {
                    const reason = (r as any)[`reason_${n}`];
                    if (!reason) return null;
                    const labels = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس"];
                    return <div key={n} className="mt-1.5"><span className="text-[10px] font-bold text-muted-foreground">السبب {labels[n-1]}:</span><div className="p-2 bg-muted/30 rounded text-[11px] mt-0.5">{reason}</div></div>;
                  })}
                </Card>
              ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function InfoField({ label, value, full }: { label: string; value: any; full?: boolean }) {
  if (!value) return null;
  return (
    <div className={full ? "col-span-2" : ""}>
      <span className="text-[10px] font-bold text-muted-foreground block">{label}</span>
      <span className="text-xs font-semibold text-[#1f1810] leading-relaxed">{value}</span>
    </div>
  );
}
