import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Token",
  "Access-Control-Max-Age": "86400",
};

// Hard limits — defence in depth against oversized / malformed callers.
const MAX_BODY_BYTES = 2_000_000; // ~2 MB JSON payload cap
const MIN_TOKEN_LEN = 24;
const MAX_TOKEN_LEN = 256;
const TOKEN_RE = /^[A-Za-z0-9_\-+/=.]+$/; // hex / base64 / url-safe variants

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

// Constant-time compare of two hex hashes of equal length.
function safeEqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

// Shape coming from the Chrome extension
// Reusable field helpers — trim + length bounds + format checks
const ID = z.string().trim().min(1, "معرّف فارغ").max(120, "معرّف طويل جداً");
const SHORT = z.string().trim().min(1).max(200);
const LONG = z.string().trim().min(1).max(500);
const OPT_SHORT = z.string().trim().max(200).optional().or(z.literal("").transform(() => undefined));
const OPT_LONG = z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined));

// Accept ISO date (YYYY-MM-DD) or full ISO timestamp
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const OPT_DATE = z
  .string()
  .trim()
  .regex(ISO_DATE_RE, "تاريخ غير صالح")
  .optional()
  .or(z.literal("").transform(() => undefined));
const REQ_DATE = z
  .string()
  .trim()
  .regex(ISO_DATE_RE, "تاريخ الجلسة غير صالح")
  .refine((v) => {
    const t = Date.parse(v);
    if (!Number.isFinite(t)) return false;
    const year = new Date(t).getUTCFullYear();
    return year >= 1970 && year <= 2100;
  }, "تاريخ خارج النطاق المسموح");

const MAX_ITEMS = 2000;

