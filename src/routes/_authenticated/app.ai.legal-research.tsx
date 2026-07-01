import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen, Search, Sparkles, FileText, Scale, AlertCircle,
  Loader2, Copy, Check, ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/section-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/ai/legal-research")({
  component: LegalResearchPage,
});

const LEGAL_SOURCES = [
  { name: "نظام المرافعات الشرعية", category: "إجراءات" },
  { name: "نظام العمل", category: "عمل" },
  { name: "نظام الشركات", category: "تجاري" },
  { name: "نظام الأحوال الشخصية", category: "أحوال شخصية" },
  { name: "نظام العقوبات", category: "جزائي" },
  { name: "نظام التنفيذ", category: "تنفيذ" },
  { name: "نظام الإجراءات الجزائية", category: "جزائي" },
  { name: "نظام التجارة الإلكترونية", category: "تجاري" },
];

type ResearchResult = {
  id: string;
  title: string;
  source: string;
  article?: string;
  summary: string;
  relevance: number;
  keywords: string[];
};

function LegalResearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("الرجاء إدخال استعلام بحث");
      return;
    }

    setLoading(true);
    try {
      // Simulate AI-powered legal research
      await new Promise((r) => setTimeout(r, 1500));

      // Mock results based on query
      const mockResults: ResearchResult[] = [
        {
          id: "1",
          title: "حكم النقض بشأن تعويض إنهاء العقد",
          source: "نظام العمل",
          article: "المادة 77",
          summary: "إذا أنهى صاحب العمل عقد العمل دون سبب مشروع، يلتزم بدفع تعويض للعامل لا يقل عن أجر شهرين عن كل سنة من سنوات الخدمة.",
          relevance: 95,
          keywords: ["تعويض", "إنهاء عقد", "عمل"],
        },
        {
          id: "2",
          title: "إجراءات رفع الدعوى العمالية",
          source: "نظام المرافعات الشرعية",
          article: "المادة 34",
          summary: "ترفع الدعاوى العمالية أمام اللجنة العمالية خلال سنة من تاريخ انتهاء العقد أو تاريخ الاستحقاق.",
          relevance: 88,
          keywords: ["دعوى", "عمالية", "إجراءات"],
        },
        {
          id: "3",
          title: "شروط صحة العقد",
          source: "نظام الشركات",
          summary: "يجب أن يكون العقد خالياً من الغلط والتدليس والإكراه، وأن يكون محله قابلاً للتعامل فيه شرعاً.",
          relevance: 82,
          keywords: ["عقد", "صحة", "شروط"],
        },
      ];

      setResults(mockResults);
      toast.success(`تم العثور على ${mockResults.length} نتيجة`);
    } catch (error) {
      toast.error("حدث خطأ أثناء البحث");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("تم النسخ");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="البحث القانوني الذكي"
        subtitle="ابحث في الأنظمة واللوائح السعودية باستخدام الذكاء الاصطناعي"
      />

      <div className="grid gap-6">
        {/* Search Box */}
        <Card className="card-luxe border-none p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#c9a227]" />
              <h3 className="text-lg font-bold text-[#1f1810]">استعلام بحث ذكي</h3>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="اكتب سؤالك القانوني... مثال: ما هي شروط صحة العقد؟"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pr-10 h-12 text-right"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="btn-gold h-12 px-6"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                <span className="mr-2">بحث</span>
              </Button>
            </div>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">اقتراحات:</span>
              {["تعويض إنهاء العقد", "شروط البطلان", "إجراءات الاستئناف", "حق الحبس"].map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover:bg-[#c9a227]/10 hover:border-[#c9a227]/50 transition-colors"
                  onClick={() => setQuery(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card className="card-luxe border-none p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1f1810]">
                النتائج ({results.length})
              </h3>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                مدعوم بالذكاء الاصطناعي
              </Badge>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {results.map((result) => (
                  <Card
                    key={result.id}
                    className="border border-border/60 hover:border-[#c9a227]/50 hover:shadow-lg transition-all"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Scale className="h-4 w-4 text-[#c9a227]" />
                            <h4 className="font-bold text-[#1f1810]">{result.title}</h4>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{result.source}</span>
                            {result.article && (
                              <>
                                <span>•</span>
                                <span>{result.article}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`ml-2 ${
                            result.relevance >= 90
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : result.relevance >= 80
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {result.relevance}% مطابقة
                        </Badge>
                      </div>

                      <p className="text-sm text-[#1f1810]/80 leading-relaxed mb-3">
                        {result.summary}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-border/40">
                        <div className="flex flex-wrap gap-1.5">
                          {result.keywords.map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleCopy(
                                `${result.title}\n${result.source}${
                                  result.article ? ` - ${result.article}` : ""
                                }\n\n${result.summary}`,
                                result.id
                              )
                            }
                          >
                            {copied === result.id ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}

        {/* Legal Sources */}
        <Card className="card-luxe border-none p-6">
          <h3 className="text-lg font-bold text-[#1f1810] mb-4">المصادر القانونية</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LEGAL_SOURCES.map((source) => (
              <Card
                key={source.name}
                className="border border-border/60 hover:border-[#c9a227]/50 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-[#c9a227]" />
                    <h4 className="font-semibold text-sm text-[#1f1810]">
                      {source.name}
                    </h4>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {source.category}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
