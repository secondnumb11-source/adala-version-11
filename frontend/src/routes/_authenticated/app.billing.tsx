import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Receipt, Plus, Download, Eye, Edit, Trash2, Calendar,
  DollarSign, Users, FileText, CheckCircle2, Clock,
} from "lucide-react";
import { PageHeader } from "@/components/section-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useList, useUpsert, useDelete } from "@/lib/data-hooks";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/billing")({
  component: BillingPage,
});

type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string;
  case_id?: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  status: "draft" | "sent" | "paid" | "overdue";
  issue_date: string;
  due_date: string;
  description: string;
  created_at: string;
};

type Client = {
  id: string;
  full_name: string;
  phone?: string;
};

type Case = {
  id: string;
  case_number: string;
  title: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  sent: "مرسلة",
  paid: "مدفوعة",
  overdue: "متأخرة",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
};

function BillingPage() {
  const { data: invoices = [], isLoading } = useList<Invoice>("invoices", "created_at", false);
  const { data: clients = [] } = useList<Client>("clients");
  const { data: cases = [] } = useList<Case>("cases");
  const upsert = useUpsert("invoices");
  const del = useDelete("invoices");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState<Partial<Invoice>>({
    invoice_number: `INV-${Date.now()}`,
    amount: 0,
    vat_amount: 0,
    total_amount: 0,
    status: "draft",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    description: "",
  });

  const calculateTotals = (amount: number) => {
    const vat = amount * 0.15; // 15% VAT in Saudi Arabia
    const total = amount + vat;
    setFormData({
      ...formData,
      amount,
      vat_amount: vat,
      total_amount: total,
    });
  };

  const handleSubmit = async () => {
    if (!formData.client_id) {
      toast.error("الرجاء اختيار العميل");
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error("الرجاء إدخال مبلغ صحيح");
      return;
    }

    try {
      await upsert.mutateAsync({
        ...editing,
        ...formData,
      });
      setOpen(false);
      setEditing(null);
      setFormData({
        invoice_number: `INV-${Date.now()}`,
        amount: 0,
        vat_amount: 0,
        total_amount: 0,
        status: "draft",
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        description: "",
      });
    } catch (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الفاتورة؟")) {
      del.mutate(id);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditing(invoice);
    setFormData(invoice);
    setOpen(true);
  };

  const stats = {
    total: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
    paid: invoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + inv.total_amount, 0),
    pending: invoices.filter((inv) => inv.status === "sent").reduce((sum, inv) => sum + inv.total_amount, 0),
    overdue: invoices.filter((inv) => inv.status === "overdue").reduce((sum, inv) => sum + inv.total_amount, 0),
  };

  return (
    <>
      <PageHeader
        icon={Receipt}
        title="الفواتير والمدفوعات"
        subtitle="إدارة الفواتير والمدفوعات مع دعم ضريبة القيمة المضافة"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormData({
                invoice_number: `INV-${Date.now()}`,
                amount: 0,
                vat_amount: 0,
                total_amount: 0,
                status: "draft",
                issue_date: new Date().toISOString().slice(0, 10),
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                description: "",
              });
              setOpen(true);
            }}
            className="btn-gold"
          >
            <Plus className="h-4 w-4" />
            <span className="mr-2">فاتورة جديدة</span>
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="card-luxe border-none p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
              <p className="text-2xl font-bold text-[#1f1810] mt-1">
                {stats.total.toLocaleString("ar-SA")} ر.س
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-[#c9a227]" />
          </div>
        </Card>

        <Card className="card-luxe border-none p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">المدفوعة</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {stats.paid.toLocaleString("ar-SA")} ر.س
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
        </Card>

        <Card className="card-luxe border-none p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">قيد الانتظار</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {stats.pending.toLocaleString("ar-SA")} ر.س
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="card-luxe border-none p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">متأخرة</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {stats.overdue.toLocaleString("ar-SA")} ر.س
              </p>
            </div>
            <Clock className="h-8 w-8 text-rose-600" />
          </div>
        </Card>
      </div>

      {/* Invoices List */}
      <Card className="card-luxe border-none p-6">
        <h3 className="text-lg font-bold text-[#1f1810] mb-4">الفواتير</h3>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-10">جارٍ التحميل...</p>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد فواتير</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const client = clients.find((c) => c.id === invoice.client_id);
              const caseData = cases.find((c) => c.id === invoice.case_id);

              return (
                <Card
                  key={invoice.id}
                  className="border border-border/60 hover:border-[#c9a227]/50 hover:shadow-md transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#c9a227]/10 flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-[#c9a227]" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#1f1810]">
                            {invoice.invoice_number}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {client?.full_name || "عميل غير محدد"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[invoice.status]}
                      >
                        {STATUS_LABEL[invoice.status]}
                      </Badge>
                    </div>

                    {caseData && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <strong>القضية:</strong> #{caseData.case_number} - {caseData.title}
                      </div>
                    )}

                    {invoice.description && (
                      <p className="text-sm text-[#1f1810]/80 mb-3">
                        {invoice.description}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-4 mb-3 pt-3 border-t border-border/40">
                      <div>
                        <p className="text-xs text-muted-foreground">المبلغ</p>
                        <p className="font-bold text-[#1f1810]">
                          {invoice.amount.toLocaleString("ar-SA")} ر.س
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">ضريبة القيمة المضافة (15%)</p>
                        <p className="font-bold text-[#1f1810]">
                          {invoice.vat_amount.toLocaleString("ar-SA")} ر.س
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الإجمالي</p>
                        <p className="font-bold text-[#c9a227]">
                          {invoice.total_amount.toLocaleString("ar-SA")} ر.س
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>الإصدار: {new Date(invoice.issue_date).toLocaleDateString("ar-SA")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>الاستحقاق: {new Date(invoice.due_date).toLocaleDateString("ar-SA")}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(invoice)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(invoice.id)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "تعديل الفاتورة" : "فاتورة جديدة"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>رقم الفاتورة</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                />
              </div>
              <div>
                <Label>الحالة</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>العميل</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>القضية (اختياري)</Label>
              <Select
                value={formData.case_id}
                onValueChange={(value) => setFormData({ ...formData, case_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القضية" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      #{c.case_number} - {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>المبلغ (ر.س)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => calculateTotals(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>ضريبة القيمة المضافة (15%)</Label>
                <Input value={formData.vat_amount.toFixed(2)} disabled />
              </div>
            </div>

            <div>
              <Label>الإجمالي</Label>
              <Input
                value={formData.total_amount.toFixed(2)}
                disabled
                className="font-bold text-[#c9a227] text-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>تاريخ الإصدار</Label>
                <Input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                />
              </div>
              <div>
                <Label>تاريخ الاستحقاق</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>الوصف</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف الخدمات المقدمة"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} className="btn-gold">
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