const PayloadSchema = z
  .object({
    kind: z.enum(["cases", "powers", "executions", "sessions", "documents", "lawsuit_requests", "mixed"]),
    sourceUrl: z.string().trim().max(1000).optional(),
    documents: z
      .array(
        z.object({
          najiz_id: ID,
          title: SHORT,
          case_number: OPT_SHORT,
          court: OPT_SHORT,
          status: OPT_SHORT,
          filed_date: OPT_DATE,
          source_url: z.string().trim().max(1000).optional(),
        }),
      )
      .max(MAX_ITEMS)
      .optional(),
    cases: z
      .array(
        z.object({
          najiz_id: ID,
          case_number: SHORT,
          title: OPT_LONG,
          court: OPT_SHORT,
          case_type: OPT_SHORT,
          status: OPT_SHORT,
          opened_at: OPT_DATE,
          client_name: OPT_SHORT,
          subject_matter: OPT_LONG,
          plaintiff_requests: OPT_LONG,
          case_foundations: OPT_LONG,
          case_classification: OPT_SHORT,
          is_draft: z.boolean().optional(),
        }),
      )
      .max(MAX_ITEMS, `تجاوز الحد الأقصى ${MAX_ITEMS} عنصر`)
      .optional(),
    powers: z
      .array(
        z.object({
          najiz_id: ID,
          wakalah_number: SHORT,
          issuer_name: OPT_SHORT,
          agent_name: OPT_SHORT,
          issue_date: OPT_DATE,
          expiry_date: OPT_DATE,
          scope: OPT_LONG,
          issuer_entity: OPT_SHORT,
          usage_method: OPT_SHORT,
          issuer_capacity: OPT_SHORT,
          issuer_nationality: OPT_SHORT,
          issuer_identity_type: OPT_SHORT,
          issuer_status_in_agency: OPT_SHORT,
          agent_capacity: OPT_SHORT,
          agent_nationality: OPT_SHORT,
          agent_identity_type: OPT_SHORT,
          agent_status_in_agency: OPT_SHORT,
          agency_clauses: OPT_LONG,
          agency_text: OPT_LONG,
          agency_data: OPT_LONG,
        }),
      )
      .max(MAX_ITEMS)
      .optional(),
    executions: z
      .array(
        z.object({
          najiz_id: ID,
          execution_number: SHORT,
          court: OPT_SHORT,
          amount: z
            .number()
            .finite("قيمة غير صالحة")
            .min(0, "المبلغ لا يمكن أن يكون سالباً")
            .max(1_000_000_000_000, "المبلغ كبير جداً")
            .optional(),
          debtor_name: OPT_SHORT,
          status: OPT_SHORT,
          filed_date: OPT_DATE,
        }),
      )
      .max(MAX_ITEMS)
      .optional(),
    sessions: z
      .array(
        z.object({
          najiz_case_id: ID,
          session_date: REQ_DATE,
          court: OPT_SHORT,
          room: OPT_SHORT,
          status: OPT_SHORT,
        }),
      )
      .max(MAX_ITEMS)
      .optional(),
    case_details: z.array(z.object({
      case_number: SHORT,
      case_classification: OPT_SHORT,
      case_type_detail: OPT_SHORT,
      case_date: OPT_SHORT,
      subject_matter: OPT_LONG,
      plaintiff_requests: OPT_LONG,
      case_foundations: OPT_LONG,
      court_name: OPT_SHORT,
      circuit_number: OPT_SHORT,
      registration_date: OPT_DATE,
      deed_number: OPT_SHORT,
      deed_date: OPT_SHORT,
      is_draft: z.boolean().optional(),
    })).max(MAX_ITEMS).optional(),
    case_parties: z.array(z.object({
      case_number: OPT_SHORT,
      party_role: SHORT,
      name: SHORT,
      nationality: OPT_SHORT,
      id_type: OPT_SHORT,
      id_number: OPT_SHORT,
      capacity: OPT_SHORT,
      poa_status: OPT_SHORT,
    })).max(MAX_ITEMS).optional(),
    case_sessions_detail: z.array(z.object({
      case_number: OPT_SHORT,
      session_status: OPT_SHORT,
      court_name: OPT_SHORT,
      circuit_number: OPT_SHORT,
      mechanism: OPT_SHORT,
      degree: OPT_SHORT,
      session_date: OPT_SHORT,
      session_time: OPT_SHORT,
      session_details: OPT_LONG,
    })).max(MAX_ITEMS).optional(),
    case_judgments: z.array(z.object({
      case_number: OPT_SHORT,
      judgment_finality: OPT_SHORT,
      deed_number: OPT_SHORT,
      deed_date: OPT_SHORT,
      court: OPT_SHORT,
      circuit: OPT_SHORT,
      degree: OPT_SHORT,
      appeal_deed_number: OPT_SHORT,
      appeal_deed_date: OPT_SHORT,
      appeal_circuit: OPT_SHORT,
      judgment_details: OPT_LONG,
      judgment_document_url: OPT_SHORT,
    })).max(MAX_ITEMS).optional(),
    lawsuit_requests: z.array(z.object({
      case_number: OPT_SHORT,
      case_date: OPT_SHORT,
      court_name: OPT_SHORT,
      circuit_number: OPT_SHORT,
      case_status: OPT_SHORT,
      case_classification: OPT_SHORT,
      case_type_detail: OPT_SHORT,
      applicant_type: OPT_SHORT,
      applicant_name: OPT_SHORT,
      request_type: OPT_SHORT,
      judgment_number: OPT_SHORT,
      submissions: OPT_LONG,
      request_reasons: OPT_LONG,
      reason_1: OPT_LONG,
      reason_2: OPT_LONG,
      reason_3: OPT_LONG,
      reason_4: OPT_LONG,
      reason_5: OPT_LONG,
      reason_6: OPT_LONG,
    })).max(MAX_ITEMS).optional(),
  })
  .superRefine((p, ctx) => {
    const counts = {
      cases: p.cases?.length ?? 0,
      powers: p.powers?.length ?? 0,
      executions: p.executions?.length ?? 0,
      sessions: p.sessions?.length ?? 0,
      documents: p.documents?.length ?? 0,
      case_details: p.case_details?.length ?? 0,
      case_parties: p.case_parties?.length ?? 0,
      case_sessions_detail: p.case_sessions_detail?.length ?? 0,
      case_judgments: p.case_judgments?.length ?? 0,
      lawsuit_requests: p.lawsuit_requests?.length ?? 0,
    };
    const total = counts.cases + counts.powers + counts.executions + counts.sessions + counts.documents
      + counts.case_details + counts.case_parties + counts.case_sessions_detail + counts.case_judgments + counts.lawsuit_requests;
    if (total === 0) {
      ctx.addIssue({ code: "custom", message: "لا توجد بيانات لحفظها — الحمولة فارغة" });
    }
    if (p.kind !== "mixed" && counts[p.kind] === 0) {
      ctx.addIssue({ code: "custom", path: [p.kind], message: `النوع "${p.kind}" مُعلَن لكن لا توجد عناصر مطابقة` });
    }
    for (const key of ["cases", "powers", "executions", "documents"] as const) {
      const arr = p[key];
      if (!arr) continue;
      const seen = new Set<string>();
      arr.forEach((item, i) => {
        const id = item.najiz_id;
        if (seen.has(id)) {
          ctx.addIssue({ code: "custom", path: [key, i, "najiz_id"], message: `معرّف مكرر في نفس الدفعة: ${id}` });
        }
        seen.add(id);
      });
    }
  });

function mapCaseType(raw?: string): string {
  if (!raw) return "other";
  const t = raw.toLowerCase();
  if (t.includes("عمل")) return "labor";
  if (t.includes("تجار")) return "commercial";
  if (t.includes("تنفيذ")) return "execution";
  if (t.includes("أحوال") || t.includes("احوال")) return "personal_status";
  if (t.includes("إدار") || t.includes("ادار")) return "administrative";
  if (t.includes("جناي") || t.includes("جزائ")) return "criminal";
  if (t.includes("مدن")) return "civil";
  return "other";
}

