import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileText, Upload, Sparkles, AlertTriangle, CheckCircle2,
  Loader2, Download, Eye,
} from "lucide-react";
import { PageHeader } from "@/components/section-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/ai/contract-analysis")({
  component: ContractAnalysisPage,
});

type AnalysisResult = {
  riskLevel: "low" | "medium" | "high";
  issues: Array<{
    type: string;
    severity: "low" | "medium" | "high";
    description: string;
    recommendation: string;
    clause?: string;
  }>;
  summary: string;
  keyTerms: Array<{ term: string; definition: string }>;
  missingClauses: string[];
  complianceScore: number;
};

function ContractAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      if (uploadedFile.type !== "application/pdf" && !uploadedFile.type.includes("word")) {
        toast.error("الرجاء رفع ملف PDF أو Word");
        return;
      }
      setFile(uploadedFile);
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("الرجاء رفع عقد أولاً");
      return;
    }

    setAnalyzing(true);
    try {
      // Simulate AI analysis
      await new Promise((r) => setTimeout(r, 3000));

      // Mock analysis result
      const mockResult: AnalysisResult = {
        riskLevel: "medium",
        issues: [
          {
            type: "بند غامض",
            severity: "high",
            description: "بند التعويض غير واضح ويترك مجالاً للتفسير",
            recommendation: "يجب تحديد مبلغ التعويض بشكل صريح أو وضع معادلة حسابية واضحة",
            clause: "المادة 12 - التعويض عن الإخلال",
          },
          {
            type: "بند مفقود",
            severity: "medium",
            description: "لا يوجد بند لحل النزاعات",
            recommendation: "إضافة بند يحدد آلية حل النزاعات (تحكيم أو محاكم)",
          },
          {
            type: "عدم توافق",
            severity: "low",
            description: "مدة العقد لا تتوافق مع نظام العمل",
            recommendation: "مراجعة مدة العقد للتوافق مع الحد الأقصى المسموح به",
            clause: "المادة 3 - مدة العقد",
          },
        ],
        summary: "العقد يحتوي على 3 مخاطر محتملة. يجب مراجعة بند التعويض وإضافة بند لحل النزاعات. العقد متوافق بشكل عام مع الأنظمة السعودية مع بعض التعديلات البسيطة.",
        keyTerms: [
          { term: "الطرف الأول", definition: "صاحب العمل" },
          { term: "الطرف الثاني", definition: "المقاول أو المورد" },
          { term: "موضوع العقد", definition: "تقديم خدمات استشارية" },
          { term: "مدة العقد", definition: "سنة واحدة قابلة للتجديد" },
        ],
        missingClauses: [
          "بند السرية",
          "بند حل النزاعات",
          "بند القوة القاهرة",
          "بند إنهاء العقد المبكر",
        ],
        complianceScore: 78,
      };

      setResult(mockResult);
      toast.success("تم تحليل العقد بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء التحليل");
    } finally {
      setAnalyzing(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "high":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "";
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case "low":
        return "منخفض";
      case "medium":
        return "متوسط";
      case "high":
        return "مرتفع";
      default:
        return "";
    }
  };

  return (
    <>
      <PageHeader
        icon={FileText}
        title="تحليل العقود الذكي"
        subtitle="حلل العقود واكتشف المخاطر والثغرات باستخدام الذكاء الاصطناعي"
      />

      <div className="grid gap-6">
        {/* Upload Section */}
        <Card className="card-luxe border-none p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#c9a227]" />
              <h3 className="text-lg font-bold text-[#1f1810]">رفع العقد</h3>
            </div>

            <div className="border-2 border-dashed border-border/60 rounded-lg p-8 text-center hover:border-[#c9a227]/50 transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
                id="contract-upload"
              />
              <label htmlFor="contract-upload" className="cursor-pointer">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-2">
                  {file ? file.name : "اسحب الملف هنا أو انقر للاختيار"}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, Word (حد أقصى 10MB)
                </p>
              </label>
            </div>

            {file && (
              <Button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="btn-gold w-full h-12"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="mr-2">جارٍ التحليل...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span className="mr-2">تحليل العقد بالذكاء الاصطناعي</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>

        {/* Analysis Results */}
        {result && (
          <>
            {/* Summary Card */}
            <Card className="card-luxe border-none p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#1f1810] mb-2">
                    ملخص التحليل
                  </h3>
                  <p className="text-sm text-[#1f1810]/80 leading-relaxed">
                    {result.summary}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`ml-4 ${getRiskColor(result.riskLevel)}`}
                >
                  مستوى المخاطر: {getRiskLabel(result.riskLevel)}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/40">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#c9a227]">
                    {result.complianceScore}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    درجة التوافق
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-rose-600">
                    {result.issues.length}
                  </div>
                  <div className="text-sm text-muted-foreground">مشاكل</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-600">
                    {result.missingClauses.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    بنود مفقودة
                  </div>
                </div>
              </div>
            </Card>

            {/* Issues */}
            <Card className="card-luxe border-none p-6">
              <h3 className="text-lg font-bold text-[#1f1810] mb-4">
                المشاكل والمخاطر
              </h3>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {result.issues.map((issue, idx) => (
                    <Card
                      key={idx}
                      className="border border-border/60 hover:shadow-md transition-all"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle
                              className={`h-5 w-5 ${
                                issue.severity === "high"
                                  ? "text-rose-600"
                                  : issue.severity === "medium"
                                  ? "text-amber-600"
                                  : "text-blue-600"
                              }`}
                            />
                            <h4 className="font-bold text-[#1f1810]">
                              {issue.type}
                            </h4>
                          </div>
                          <Badge
                            variant="outline"
                            className={getRiskColor(issue.severity)}
                          >
                            {getRiskLabel(issue.severity)}
                          </Badge>
                        </div>
                        <p className="text-sm text-[#1f1810]/80 mb-2">
                          {issue.description}
                        </p>
                        {issue.clause && (
                          <p className="text-xs text-muted-foreground mb-2">
                            <strong>البند:</strong> {issue.clause}
                          </p>
                        )}
                        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 mt-3">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                            <p className="text-sm text-emerald-900">
                              <strong>التوصية:</strong> {issue.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            {/* Missing Clauses */}
            <Card className="card-luxe border-none p-6">
              <h3 className="text-lg font-bold text-[#1f1810] mb-4">
                البنود المفقودة
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {result.missingClauses.map((clause, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-900">{clause}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Key Terms */}
            <Card className="card-luxe border-none p-6">
              <h3 className="text-lg font-bold text-[#1f1810] mb-4">
                المصطلحات الرئيسية
              </h3>
              <div className="space-y-2">
                {result.keyTerms.map((term, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-muted/40 rounded"
                  >
                    <div className="font-bold text-[#c9a227] min-w-[120px]">
                      {term.term}
                    </div>
                    <div className="text-sm text-[#1f1810]/80">
                      {term.definition}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1">
                <Download className="h-4 w-4" />
                <span className="mr-2">تحميل التقرير</span>
              </Button>
              <Button variant="outline" className="flex-1">
                <Eye className="h-4 w-4" />
                <span className="mr-2">معاينة العقد</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
