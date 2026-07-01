import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Clock, Calendar, FileText, Users, Scale, AlertCircle,
  CheckCircle2, XCircle, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/section-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useList } from "@/lib/data-hooks";

export const Route = createFileRoute("/_authenticated/app/case-timeline")({
  component: CaseTimelinePage,
});

type TimelineEvent = {
  id: string;
  date: string;
  type: "session" | "document" | "judgment" | "request" | "party" | "note";
  title: string;
  description?: string;
  status?: string;
  icon: any;
  color: string;
};

function CaseTimelinePage() {
  const { data: cases = [] } = useList<any>("cases");
  const { data: caseDetails = [] } = useList<any>("case_details");
  const { data: caseParties = [] } = useList<any>("case_parties");
  const { data: caseSessions = [] } = useList<any>("case_sessions_detail");
  const { data: caseJudgments = [] } = useList<any>("case_judgments");
  const { data: lawsuitRequests = [] } = useList<any>("lawsuit_requests");

  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const getTimelineEvents = (caseId: string): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Add case creation
    const caseData = cases.find((c: any) => c.id === caseId);
    if (caseData?.opened_at) {
      events.push({
        id: `case-${caseId}`,
        date: caseData.opened_at,
        type: "note",
        title: "فتح القضية",
        description: `تم فتح القضية رقم ${caseData.case_number}`,
        icon: FileText,
        color: "bg-blue-500",
      });
    }

    // Add case details
    const details = caseDetails.find((d: any) => d.case_id === caseId);
    if (details?.case_date) {
      events.push({
        id: `details-${caseId}`,
        date: details.case_date,
        type: "note",
        title: "تسجيل تفاصيل القضية",
        description: details.subject_matter?.slice(0, 100),
        icon: FileText,
        color: "bg-blue-500",
      });
    }

    // Add parties
    const parties = caseParties.filter((p: any) => p.case_id === caseId);
    parties.forEach((party: any, idx: number) => {
      events.push({
        id: `party-${party.id}`,
        date: caseData?.opened_at || new Date().toISOString(),
        type: "party",
        title: party.party_type === "plaintiff" ? "إضافة مدعي" : "إضافة مدعى عليه",
        description: party.party_name,
        icon: Users,
        color: "bg-purple-500",
      });
    });

    // Add sessions
    const sessions = caseSessions.filter((s: any) => s.case_id === caseId);
    sessions.forEach((session: any) => {
      events.push({
        id: `session-${session.id}`,
        date: session.session_date || new Date().toISOString(),
        type: "session",
        title: "جلسة",
        description: `${session.court_name} - ${session.circuit_number}`,
        status: session.session_status,
        icon: Calendar,
        color: "bg-emerald-500",
      });
    });

    // Add judgments
    const judgments = caseJudgments.filter((j: any) => j.case_id === caseId);
    judgments.forEach((judgment: any) => {
      events.push({
        id: `judgment-${judgment.id}`,
        date: judgment.deed_date || new Date().toISOString(),
        type: "judgment",
        title: "حكم",
        description: `${judgment.judgment_finality} - صك رقم ${judgment.deed_number}`,
        icon: Scale,
        color: "bg-amber-500",
      });
    });

    // Add lawsuit requests
    const requests = lawsuitRequests.filter((r: any) => r.case_id === caseId);
    requests.forEach((request: any) => {
      events.push({
        id: `request-${request.id}`,
        date: request.case_date || new Date().toISOString(),
        type: "request",
        title: request.request_type || "طلب على القضية",
        description: request.applicant_name,
        icon: AlertCircle,
        color: "bg-rose-500",
      });
    });

    // Sort by date
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const selectedCaseData = cases.find((c: any) => c.id === selectedCase);
  const timelineEvents = selectedCase ? getTimelineEvents(selectedCase) : [];

  return (
    <>
      <PageHeader
        icon={Clock}
        title="الجدول الزمني للقضية"
        subtitle="عرض تسلسل زمني لجميع أحداث القضية"
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Case Selection */}
        <Card className="card-luxe border-none p-4 h-fit">
          <h3 className="font-bold text-[#1f1810] mb-3">اختر قضية</h3>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {cases.map((c: any) => (
                <Button
                  key={c.id}
                  variant={selectedCase === c.id ? "default" : "ghost"}
                  className={`w-full justify-start h-auto py-3 px-3 ${
                    selectedCase === c.id ? "btn-gold" : ""
                  }`}
                  onClick={() => setSelectedCase(c.id)}
                >
                  <div className="text-right">
                    <div className="font-semibold text-sm">#{c.case_number}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {c.title}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Timeline */}
        <Card className="card-luxe border-none p-6">
          {!selectedCase ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">اختر قضية لعرض الجدول الزمني</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-[#1f1810] mb-2">
                  {selectedCaseData?.title}
                </h3>
                <Badge variant="outline" className="text-sm">
                  قضية رقم #{selectedCaseData?.case_number}
                </Badge>
              </div>

              {timelineEvents.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">لا توجد أحداث مسجلة</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-border/60" />

                  {/* Events */}
                  <div className="space-y-6">
                    {timelineEvents.map((event, idx) => {
                      const Icon = event.icon;
                      return (
                        <div key={event.id} className="relative flex gap-4">
                          {/* Icon */}
                          <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${event.color} flex items-center justify-center`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 pb-6">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-bold text-[#1f1810]">
                                  {event.title}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(event.date).toLocaleDateString("ar-SA", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </p>
                              </div>
                              {event.status && (
                                <Badge variant="outline" className="text-xs">
                                  {event.status}
                                </Badge>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-[#1f1810]/80 mt-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