function mapCaseStatus(raw?: string): string {
  if (!raw) return "open";
  const t = raw.toLowerCase();
  if (t.includes("منته") || t.includes("مغلق")) return "closed_final";
  if (t.includes("استئناف")) return "appealed";
  if (t.includes("دراس")) return "in_study";
  return "open";
}

function mapExecutionStatus(raw?: string): string {
  if (!raw) return "pending";
  const t = raw.toLowerCase();
  if (t.includes("منته") || t.includes("مكتم")) return "completed";
  if (t.includes("جار") || t.includes("تنفيذ")) return "in_progress";
  if (t.includes("رفض")) return "rejected";
  return "pending";
}

export const Route = createFileRoute("/api/public/najiz-sync")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      // Lightweight connection test — verifies the Base URL is reachable AND the
      // X-Sync-Token is valid, WITHOUT sending any data. Used by the dashboard
      // "Test connection" button and by the extension's pre-flight check.
      GET: async ({ request }) => {
        try {
          const token = request.headers.get("x-sync-token")?.trim();
          if (!token) {
            // Reachable endpoint, but no token supplied → confirm route works.
            return json({ ok: true, endpoint: "najiz-sync", authenticated: false, message: "الواجهة متاحة — لم يتم تقديم رمز للتحقق" });
          }
          if (token.length < MIN_TOKEN_LEN || token.length > MAX_TOKEN_LEN || !TOKEN_RE.test(token)) {
            return json({ ok: false, error: { code: "unauthorized", message: "رمز المزامنة غير صالح الصيغة" } }, 401);
          }
          const hash = createHash("sha256").update(token).digest("hex");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: tokenRow, error: tokErr } = await (supabaseAdmin as any)
            .from("sync_tokens").select("is_revoked, expires_at, token_hash, last_used_at").eq("token_hash", hash).maybeSingle();
          if (tokErr) {
            return json({ ok: false, error: { code: "server_error", message: "تعذّر التحقق من الرمز حالياً" } }, 500);
          }
          if (!tokenRow || !safeEqHex(String(tokenRow.token_hash ?? ""), hash)) {
            return json({ ok: false, error: { code: "unauthorized", message: "رمز المزامنة غير معروف — تأكد من نسخه كاملاً" } }, 401);
          }
          if (tokenRow.is_revoked) {
            return json({ ok: false, error: { code: "unauthorized", message: "تم إلغاء هذا الرمز — أنشئ رمزاً جديداً" } }, 401);
          }
          if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
            return json({ ok: false, error: { code: "unauthorized", message: "انتهت صلاحية رمز المزامنة — أنشئ رمزاً جديداً" } }, 401);
          }
          return json({ ok: true, endpoint: "najiz-sync", authenticated: true, last_used_at: tokenRow.last_used_at ?? null, message: "الاتصال سليم — الرابط والرمز صحيحان وجاهزان للمزامنة" });
        } catch (e: any) {
          return json({ ok: false, error: { code: "server_error", message: "تعذّر إجراء اختبار الاتصال" } }, 500);
        }
      },

      POST: async ({ request }) => {
        const reqId = `najiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const trace: any[] = [];
        const log = (step: string, info?: unknown) => {
          const entry = { step, t: Date.now(), info };
          trace.push(entry);
          // live server-log output for debugging from server-function-logs / dev terminal
          console.log(`[najiz-sync ${reqId}] ${step}`, info !== undefined ? info : "");
        };

        try {
          // ---- content-type & size guards (before any work) ----
          const ctype = request.headers.get("content-type") ?? "";
          if (!ctype.toLowerCase().includes("application/json")) {
            log("bad_content_type", ctype);
            return json(
              { error: { code: "bad_request", message: "Content-Type يجب أن يكون application/json" } },
              415,
            );
          }
          const declaredLen = Number(request.headers.get("content-length") ?? "0");
          if (Number.isFinite(declaredLen) && declaredLen > MAX_BODY_BYTES) {
            log("payload_too_large_header", declaredLen);
            return json(
              { error: { code: "payload_too_large", message: "حجم الحمولة يتجاوز الحد المسموح" } },
              413,
            );
          }

          // ---- auth ----
          const token = request.headers.get("x-sync-token")?.trim();
          if (!token) {
            log("auth_missing");
            return json({ error: { code: "unauthorized", message: "X-Sync-Token مفقود" } }, 401);
          }
          if (
            token.length < MIN_TOKEN_LEN ||
            token.length > MAX_TOKEN_LEN ||
            !TOKEN_RE.test(token)
          ) {
            log("auth_bad_format");
            // Generic message — do not hint at token shape to callers.
            return json({ error: { code: "unauthorized", message: "رمز المزامنة غير صالح" } }, 401);
          }
          const hash = createHash("sha256").update(token).digest("hex");
          log("auth_hashed");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: tokenRow, error: tokErr } = await (supabaseAdmin as any)
            .from("sync_tokens").select("owner_id, is_revoked, expires_at, token_hash")
            .eq("token_hash", hash).maybeSingle();
          if (tokErr) {
            log("auth_db_error", tokErr.message);
            return json({ error: { code: "unauthorized", message: "تعذّر التحقق من الرمز" } }, 401);
          }
          if (!tokenRow || tokenRow.is_revoked || !safeEqHex(String(tokenRow.token_hash ?? ""), hash)) {
            log("auth_invalid");
            return json({ error: { code: "unauthorized", message: "رمز المزامنة غير صالح أو ملغى" } }, 401);
          }
          if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
            log("auth_expired");
            return json({ error: { code: "unauthorized", message: "انتهت صلاحية رمز المزامنة" } }, 401);
          }
          const owner_id = tokenRow.owner_id;
          if (!owner_id || typeof owner_id !== "string") {
            log("auth_owner_missing");
            return json({ error: { code: "unauthorized", message: "رمز المزامنة غير صالح" } }, 401);
          }
          log("auth_ok", { owner_id });

          // ---- payload (size-capped read, then JSON.parse) ----
          const bodyText = await request.text().catch(() => "");
          if (!bodyText) {
            log("payload_empty");
            return json({ error: { code: "bad_request", message: "حمولة فارغة" } }, 400);
          }
          if (bodyText.length > MAX_BODY_BYTES) {
            log("payload_too_large", bodyText.length);
            return json(
              { error: { code: "payload_too_large", message: "حجم الحمولة يتجاوز الحد المسموح" } },
              413,
            );
          }
          let raw: unknown = null;
          try {
            raw = JSON.parse(bodyText);
          } catch {
            raw = null;
          }
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            log("payload_invalid");
            return json({ error: { code: "bad_request", message: "حمولة JSON غير صالحة" } }, 400);
          }
          const parsed = PayloadSchema.safeParse(raw);
          if (!parsed.success) {
            log("payload_zod_failed", parsed.error.issues);
            // Return only field paths + safe messages — never the offending values.
            const safeIssues = parsed.error.issues.slice(0, 50).map((i) => ({
              path: i.path.join("."),
              message: i.message,
              code: i.code,
            }));
            return json(
              { error: { code: "bad_request", message: "حقول مفقودة أو غير صالحة", details: safeIssues } },
              400,
            );
          }
          const payload = parsed.data;
          log("payload_ok", { kind: payload.kind, counts: {
            cases: payload.cases?.length ?? 0,
            powers: payload.powers?.length ?? 0,
            executions: payload.executions?.length ?? 0,
            sessions: payload.sessions?.length ?? 0,
            case_details: payload.case_details?.length ?? 0,
            case_parties: payload.case_parties?.length ?? 0,
            case_sessions_detail: payload.case_sessions_detail?.length ?? 0,
            case_judgments: payload.case_judgments?.length ?? 0,
            lawsuit_requests: payload.lawsuit_requests?.length ?? 0,
          }});

          let inserted = 0;
          let updated = 0;
          let total = 0;

          // ---- CASES (do NOT mix with executions/powers) ----
          if (payload.cases?.length) {
            log("mapping_cases", { count: payload.cases.length });
            const rows = payload.cases.map((c) => ({
              owner_id,
              najiz_id: c.najiz_id,
              case_number: c.case_number,
              title: c.title || c.case_number,
              court: c.court ?? null,
              case_type: mapCaseType(c.case_type) as any,
              status: mapCaseStatus(c.status) as any,
              opened_at: c.opened_at ?? new Date().toISOString().slice(0, 10),
              subject_matter: c.subject_matter ?? null,
              plaintiff_requests: c.plaintiff_requests ?? null,
              case_foundations: c.case_foundations ?? null,
              case_classification: c.case_classification ?? null,
              is_draft: c.is_draft ?? null,
              najiz_synced_at: new Date().toISOString(),
            }));
            total += rows.length;
            const { data, error } = await (supabaseAdmin as any)
              .from("cases")
              .upsert(rows, { onConflict: "owner_id,najiz_id", ignoreDuplicates: false })
              .select("id");
            if (error) {
              log("cases_upsert_error", error.message);
              throw new Error(`cases upsert: ${error.message}`);
            }
            inserted += data?.length ?? 0;
            log("cases_done", { affected: data?.length });
          }

          // ---- POWERS (separate; never written to executions) ----
          if (payload.powers?.length) {
            log("mapping_powers", { count: payload.powers.length });
            const rows = payload.powers.map((p) => ({
              owner_id,
              najiz_id: p.najiz_id,
              wakalah_number: p.wakalah_number,
              issuer_name: p.issuer_name ?? null,
              agent_name: p.agent_name ?? null,
              issue_date: p.issue_date ?? null,
              expiry_date: p.expiry_date ?? null,
              scope: p.scope ?? null,
              issuer_entity: p.issuer_entity ?? null,
              usage_method: p.usage_method ?? null,
              issuer_capacity: p.issuer_capacity ?? null,
              issuer_nationality: p.issuer_nationality ?? null,
              issuer_identity_type: p.issuer_identity_type ?? null,
              issuer_status_in_agency: p.issuer_status_in_agency ?? null,
              agent_capacity: p.agent_capacity ?? null,
              agent_nationality: p.agent_nationality ?? null,
              agent_identity_type: p.agent_identity_type ?? null,
              agent_status_in_agency: p.agent_status_in_agency ?? null,
              agency_clauses: p.agency_clauses ?? null,
              agency_text: p.agency_text ?? null,
              agency_data: p.agency_data ?? null,
              najiz_synced_at: new Date().toISOString(),
            }));
            total += rows.length;
            const { data, error } = await (supabaseAdmin as any)
              .from("powers_of_attorney")
              .upsert(rows, { onConflict: "owner_id,najiz_id" })
              .select("id");
            if (error) {
              log("powers_upsert_error", error.message);
              throw new Error(`powers upsert: ${error.message}`);
            }
            updated += data?.length ?? 0;
            log("powers_done", { affected: data?.length });
          }

          // ---- EXECUTIONS (separate target table) ----
          if (payload.executions?.length) {
            log("mapping_executions", { count: payload.executions.length });
            const rows = payload.executions.map((e) => ({
              owner_id,
              najiz_id: e.najiz_id,
              execution_number: e.execution_number,
              court: e.court ?? null,
              amount: e.amount ?? null,
              debtor_name: e.debtor_name ?? null,
              status: mapExecutionStatus(e.status) as any,
              filed_date: e.filed_date ?? null,
              najiz_synced_at: new Date().toISOString(),
            }));
            total += rows.length;
            const { data, error } = await (supabaseAdmin as any)
              .from("executions")
              .upsert(rows, { onConflict: "owner_id,najiz_id" })
              .select("id");
            if (error) {
              log("executions_upsert_error", error.message);
              throw new Error(`executions upsert: ${error.message}`);
            }
            updated += data?.length ?? 0;
            log("executions_done", { affected: data?.length });
          }

          // ---- SESSIONS (linked to existing cases; auto-create placeholder cases for unmatched IDs so sessions are never silently dropped) ----
          if (payload.sessions?.length) {
            log("mapping_sessions", { count: payload.sessions.length });
            const caseIds = Array.from(new Set(payload.sessions.map((s) => s.najiz_case_id)));
            const { data: linkedCases } = await (supabaseAdmin as any)
              .from("cases").select("id, najiz_id").eq("owner_id", owner_id).in("najiz_id", caseIds);
            const map = new Map((linkedCases ?? []).map((c: { najiz_id: string; id: string }) => [c.najiz_id, c.id]));

            // Auto-create placeholder cases for any session referring to a najiz_id that doesn't yet exist
            const missing = caseIds.filter((id) => !map.has(id));
            if (missing.length) {
              log("sessions_auto_create_placeholders", { count: missing.length });
              const placeholderRows = missing.map((najiz_id) => ({
                owner_id,
                najiz_id,
                case_number: najiz_id.replace(/^case_/, ""),
                title: `قضية (من جلسة) — ${najiz_id.replace(/^case_/, "")}`,
                court: null,
                case_type: "other" as any,
                status: "open" as any,
                opened_at: new Date().toISOString().slice(0, 10),
                najiz_synced_at: new Date().toISOString(),
              }));
              const { data: created } = await (supabaseAdmin as any)
                .from("cases")
                .upsert(placeholderRows, { onConflict: "owner_id,najiz_id", ignoreDuplicates: false })
                .select("id, najiz_id");
              (created ?? []).forEach((c: { najiz_id: string; id: string }) => map.set(c.najiz_id, c.id));
            }

            const rows = payload.sessions
              .filter((s) => map.has(s.najiz_case_id))
              .map((s) => ({
                owner_id,
                case_id: map.get(s.najiz_case_id)!,
                session_date: s.session_date,
                court: s.court ?? null,
                room: s.room ?? null,
              }));
            total += rows.length;
            if (rows.length) {
              // Deduplicate against existing sessions (same case + date) to avoid double-inserts on resync
              const dedupeKeys = rows.map((r) => `${r.case_id}|${r.session_date}`);
              const { data: existingSessions } = await (supabaseAdmin as any)
                .from("sessions").select("case_id, session_date").in("case_id", rows.map((r) => r.case_id));
              const existing = new Set((existingSessions ?? []).map((s: any) => `${s.case_id}|${s.session_date}`));
              const newRows = rows.filter((r, i) => !existing.has(dedupeKeys[i]));
              if (newRows.length) {
                const { error } = await (supabaseAdmin as any).from("sessions").insert(newRows);
                if (error) {
                  log("sessions_insert_error", error.message);
                  throw new Error(`sessions insert: ${error.message}`);
                }
                inserted += newRows.length;
              }
            }
            log("sessions_done", { affected: rows.length });
          }

          // ---- CASE DETAILS (enriched case data; upsert into case_details) ----
          if (payload.case_details?.length) {
            log("mapping_case_details", { count: payload.case_details.length });
            const caseNumbers = Array.from(new Set(payload.case_details.map((d) => d.case_number)));
            const { data: linkedCases } = await (supabaseAdmin as any)
              .from("cases").select("id, case_number").eq("owner_id", owner_id).in("case_number", caseNumbers);
            const caseMap = new Map((linkedCases ?? []).map((c: { case_number: string; id: string }) => [c.case_number, c.id]));

            const rows = payload.case_details
              .filter((d) => caseMap.has(d.case_number))
              .map((d) => ({
                owner_id,
                case_id: caseMap.get(d.case_number)!,
                case_number: d.case_number,
                case_classification: d.case_classification ?? null,
                case_type_detail: d.case_type_detail ?? null,
                case_date: d.case_date ?? null,
                subject_matter: d.subject_matter ?? null,
                plaintiff_requests: d.plaintiff_requests ?? null,
                case_foundations: d.case_foundations ?? null,
                court_name: d.court_name ?? null,
                circuit_number: d.circuit_number ?? null,
                registration_date: d.registration_date ?? null,
                deed_number: d.deed_number ?? null,
                deed_date: d.deed_date ?? null,
                is_draft: d.is_draft ?? null,
              }));
            total += rows.length;
            if (rows.length) {
              const { error } = await (supabaseAdmin as any)
                .from("case_details")
                .upsert(rows, { onConflict: "owner_id,case_id" });
              if (error) {
                log("case_details_upsert_error", error.message);
                throw new Error(`case_details upsert: ${error.message}`);
              }
              updated += rows.length;

              const caseIds = rows.map((r) => r.case_id);
              const updates = rows.map((r) => ({
                id: r.case_id,
                subject_matter: r.subject_matter,
                plaintiff_requests: r.plaintiff_requests,
                case_foundations: r.case_foundations,
                case_classification: r.case_classification,
                is_draft: r.is_draft,
              }));
              for (const u of updates) {
                const { id, ...fields } = u;
                await (supabaseAdmin as any).from("cases").update(fields).eq("id", id);
              }
            }
            log("case_details_done", { affected: rows.length });
          }

          // ---- CASE PARTIES (replace strategy: delete existing, insert new) ----
          if (payload.case_parties?.length) {
            log("mapping_case_parties", { count: payload.case_parties.length });
            const caseNumbers = Array.from(new Set(payload.case_parties.map((p) => p.case_number).filter(Boolean) as string[]));
            let caseMap = new Map<string, string>();
            if (caseNumbers.length) {
              const { data: linkedCases } = await (supabaseAdmin as any)
                .from("cases").select("id, case_number").eq("owner_id", owner_id).in("case_number", caseNumbers);
              caseMap = new Map((linkedCases ?? []).map((c: { case_number: string; id: string }) => [c.case_number, c.id]));
            }

            const caseIds = Array.from(new Set(
              payload.case_parties.map((p) => caseMap.get(p.case_number ?? "")).filter(Boolean) as string[]
            ));
            if (caseIds.length) {
              const { error: delErr } = await (supabaseAdmin as any)
                .from("case_parties").delete().in("case_id", caseIds).eq("owner_id", owner_id);
              if (delErr) {
                log("case_parties_delete_error", delErr.message);
                throw new Error(`case_parties delete: ${delErr.message}`);
              }
            }

            const rows = payload.case_parties
              .filter((p) => p.case_number && caseMap.has(p.case_number))
              .map((p) => ({
                owner_id,
                case_id: caseMap.get(p.case_number!)!,
                party_role: p.party_role,
                name: p.name,
                nationality: p.nationality ?? null,
                id_type: p.id_type ?? null,
                id_number: p.id_number ?? null,
                capacity: p.capacity ?? null,
                poa_status: p.poa_status ?? null,
              }));
            total += rows.length;
            if (rows.length) {
              const { error } = await (supabaseAdmin as any).from("case_parties").insert(rows);
              if (error) {
                log("case_parties_insert_error", error.message);
                throw new Error(`case_parties insert: ${error.message}`);
              }
              inserted += rows.length;
            }
            log("case_parties_done", { affected: rows.length });
          }

          // ---- CASE SESSIONS DETAIL (replace strategy: delete existing, insert new) ----
          if (payload.case_sessions_detail?.length) {
            log("mapping_case_sessions_detail", { count: payload.case_sessions_detail.length });
            const caseNumbers = Array.from(new Set(payload.case_sessions_detail.map((s) => s.case_number).filter(Boolean) as string[]));
            let caseMap = new Map<string, string>();
            if (caseNumbers.length) {
              const { data: linkedCases } = await (supabaseAdmin as any)
                .from("cases").select("id, case_number").eq("owner_id", owner_id).in("case_number", caseNumbers);
              caseMap = new Map((linkedCases ?? []).map((c: { case_number: string; id: string }) => [c.case_number, c.id]));
            }

            const caseIds = Array.from(new Set(
              payload.case_sessions_detail.map((s) => caseMap.get(s.case_number ?? "")).filter(Boolean) as string[]
            ));
            if (caseIds.length) {
              const { error: delErr } = await (supabaseAdmin as any)
                .from("case_sessions_detail").delete().in("case_id", caseIds).eq("owner_id", owner_id);
              if (delErr) {
                log("case_sessions_detail_delete_error", delErr.message);
                throw new Error(`case_sessions_detail delete: ${delErr.message}`);
              }
            }

            const rows = payload.case_sessions_detail
              .filter((s) => s.case_number && caseMap.has(s.case_number))
              .map((s) => ({
                owner_id,
                case_id: caseMap.get(s.case_number!)!,
                session_status: s.session_status ?? null,
                court_name: s.court_name ?? null,
                circuit_number: s.circuit_number ?? null,
                mechanism: s.mechanism ?? null,
                degree: s.degree ?? null,
                session_date: s.session_date ?? null,
                session_time: s.session_time ?? null,
                session_details: s.session_details ?? null,
              }));
            total += rows.length;
            if (rows.length) {
              const { error } = await (supabaseAdmin as any).from("case_sessions_detail").insert(rows);
              if (error) {
                log("case_sessions_detail_insert_error", error.message);
                throw new Error(`case_sessions_detail insert: ${error.message}`);
              }
              inserted += rows.length;
            }
            log("case_sessions_detail_done", { affected: rows.length });
          }

          // ---- CASE JUDGMENTS (replace strategy: delete existing, insert new) ----
          if (payload.case_judgments?.length) {
            log("mapping_case_judgments", { count: payload.case_judgments.length });
            const caseNumbers = Array.from(new Set(payload.case_judgments.map((j) => j.case_number).filter(Boolean) as string[]));
            let caseMap = new Map<string, string>();
            if (caseNumbers.length) {
              const { data: linkedCases } = await (supabaseAdmin as any)
                .from("cases").select("id, case_number").eq("owner_id", owner_id).in("case_number", caseNumbers);
              caseMap = new Map((linkedCases ?? []).map((c: { case_number: string; id: string }) => [c.case_number, c.id]));
            }

            const caseIds = Array.from(new Set(
              payload.case_judgments.map((j) => caseMap.get(j.case_number ?? "")).filter(Boolean) as string[]
            ));
            if (caseIds.length) {
              const { error: delErr } = await (supabaseAdmin as any)
                .from("case_judgments").delete().in("case_id", caseIds).eq("owner_id", owner_id);
              if (delErr) {
                log("case_judgments_delete_error", delErr.message);
                throw new Error(`case_judgments delete: ${delErr.message}`);
              }
            }

            const rows = payload.case_judgments
              .filter((j) => j.case_number && caseMap.has(j.case_number))
              .map((j) => ({
                owner_id,
                case_id: caseMap.get(j.case_number!)!,
                judgment_finality: j.judgment_finality ?? null,
                deed_number: j.deed_number ?? null,
                deed_date: j.deed_date ?? null,
                court: j.court ?? null,
                circuit: j.circuit ?? null,
                degree: j.degree ?? null,
                appeal_deed_number: j.appeal_deed_number ?? null,
                appeal_deed_date: j.appeal_deed_date ?? null,
                appeal_circuit: j.appeal_circuit ?? null,
                judgment_details: j.judgment_details ?? null,
                judgment_document_url: j.judgment_document_url ?? null,
              }));
            total += rows.length;
            if (rows.length) {
              const { error } = await (supabaseAdmin as any).from("case_judgments").insert(rows);
              if (error) {
                log("case_judgments_insert_error", error.message);
                throw new Error(`case_judgments insert: ${error.message}`);
              }
              inserted += rows.length;
            }
            log("case_judgments_done", { affected: rows.length });
          }

          // ---- LAWSUIT REQUESTS (upsert into lawsuit_requests) ----
          if (payload.lawsuit_requests?.length) {
            log("mapping_lawsuit_requests", { count: payload.lawsuit_requests.length });
            const caseNumbers = Array.from(new Set(payload.lawsuit_requests.map((r) => r.case_number).filter(Boolean) as string[]));
            let caseMap = new Map<string, string>();
            if (caseNumbers.length) {
              const { data: linkedCases } = await (supabaseAdmin as any)
                .from("cases").select("id, case_number").eq("owner_id", owner_id).in("case_number", caseNumbers);
              caseMap = new Map((linkedCases ?? []).map((c: { case_number: string; id: string }) => [c.case_number, c.id]));
            }

            const rows = payload.lawsuit_requests
              .filter((r) => r.case_number && caseMap.has(r.case_number))
              .map((r) => ({
                owner_id,
                case_id: caseMap.get(r.case_number!)!,
                case_number: r.case_number ?? null,
                case_date: r.case_date ?? null,
                court_name: r.court_name ?? null,
                circuit_number: r.circuit_number ?? null,
                case_status: r.case_status ?? null,
                case_classification: r.case_classification ?? null,
                case_type_detail: r.case_type_detail ?? null,
                applicant_type: r.applicant_type ?? null,
                applicant_name: r.applicant_name ?? null,
                request_type: r.request_type ?? null,
                judgment_number: r.judgment_number ?? null,
                submissions: r.submissions ?? null,
                request_reasons: r.request_reasons ?? null,
                reason_1: r.reason_1 ?? null,
                reason_2: r.reason_2 ?? null,
                reason_3: r.reason_3 ?? null,
                reason_4: r.reason_4 ?? null,
                reason_5: r.reason_5 ?? null,
                reason_6: r.reason_6 ?? null,
              }));
            total += rows.length;
            if (rows.length) {
              const { error } = await (supabaseAdmin as any)
                .from("lawsuit_requests")
                .upsert(rows, { onConflict: "owner_id,case_id" });
              if (error) {
                log("lawsuit_requests_upsert_error", error.message);
                throw new Error(`lawsuit_requests upsert: ${error.message}`);
              }
              updated += rows.length;
            }
            log("lawsuit_requests_done", { affected: rows.length });
          }

          // ---- DOCUMENTS (judgments / decisions / requests-on-cases → documents archive) ----
          if (payload.documents?.length) {
            log("mapping_documents", { count: payload.documents.length });
            // Build a najiz_id → cases.id lookup for linking documents to cases when possible
            const caseNumbers = Array.from(new Set(payload.documents.map((d) => d.case_number).filter(Boolean) as string[]));
            let caseMap = new Map<string, string>();
            if (caseNumbers.length) {
              const { data: linkedCases } = await (supabaseAdmin as any)
                .from("cases").select("id, najiz_id").eq("owner_id", owner_id).in("najiz_id", caseNumbers);
              caseMap = new Map((linkedCases ?? []).map((c: { najiz_id: string; id: string }) => [c.najiz_id, c.id]));
            }
            const inferDocType = (title: string) => {
              const t = (title || "").toLowerCase();
              if (/استئناف|نقض/.test(t)) return "appeal_judgment" as any;
              if (/حكم|صك|judgment/.test(t)) return "judgment_final" as any;
              if (/قرار|decision/.test(t)) return "other" as any;
              if (/محضر|ضبط/.test(t)) return "session_minutes" as any;
              return "lawsuit" as any;
            };
            const rows = payload.documents.map((d) => ({
              owner_id,
              title: d.title,
              case_id: d.case_number ? caseMap.get(d.case_number) ?? null : null,
              court: d.court ?? null,
              filed_date: d.filed_date ?? null,
              description: d.source_url ? `مصدر: ${d.source_url}` : null,
              doc_type: inferDocType(d.title),
            }));
            total += rows.length;
            if (rows.length) {
              // Idempotent: skip documents that already exist by (owner_id, title, filed_date)
              const titles = rows.map((r) => r.title);
              const { data: existingDocs } = await (supabaseAdmin as any)
                .from("documents").select("title, filed_date").eq("owner_id", owner_id).in("title", titles);
              const existSet = new Set((existingDocs ?? []).map((d: any) => `${d.title}|${d.filed_date ?? ""}`));
              const newRows = rows.filter((r) => !existSet.has(`${r.title}|${r.filed_date ?? ""}`));
              if (newRows.length) {
                const { data, error } = await (supabaseAdmin as any).from("documents").insert(newRows).select("id");
                if (error) {
                  log("documents_insert_error", error.message);
                  throw new Error(`documents insert: ${error.message}`);
                }
                inserted += data?.length ?? 0;
              }
            }
            log("documents_done", { affected: rows.length });
          }


          // ---- record sync log ----
          await (supabaseAdmin as any).from("najiz_sync_logs").insert({
            owner_id,
            source: `extension:${payload.kind}`,
            status: "success",
            items_count: total,
            inserted_count: inserted,
            updated_count: updated,
            raw_payload: { payload, trace } as any,
          });

          await (supabaseAdmin as any).from("sync_tokens")
            .update({ last_used_at: new Date().toISOString() })
            .eq("token_hash", hash);


          log("done");
          return json({ ok: true, total, inserted, updated });
        } catch (err) {
          const message = err instanceof Error ? err.message : "خطأ غير معروف";
          trace.push({ step: "fatal_error", info: message });
          // Log full error server-side only; never echo internal details to the caller.
          console.error("[najiz-sync] fatal", err);
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const token = request.headers.get("x-sync-token")?.trim();
            if (token) {
              const hash = createHash("sha256").update(token).digest("hex");
              const { data: tokenRow } = await (supabaseAdmin as any)
                .from("sync_tokens").select("owner_id").eq("token_hash", hash).maybeSingle();
              if (tokenRow) {
                await (supabaseAdmin as any).from("najiz_sync_logs").insert({
                  owner_id: (tokenRow as any).owner_id,
                  source: "extension:mixed",
                  status: "failed",
                  error_message: message,
                  raw_payload: { trace } as any,
                });
              }
            }
          } catch { /* swallow logging errors */ }
          return json(
            { error: { code: "internal", message: "حدث خطأ داخلي. يرجى المحاولة لاحقاً." } },
            500,
          );
        }
      },
    },
  },
});
