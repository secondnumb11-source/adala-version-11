// منصة العدالة — Najiz hybrid scraper v4.0
// يدمج: (1) ماسحات v13 المتخصصة للجداول المرئية + (2) سحب DOM + (3) التقاط شبكة + (4) سحب الشاشة
// ويُخرج البيانات بصيغة API النظام: /api/public/najiz-sync { kind, cases, powers, executions, sessions, documents }

(function () {
  if (window.__ADALA_NAJIZ_LOADED__) return;
  window.__ADALA_NAJIZ_LOADED__ = true;

  // =====================================================
  // أدوات أساسية
  // =====================================================
  const clean = (v) => (v || "").toString().replace(/\s+/g, " ").trim();
  const text = (el) => clean(el?.textContent || el?.innerText || "");
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // =====================================================
  // قنطرة التقاط شبكة (injected.js)
  // =====================================================
  const CAPTURE_KEY = "adalaNajizNetworkCaptures";
  const MAX_CAPTURED = 80;
  const captured = [];

  function injectNetworkBridge() {
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("injected.js");
      script.async = false;
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) { console.warn("[adala] injectNetworkBridge failed", e); }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "ADALA_NAJIZ_BRIDGE") return;
    rememberNetworkPayload(event.data.payload);
  });

  async function rememberNetworkPayload(payload) {
    if (!payload?.url || payload.status >= 400) return;
    const entry = {
      url: payload.url, method: payload.method || "GET",
      status: payload.status, ts: payload.ts || Date.now(),
      body: payload.body,
    };
    captured.unshift(entry);
    if (captured.length > MAX_CAPTURED) captured.length = MAX_CAPTURED;
    try {
      const stored = await chrome.storage.local.get(CAPTURE_KEY);
      const merged = [entry, ...(stored[CAPTURE_KEY] || [])].slice(0, MAX_CAPTURED);
      await chrome.storage.local.set({ [CAPTURE_KEY]: merged });
    } catch {}
  }

  injectNetworkBridge();

  // =====================================================
  // كشف نوع الصفحة
  // =====================================================
  function detectKindFromUrl() {
    const u = (location.pathname + location.search + location.hash).toLowerCase();
    if (u.includes("/wekalat") || u.includes("procurations-query") || u.includes("agency")) return "powers";
    if (u.includes("/iexecution") || u.includes("execution")) return "executions";
    if (u.includes("/appointment-requests") || u.includes("session")) return "sessions";
    if (u.includes("/lawsuit/requests")) return "documents";
    if (u.includes("/lawsuit") || u.includes("/cases")) return "cases";
    if (u.includes("/dashboard")) return "sessions";
    return null;
  }

  // =====================================================
  // أدوات تنسيق التاريخ — النظام يطلب YYYY-MM-DD
  // =====================================================
  function parseDateISO(s) {
    if (!s) return undefined;
    const str = String(s).trim();
    // 2024-01-15 or 2024/01/15
    let m = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    // 15-01-2024 or 15/01/2024
    m = str.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    // 15-01-1445 (Hijri) — convert approximately to Gregorian
    m = str.match(/(\d{1,2})[-\/](\d{1,2})[-\/](14\d{2})/);
    if (m) return hijriToGregorian(parseInt(m[3]), parseInt(m[2]), parseInt(m[1]));
    return undefined;
  }

  // تحويل تقريبي للهجري إلى الميلادي (دقة كافية للتواريخ القانونية)
  function hijriToGregorian(hy, hm, hd) {
    const jd = Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
    const l = jd + 68569;
    const n = Math.floor((4 * l) / 146097);
    const l2 = l - Math.floor((146097 * n + 3) / 4);
    const i = Math.floor((4000 * (l2 + 1)) / 1461001);
    const l3 = l2 - Math.floor((1461 * i) / 4) + 31;
    const j = Math.floor((80 * l3) / 2447);
    const d = l3 - Math.floor((2447 * j) / 80);
    const l4 = Math.floor(j / 11);
    const m = j + 2 - 12 * l4;
    const y = 100 * (n - 49) + i + l4;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function parseAmount(s) {
    if (!s) return undefined;
    const n = Number(String(s).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }

  // =====================================================
  // تمرير تلقائي سريع (lazy-load + virtual scroll) — مُحسَّن للسرعة
  // =====================================================
  async function autoScrollFull() {
    try {
      const vh = window.innerHeight;
      const step = Math.max(400, Math.floor(vh * 0.9));
      const DELAY = 160;          // كان 350ms
      const MAX_STEPS = 40;       // كان 80
      const STABLE_THRESHOLD = 2; // كان 4
      window.scrollTo({ top: 0, behavior: "instant" });
      await sleep(150);
      let lastHeight = -1, stable = 0;
      for (let i = 0; i < MAX_STEPS; i++) {
        const y = (i + 1) * step;
        window.scrollTo({ top: y, behavior: "instant" });
        await sleep(DELAY);
        const h = document.documentElement.scrollHeight;
        if (h > lastHeight + 50) { stable = 0; lastHeight = h; }
        else { stable++; if (stable >= STABLE_THRESHOLD) break; }
        if (y > h + vh) break;
      }
      await sleep(250);
      await tryLoadMore();
      // الرجوع للأعلى مباشرة بدون تمرير متدرج
      window.scrollTo({ top: 0, behavior: "instant" });
      await sleep(150);
    } catch (e) { console.warn("[adala] scroll failed", e); }
  }

  async function tryLoadMore() {
    const buttons = $all("button, a, [role='button']");
    for (const b of buttons) {
      const t = text(b);
      if (!t || t.length > 40) continue;
      if (/تحميل المزيد|عرض المزيد|المزيد|show more|load more|التالي|next/i.test(t)) {
        try { b.click(); await sleep(800); } catch {}
        break;
      }
    }
  }

  async function clickSubTab(labels) {
    const cands = $all("button, a, [role='tab'], .tab, .nav-link, li, mat-tab, [class*='tab']");
    for (const el of cands) {
      const t = text(el);
      if (!t || t.length > 40) continue;
      if (labels.some((k) => t.includes(k))) {
        try { el.click(); await sleep(800); return true; } catch {}
      }
    }
    return false;
  }

  // =====================================================
  // ماسحات الجداول المتخصصة (مأخوذة من v13 العاملة)
  // =====================================================

  // 1) جدول القضايا: مرن جداً لأي جدول يحتوي على رقم قضية + حقول مساعدة
  function scrapeLawsuitTable() {
    const out = [];
    const HEADERS = [
      { k: "case_number", re: /رقم\s*القضية|رقم\s*الدعوى|رقم\s*الملف/ },
      { k: "opened_at",   re: /تاريخ\s*القضية|تاريخ\s*الدعوى|تاريخ\s*القيد|تاريخ\s*الإيداع|تاريخ\s*الفتح/ },
      { k: "case_type",   re: /نوع\s*القضية|نوع\s*الدعوى|التصنيف/ },
      { k: "capacity",    re: /^الصفة$|الصفة/ },
      { k: "plaintiff",   re: /^المدعي|المدعي$|صاحب\s*الطلب|الخصوم/ },
      { k: "defendant",   re: /المدعى\s*عليه|المدعي\s*عليه|الخصم/ },
      { k: "status",      re: /^الحالة$|حالة\s*القضية|حالة\s*الملف/ },
      { k: "court",       re: /^المحكمة$|اسم\s*المحكمة|الدائرة/ },
      { k: "subject",     re: /الموضوع|موضوع\s*الدعوى/ },
    ];
    const matchKey = (t) => {
      const c = clean(t);
      if (/المدعى\s*عليه|المدعي\s*عليه/.test(c)) return "defendant";
      for (const h of HEADERS) if (h.k !== "defendant" && h.re.test(c)) return h.k;
      return null;
    };

    $all("table").forEach((table) => {
      const headers = $all("thead th, thead td", table).map(text);
      const altHeaders = headers.length ? headers : $all("tr:first-child th, tr:first-child td", table).map(text);
      // More relaxed: any header containing "قضية" OR "دعوى" OR "ملف"
      const ok = altHeaders.some((h) => /قضية|دعوى|ملف|رقم/i.test(h));
      if (!ok) return;
      const colKeys = altHeaders.map(matchKey);
      // If no case_number column detected, try to find case-number pattern in cells
      const hasCaseNumberCol = colKeys.includes("case_number");
      const rows = $all("tbody tr", table).length ? $all("tbody tr", table) : $all("tr", table);
      rows.forEach((row, i) => {
        if (i === 0 && $all("th", row).length && !$all("td", row).length) return;
        const cells = $all("td, th", row).map(text);
        if (cells.length < 2) return;
        const f = {};
        cells.forEach((v, j) => { const k = colKeys[j]; if (k && v) f[k] = v; });
        if (!f.case_number) {
          const found = cells.find((v) => /\d{4}\s*\/\s*\d{3,}|\d{9,}/.test(v));
          if (found) f.case_number = (found.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/) || [""])[0].replace(/\s/g, "");
        }
        if (!f.case_number) return;
        if (!f.title && f.subject) f.title = f.subject;
        out.push({ _kind: "case", fields: f, text: cells.join(" | ") });
      });
    });
    return out;
  }

  // 1.b) Aggressive fallback: any DOM block that visually looks like a case row
  function scrapeCasesAggressive() {
    const out = [];
    const seen = new Set();
    // Match standalone Najiz case-number patterns like "1234/2024" or "401014502104732" inside text blocks
    const sel = "div, li, article, section, [role='row'], [role='listitem'], tr, [class*='row'], [class*='item'], [class*='card']";
    $all(sel).forEach((el) => {
      if (el.children.length > 30) return; // skip huge containers
      const t = clean(el.innerText || "");
      if (!t || t.length < 10 || t.length > 600) return;
      if (!/قضية|دعوى|الموكل|المدعي|محكمة/.test(t)) return;
      const cnMatch = t.match(/\d{4}\s*\/\s*\d{3,}|\d{10,}/);
      if (!cnMatch) return;
      const cn = cnMatch[0].replace(/\s/g, "");
      if (seen.has(cn)) return;
      seen.add(cn);
      const f = { case_number: cn };
      // Try to grab type
      const typeMatch = t.match(/(?:نوع\s*(?:القضية|الدعوى)?\s*[:\-]?\s*)([^\n|،]{2,40})/);
      if (typeMatch) f.case_type = clean(typeMatch[1]);
      // status
      const statusMatch = t.match(/(?:الحالة\s*[:\-]?\s*)([^\n|،]{2,40})/);
      if (statusMatch) f.status = clean(statusMatch[1]);
      // court
      const courtMatch = t.match(/([^\n|،]{0,40}محكمة[^\n|،]{0,40})/);
      if (courtMatch) f.court = clean(courtMatch[0]);
      // date
      const dateMatch = t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}/);
      if (dateMatch) f.opened_at = dateMatch[0];
      // plaintiff
      const plaintiffMatch = t.match(/(?:المدعي|الموكل|صاحب\s*الطلب)\s*[:\-]?\s*([^\n|،]{2,60})/);
      if (plaintiffMatch) f.plaintiff = clean(plaintiffMatch[1]);
      out.push({ _kind: "case", fields: f, text: t.slice(0, 400) });
    });
    return out;
  }

  // 2) جدول الأحكام/الصكوك — مرن ليتعامل مع التغير في عناوين الأعمدة
  function scrapeJudgmentTable() {
    const out = [];
    const matchKey = (t) => {
      const c = clean(t);
      if (/المدعى\s*عليه|المدعي\s*عليه/.test(c)) return "defendant";
      // رقم الصك / رقم الحكم — صريح
      if (/رقم\s*الصك|رقم\s*الحكم|^الصك$|^رقم\s*صك$/.test(c)) return "deed_number";
      if (/نوع\s*الحكم|نوع\s*الصك|^نوع\s*صك$/.test(c)) return "judgment_type";
      if (/رقم\s*القضية|رقم\s*الدعوى/.test(c)) return "case_number";
      if (/نوع\s*القضية|نوع\s*الدعوى/.test(c)) return "case_type";
      if (/^المحكمة$|اسم\s*المحكمة|المحكمة|الدائرة/.test(c)) return "court";
      if (/^المدعي$|اسم\s*المدعي/.test(c)) return "plaintiff";
      // تاريخ الصك / تاريخ الحكم — صريح
      if (/تاريخ\s*الصك|تاريخ\s*الحكم|تاريخ\s*الإصدار|^تاريخ\s*صك$/.test(c)) return "filed_date";
      if (/^الحالة$|حالة\s*الحكم|حالة\s*الصك/.test(c)) return "status";
      return null;
    };
    $all("table").forEach((table) => {
      const headers = $all("thead th, thead td", table).map(text);
      const altHeaders = headers.length ? headers : $all("tr:first-child th, tr:first-child td", table).map(text);
      // مرن: أي عمود يحتوي حكم/صك/رقم الصك/تاريخ الصك
      const ok = altHeaders.some((h) => /حكم|صك|رقم\s*الصك|تاريخ\s*الصك|رقم\s*الحكم|تاريخ\s*الحكم/.test(h));
      if (!ok) return;
      const colKeys = altHeaders.map(matchKey);
      const rows = $all("tbody tr", table).length ? $all("tbody tr", table) : $all("tr", table);
      rows.forEach((row, i) => {
        if (i === 0 && $all("th", row).length && !$all("td", row).length) return;
        const cells = $all("td, th", row).map(text);
        if (cells.length < 2) return;
        const f = {};
        cells.forEach((v, j) => { const k = colKeys[j]; if (k && v) f[k] = v; });
        if (!f.deed_number && !f.case_number) {
          const found = cells.find((v) => /\d{4}\s*\/\s*\d{3,}|\d{9,}/.test(v));
          if (found) f.deed_number = (found.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/) || [""])[0].replace(/\s/g, "");
        }
        if (!f.deed_number && !f.case_number) return;
        out.push({ _kind: "judgment", fields: f, text: cells.join(" | ") });
      });
    });
    return out;
  }

  // 2.b) Aggressive judgment fallback — for non-table layouts (cards, divs)
  function scrapeJudgmentsAggressive() {
    const out = [];
    const seen = new Set();
    const sel = "div, li, article, section, [role='row'], [role='listitem'], tr, [class*='row'], [class*='item'], [class*='card'], [class*='judgment'], [class*='deed']";
    $all(sel).forEach((el) => {
      if (el.children.length > 30) return;
      const t = clean(el.innerText || "");
      if (!t || t.length < 10 || t.length > 700) return;
      // كلمات مفتاحية صريحة: حكم، صك، رقم الصك، تاريخ الصك، قرار، استئناف
      if (!/حكم|صك|رقم\s*الصك|تاريخ\s*الصك|قرار|استئناف/.test(t)) return;
      const idMatch = t.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/);
      if (!idMatch) return;
      const id = idMatch[0].replace(/\s/g, "");
      if (seen.has(id)) return;
      seen.add(id);
      const f = { deed_number: id };
      // محاولة استخراج رقم صك صريح
      const deedMatch = t.match(/(?:رقم\s*الصك|رقم\s*الحكم)\s*[:\-]?\s*(\d{4,})/);
      if (deedMatch) f.deed_number = deedMatch[1];
      // محاولة استخراج تاريخ الصك صريح
      const deedDateMatch = t.match(/(?:تاريخ\s*الصك|تاريخ\s*الحكم|تاريخ\s*الإصدار)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
      if (deedDateMatch) {
        f.filed_date = deedDateMatch[1];
      } else {
        const dateMatch = t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}/);
        if (dateMatch) f.filed_date = dateMatch[0];
      }
      const courtMatch = t.match(/([^\n|،]{0,40}محكمة[^\n|،]{0,40})/);
      if (courtMatch) f.court = clean(courtMatch[0]);
      const typeMatch = t.match(/(?:نوع\s*(?:الحكم|الصك)?\s*[:\-]?\s*)([^\n|،]{2,40})/);
      if (typeMatch) f.judgment_type = clean(typeMatch[1]);
      out.push({ _kind: "judgment", fields: f, text: t.slice(0, 400) });
    });
    return out;
  }

  // 2.c) Lawsuit requests scraper — /applications/lawsuit/requests
  // عمود تقريبي: رقم الطلب | نوع الطلب | تاريخ الطلب | حالة الطلب | رقم القضية | المحكمة
  function scrapeLawsuitRequestsTable() {
    const out = [];
    const matchKey = (t) => {
      const c = clean(t);
      if (/رقم\s*الطلب/.test(c)) return "request_number";
      if (/نوع\s*الطلب/.test(c)) return "request_type";
      if (/تاريخ\s*الطلب|تاريخ\s*تقديم/.test(c)) return "filed_date";
      if (/حالة\s*الطلب|^الحالة$/.test(c)) return "status";
      if (/رقم\s*القضية|رقم\s*الدعوى/.test(c)) return "case_number";
      if (/اسم\s*المحكمة|^المحكمة$|المحكمة/.test(c)) return "court";
      return null;
    };
    $all("table").forEach((table) => {
      const headers = $all("thead th, thead td", table).map(text);
      const altHeaders = headers.length ? headers : $all("tr:first-child th, tr:first-child td", table).map(text);
      const ok = altHeaders.some((h) => /رقم\s*الطلب/.test(h)) &&
                 altHeaders.some((h) => /نوع\s*الطلب|تاريخ\s*الطلب|حالة\s*الطلب/.test(h));
      if (!ok) return;
      const colKeys = altHeaders.map(matchKey);
      const rows = $all("tbody tr", table).length ? $all("tbody tr", table) : $all("tr", table);
      rows.forEach((row, i) => {
        if (i === 0 && $all("th", row).length && !$all("td", row).length) return;
        const cells = $all("td, th", row).map(text);
        if (cells.length < 2) return;
        const f = {};
        cells.forEach((v, j) => { const k = colKeys[j]; if (k && v) f[k] = v; });
        if (!f.request_number) {
          const found = cells.find((v) => /\d{6,}/.test(v));
          if (found) f.request_number = (found.match(/\d{6,}/) || [""])[0];
        }
        if (!f.request_number) return;
        out.push({ _kind: "lawsuit_request", fields: f, text: cells.join(" | ") });
      });
    });
    return out;
  }

  // 2.d) Aggressive lawsuit requests fallback
  function scrapeLawsuitRequestsAggressive() {
    const out = [];
    const seen = new Set();
    const sel = "div, li, article, section, [role='row'], [role='listitem'], tr, [class*='row'], [class*='item'], [class*='card'], [class*='request']";
    $all(sel).forEach((el) => {
      if (el.children.length > 30) return;
      const t = clean(el.innerText || "");
      if (!t || t.length < 10 || t.length > 700) return;
      if (!/طلب|الطلبات/.test(t)) return;
      const idMatch = t.match(/\d{6,}/);
      if (!idMatch) return;
      const id = idMatch[0];
      if (seen.has(id)) return;
      seen.add(id);
      const f = { request_number: id };
      const typeMatch = t.match(/(?:نوع\s*الطلب\s*[:\-]?\s*)([^\n|،]{2,40})/);
      if (typeMatch) f.request_type = clean(typeMatch[1]);
      const dateMatch = t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}/);
      if (dateMatch) f.filed_date = dateMatch[0];
      const caseMatch = t.match(/(?:رقم\s*القضية|رقم\s*الدعوى)\s*[:\-]?\s*(\d{4}\s*\/\s*\d{3,}|\d{9,})/);
      if (caseMatch) f.case_number = caseMatch[1].replace(/\s/g, "");
      const statusMatch = t.match(/(?:^|\s)(مقبول|مرفوض|قيد\s*الدراسة|قيد\s*المراجعة|منجز|مكتمل|قيد\s*النظر)(?:\s|$)/);
      if (statusMatch) f.status = statusMatch[1];
      out.push({ _kind: "lawsuit_request", fields: f, text: t.slice(0, 400) });
    });
    return out;
  }

  // 3) جدول طلبات التنفيذ: رقم الطلب | نوع الطلب | نوع السند | تاريخ تقديم الطلب | اسم المنفذ ضده | المحكمة | الحالة
  function scrapeExecutionTable() {
    const out = [];
    const matchKey = (t) => {
      const c = clean(t);
      if (/نوع\s*السند/.test(c)) return "deed_type";
      if (/نوع\s*الطلب/.test(c)) return "request_type";
      if (/رقم\s*الطلب/.test(c)) return "execution_number";
      if (/تاريخ\s*تقديم\s*الطلب|تاريخ\s*الطلب/.test(c)) return "filed_date";
      if (/المنفذ\s*ضده|المنفذ\s*عليه/.test(c)) return "debtor_name";
      if (/اسم\s*المحكمة|^المحكمة$|المحكمة/.test(c)) return "court";
      if (/حالة\s*الطلب|^الحالة$|الحالة/.test(c)) return "status";
      if (/مبلغ|قيمة/.test(c)) return "amount";
      return null;
    };
    $all("table").forEach((table) => {
      const headers = $all("thead th, thead td", table).map(text);
      const altHeaders = headers.length ? headers : $all("tr:first-child th, tr:first-child td", table).map(text);
      const ok = altHeaders.some((h) => /رقم\s*الطلب/.test(h)) &&
                 altHeaders.some((h) => /نوع\s*السند|المنفذ\s*ضده|حالة\s*الطلب/.test(h));
      if (!ok) return;
      const colKeys = altHeaders.map(matchKey);
      const rows = $all("tbody tr", table).length ? $all("tbody tr", table) : $all("tr", table);
      rows.forEach((row, i) => {
        if (i === 0 && $all("th", row).length && !$all("td", row).length) return;
        const cells = $all("td, th", row).map(text);
        if (cells.length < 3) return;
        const f = {};
        cells.forEach((v, j) => { const k = colKeys[j]; if (k && v) f[k] = v; });
        if (!f.execution_number) {
          const found = cells.find((v) => /\d{9,}/.test(v));
          if (found) f.execution_number = (found.match(/\d{9,}/) || [""])[0];
        }
        if (!f.execution_number) return;
        out.push({ _kind: "execution", fields: f, text: cells.join(" | ") });
      });
    });
    return out;
  }

  // 4) جدول الوكالات: رقم الوكالة | تاريخ الإصدار | تاريخ الانتهاء | اسم الوكيل | الحالة
  // 4) جدول الوكالات: مرن ليتعامل مع الجدول + البطاقات (الـ Najiz يستخدم layouts مختلفة)
  function scrapeAgencyTable() {
    const out = [];
    const matchKey = (t) => {
      const c = clean(t);
      if (/رقم\s*الوكالة|^الرقم$|رقم\s*الصك/.test(c)) return "wakalah_number";
      if (/تاريخ\s*إصدار|تاريخ\s*الإصدار|تاريخ\s*الاصدار|تاريخ\s*التحرير/.test(c)) return "issue_date";
      if (/تاريخ\s*انتهاء|تاريخ\s*الانتهاء|تاريخ\s*الإنتهاء|تاريخ\s*الصلاحية/.test(c)) return "expiry_date";
      if (/اسم\s*الوكيل|^الوكيل$|الوكيل/.test(c)) return "agent_name";
      if (/اسم\s*الموكل|^الموكل$|الموكل|المُوكِّل|الأصيل/.test(c)) return "issuer_name";
      if (/حالة\s*الوكالة|^الحالة$|حالة\s*الصك/.test(c)) return "status";
      if (/نطاق|نوع\s*الوكالة|الموضوع|نوع\s*الصك/.test(c)) return "scope";
      return null;
    };
    $all("table").forEach((table) => {
      const headers = $all("thead th, thead td", table).map(text);
      const altHeaders = headers.length ? headers : $all("tr:first-child th, tr:first-child td", table).map(text);
      const ok = altHeaders.some((h) => /وكال|موكل|وكيل/.test(h));
      if (!ok) return;
      const colKeys = altHeaders.map(matchKey);
      const rows = $all("tbody tr", table).length ? $all("tbody tr", table) : $all("tr", table);
      rows.forEach((row, i) => {
        if (i === 0 && $all("th", row).length && !$all("td", row).length) return;
        const cells = $all("td, th", row).map(text);
        if (cells.length < 2) return;
        const f = {};
        cells.forEach((v, j) => { const k = colKeys[j]; if (k && v) f[k] = v; });
        if (!f.wakalah_number) {
          const found = cells.find((v) => /\d{5,}/.test(v));
          if (found) f.wakalah_number = (found.match(/\d{5,}/) || [""])[0];
        }
        if (!f.wakalah_number) {
          const alphaNum = cells.find((v) => /^[A-Za-z0-9\-]{4,}$/.test(v.replace(/\s/g, "")));
          if (alphaNum) f.wakalah_number = alphaNum.replace(/\s/g, "");
        }
        if (!f.wakalah_number) return;
        out.push({ _kind: "power", fields: f, text: cells.join(" | ") });
      });
    });
    return out;
  }

  // 4.b) Aggressive agency fallback — يلتقط كل وكالة من بطاقات/divs/grids
  function scrapeAgenciesAggressive() {
    const out = [];
    const seen = new Map(); // wakalah_number → richest fields
    const sel = "div, li, article, section, [role='row'], [role='listitem'], tr, [class*='row'], [class*='item'], [class*='card'], [class*='agency'], [class*='wakala'], [class*='procuration']";
    $all(sel).forEach((el) => {
      if (el.children.length > 40) return;
      const t = clean(el.innerText || "");
      if (!t || t.length < 8 || t.length > 900) return;
      // Must look like an agency block
      if (!/وكال|موكل|وكيل/.test(t)) return;
      // Find ALL wakalah numbers in this block (some blocks have multiple — pagination scenarios)
      const allMatches = [...t.matchAll(/\d{5,}/g)].map((m) => m[0]);
      if (!allMatches.length) return;

      for (const wn of allMatches) {
        // Skip if this number is clearly NOT a wakalah (e.g., a phone or ID)
        if (wn.length > 15) continue;
        const existing = seen.get(wn) || { wakalah_number: wn };
        // Enrich
        const issMatch = t.match(/(?:الموكل|اسم\s*الموكل|الأصيل)\s*[:\-]?\s*([^\n|،]{2,60})/);
        if (issMatch && !existing.issuer_name) existing.issuer_name = clean(issMatch[1]);
        const agMatch = t.match(/(?:الوكيل|اسم\s*الوكيل)\s*[:\-]?\s*([^\n|،]{2,60})/);
        if (agMatch && !existing.agent_name) existing.agent_name = clean(agMatch[1]);
        const issueDate = t.match(/(?:تاريخ\s*(?:الإصدار|الاصدار|التحرير))\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
        if (issueDate && !existing.issue_date) existing.issue_date = issueDate[1];
        const expiryDate = t.match(/(?:تاريخ\s*(?:الانتهاء|الإنتهاء|الصلاحية))\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
        if (expiryDate && !existing.expiry_date) existing.expiry_date = expiryDate[1];
        const statusMatch = t.match(/(?:^|\s)(سارية|منتهية|ملغاة|نافذة|موقوفة|معتمدة|قيد\s*المراجعة)(?:\s|$)/);
        if (statusMatch && !existing.status) existing.status = statusMatch[1];
        seen.set(wn, existing);
      }
    });
    // Also independently scan for standalone agency-number patterns inside the entire page
    // (catches numbers shown in expandable rows or sub-content)
    const pageText = clean(document.body.innerText || "");
    if (/وكال|موكل|وكيل/.test(pageText)) {
      // Look for "رقم الوكالة" labels followed by numbers
      const labelMatches = pageText.matchAll(/(?:رقم\s*الوكالة)\s*[:\-]?\s*(\d{5,15})/g);
      for (const m of labelMatches) {
        if (!seen.has(m[1])) seen.set(m[1], { wakalah_number: m[1] });
      }
    }
    for (const [wn, fields] of seen) {
      out.push({ _kind: "power", fields, text: `wakalah ${wn}` });
    }
    return out;
  }

  // 5) جدول الجلسات والمواعيد — أكثر مرونة
  function scrapeSessionsTable() {
    const out = [];
    const matchKey = (t) => {
      const c = clean(t);
      if (/رقم\s*القضية|رقم\s*الدعوى|^القضية$|^الدعوى$/.test(c)) return "case_number";
      if (/تاريخ\s*الجلسة|^الموعد$|الموعد\s*|^التاريخ$|تاريخ\s*الموعد/.test(c)) return "session_date";
      if (/^وقت$|الساعة|^الوقت$|توقيت/.test(c)) return "time";
      if (/اسم\s*المحكمة|^المحكمة$|^محكمة$/.test(c)) return "court";
      if (/قاعة|^الدائرة$|الدائرة\s*القضائية/.test(c)) return "room";
      if (/^الحالة$|حالة\s*الجلسة|حالة\s*الموعد/.test(c)) return "status";
      if (/^النوع$|نوع\s*الجلسة/.test(c)) return "type";
      return null;
    };
    $all("table").forEach((table) => {
      const headers = $all("thead th, thead td", table).map(text);
      const altHeaders = headers.length ? headers : $all("tr:first-child th, tr:first-child td", table).map(text);
      // Relaxed: any header has "جلسة" OR "موعد" OR "تاريخ" OR "قاعة"
      const ok = altHeaders.some((h) => /جلسة|موعد|تاريخ|قاعة|الدائرة/.test(h));
      if (!ok) return;
      const colKeys = altHeaders.map(matchKey);
      const rows = $all("tbody tr", table).length ? $all("tbody tr", table) : $all("tr", table);
      rows.forEach((row, i) => {
        if (i === 0 && $all("th", row).length && !$all("td", row).length) return;
        const cells = $all("td, th", row).map(text);
        if (cells.length < 2) return;
        const f = {};
        cells.forEach((v, j) => { const k = colKeys[j]; if (k && v) f[k] = v; });
        const date = parseDateISO(f.session_date) || parseDateISO(cells.join(" "));
        if (!date) return;
        f.session_date = date;
        if (!f.case_number) {
          const found = cells.find((v) => /\d{4}\s*\/\s*\d{3,}|\d{9,}/.test(v));
          if (found) f.case_number = (found.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/) || [""])[0].replace(/\s/g, "");
        }
        out.push({ _kind: "session", fields: f, text: cells.join(" | ") });
      });
    });
    return out;
  }

  // 5.b) Aggressive sessions fallback — any block containing date + case/hearing context
  function scrapeSessionsAggressive() {
    const out = [];
    const seen = new Set();
    const sel = "div, li, article, section, [role='row'], [role='listitem'], tr, [class*='row'], [class*='item'], [class*='card'], [class*='session'], [class*='hearing'], [class*='appointment']";
    $all(sel).forEach((el) => {
      if (el.children.length > 30) return;
      const t = clean(el.innerText || "");
      if (!t || t.length < 8 || t.length > 600) return;
      const dm = t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}/);
      if (!dm) return;
      // Must mention hearing/session/court/calendar
      if (!/جلسة|موعد|محكمة|قضية|دعوى|قاعة|الدائرة|التقويم/.test(t)) return;
      const date = parseDateISO(dm[0]);
      if (!date) return;
      const cn = (t.match(/\d{4}\s*\/\s*\d{3,}|\d{10,}/) || [""])[0].replace(/\s/g, "");
      const key = `${date}|${cn || t.slice(0, 30)}`;
      if (seen.has(key)) return;
      seen.add(key);
      const courtMatch = t.match(/([^\n|،]{0,40}محكمة[^\n|،]{0,40})/);
      const roomMatch = t.match(/(?:قاعة|قاعه)\s*(?:رقم)?\s*([\d\u0660-\u0669]+|[^\n|،]{1,20})/);
      out.push({
        _kind: "session",
        fields: {
          session_date: date,
          case_number: cn,
          court: courtMatch ? clean(courtMatch[0]) : undefined,
          room: roomMatch ? clean(roomMatch[1]) : undefined,
          status: "قادمة",
        },
        text: t.slice(0, 400),
      });
    });
    return out;
  }

  // =====================================================
  // سحب التقويم العدلي من لوحة المعلومات (dashboard) — مرن ليجد كل المواعيد
  // =====================================================
  function scrapeDashboardCalendar() {
    const out = [];
    const seen = new Set();
    // Step 1: find calendar container by various means (text content, class names, location)
    const containerCandidates = [];

    // Strategy A: containers with explicit calendar text
    $all("div, section, article, aside, [class*='card' i], [class*='calendar' i], [class*='appointment' i], [class*='widget' i], [class*='schedule' i]").forEach((container) => {
      const txt = clean(container.innerText || "");
      if (!txt || txt.length > 6000) return;
      if (/التقويم\s*العدلي|المواعيد\s*(?:المستقبلية|القادمة|القريبة)|مواعيد\s*الجلسات|أقرب\s*المواعيد/.test(txt)) {
        containerCandidates.push(container);
      }
    });

    // Strategy B: any column/sidebar with multiple date entries
    $all("div, section, aside, ul, [class*='col-'], [class*='sidebar' i]").forEach((container) => {
      if (containerCandidates.includes(container)) return;
      const txt = clean(container.innerText || "");
      if (!txt || txt.length < 30 || txt.length > 6000) return;
      const dateCount = (txt.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}/g) || []).length;
      if (dateCount >= 1 && /جلسة|موعد|قضية|دعوى|محكمة|قاعة|الدائرة/.test(txt)) {
        containerCandidates.push(container);
      }
    });

    // Step 2: extract appointments from each candidate
    containerCandidates.forEach((container) => {
      // Sub-rows
      const rows = container.querySelectorAll(
        "[class*='item' i], [class*='row' i], [class*='event' i], [class*='appointment' i], [class*='session' i], [class*='entry' i], li, tr, [role='listitem'], [class*='card' i]"
      );
      const cands = rows.length ? Array.from(rows) : [container];

      cands.forEach((row) => {
        if (row.children.length > 30) return;
        const t = clean(row.innerText || "");
        if (t.length < 6 || t.length > 800) return;
        const dm = t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}/);
        if (!dm) return;
        const date = parseDateISO(dm[0]);
        if (!date) return;
        // Must look like an appointment (not arbitrary text with a date)
        if (!/جلسة|موعد|قضية|دعوى|محكمة|قاعة|الدائرة|التنفيذ/.test(t)) return;
        const cn = (t.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/) || [""])[0].replace(/\s/g, "");
        const key = `${date}-${cn || t.slice(0, 30)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const courtMatch = t.match(/([^\n|،]{0,40}(?:محكمة|دائرة)[^\n|،]{0,40})/);
        const roomMatch = t.match(/(?:قاعة|قاعه|الدائرة)\s*(?:رقم)?\s*([\d\u0660-\u0669A-Za-z]+)/);
        const timeMatch = t.match(/(\d{1,2}:\d{2}(?:\s*[صم])?)/);
        out.push({
          _kind: "session",
          fields: {
            session_date: date,
            case_number: cn,
            court: courtMatch ? clean(courtMatch[0]) : undefined,
            room: roomMatch ? clean(roomMatch[1]) : undefined,
            time: timeMatch ? timeMatch[1] : undefined,
            status: "قادمة",
          },
          text: t.slice(0, 400),
        });
      });
    });

    // Step 3: as a final safety net, scan the WHOLE page for "موعد الجلسة" / "تاريخ الجلسة" patterns
    const pageText = clean(document.body.innerText || "");
    if (/التقويم\s*العدلي|مواعيد\s*الجلسات/.test(pageText)) {
      // Look for patterns: "DD/MM/YYYY ... رقم القضية: ..."
      const lines = pageText.split(/[\n\r]+/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.length > 200) continue;
        const dm = line.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}/);
        if (!dm) continue;
        const date = parseDateISO(dm[0]);
        if (!date) continue;
        // Look at neighboring lines for context (case number, court)
        const context = [lines[i - 1], lines[i], lines[i + 1], lines[i + 2]].filter(Boolean).join(" | ");
        if (!/جلسة|موعد|قضية|دعوى|محكمة/.test(context)) continue;
        const cnMatch = context.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/);
        const cn = cnMatch ? cnMatch[0].replace(/\s/g, "") : "";
        const key = `${date}-${cn || line.slice(0, 30)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const courtMatch = context.match(/([^\n|،]{0,30}محكمة[^\n|،]{0,30})/);
        out.push({
          _kind: "session",
          fields: {
            session_date: date,
            case_number: cn,
            court: courtMatch ? clean(courtMatch[0]) : undefined,
            status: "قادمة",
          },
          text: context.slice(0, 300),
        });
      }
    }
    return out;
  }

  // =====================================================
  // سحب البطاقات (fallback)
  // =====================================================
  function collectCards(keywords) {
    const out = [];
    const seen = new Set();
    const sel = "[class*='card'], [class*='Card'], [class*='item'], [class*='Item'], [class*='box'], li, [class*='panel'], [class*='tile']";
    for (const el of $all(sel)) {
      const t = clean(el.innerText || "");
      if (!t || t.length < 8 || t.length > 1200) continue;
      const hits = keywords.filter((k) => t.includes(k)).length;
      if (hits < 2) continue;
      if (Array.from(seen).some((s) => s.contains(el) || el.contains(s))) continue;
      seen.add(el);
      out.push(el);
    }
    return out;
  }

  function fieldFromContainer(container, labels) {
    const nodes = $all("*", container);
    for (const n of nodes) {
      const t = clean(n.textContent);
      if (!t || t.length > 120) continue;
      for (const lbl of labels) {
        if (t === lbl || t === lbl + ":" || t.startsWith(lbl + " ") || t.startsWith(lbl + ":") || t.startsWith(lbl + " :")) {
          const after = t.slice(lbl.length).replace(/^[:\s\-–]+/, "").trim();
          if (after) return after;
          const sib = n.nextElementSibling;
          if (sib) { const sv = clean(sib.textContent); if (sv) return sv; }
          const last = n.lastElementChild;
          if (last) { const lv = clean(last.textContent); if (lv && lv !== t) return lv; }
        }
      }
    }
    return "";
  }

  // =====================================================
  // محوّلات إلى صيغة API النظام
  // =====================================================
  function makeNajizId(prefix, value) {
    const v = (value || "").toString().replace(/\s/g, "");
    return v ? `${prefix}_${v}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function toCasePayload(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const f = it.fields || {};
      const cn = (f.case_number || "").toString().replace(/\s/g, "");
      if (!cn) continue;
      const id = makeNajizId("case", cn);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        najiz_id: id.slice(0, 120),
        case_number: cn.slice(0, 200),
        title: (f.title || f.subject || f.plaintiff || cn).toString().slice(0, 500),
        court: (f.court || "").slice(0, 200) || undefined,
        case_type: (f.case_type || "").slice(0, 200) || undefined,
        status: (f.status || "").slice(0, 200) || undefined,
        opened_at: parseDateISO(f.opened_at),
        client_name: (f.plaintiff || f.client_name || "").slice(0, 200) || undefined,
      });
    }
    return out;
  }

  function toPowerPayload(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const f = it.fields || {};
      const wn = (f.wakalah_number || "").toString().replace(/\s/g, "");
      if (!wn) continue;
      const id = makeNajizId("power", wn);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        najiz_id: id.slice(0, 120),
        wakalah_number: wn.slice(0, 200),
        issuer_name: (f.issuer_name || "").slice(0, 200) || undefined,
        agent_name: (f.agent_name || "").slice(0, 200) || undefined,
        issue_date: parseDateISO(f.issue_date),
        expiry_date: parseDateISO(f.expiry_date),
        scope: (f.scope || "").slice(0, 500) || undefined,
      });
    }
    return out;
  }

  function toExecutionPayload(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const f = it.fields || {};
      const en = (f.execution_number || "").toString().replace(/\s/g, "");
      if (!en) continue;
      const id = makeNajizId("exec", en);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        najiz_id: id.slice(0, 120),
        execution_number: en.slice(0, 200),
        court: (f.court || "").slice(0, 200) || undefined,
        amount: parseAmount(f.amount),
        debtor_name: (f.debtor_name || "").slice(0, 200) || undefined,
        status: (f.status || "").slice(0, 200) || undefined,
        filed_date: parseDateISO(f.filed_date),
      });
    }
    return out;
  }

  function toSessionPayload(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const f = it.fields || {};
      const date = parseDateISO(f.session_date);
      if (!date) continue;
      const cn = (f.case_number || "").toString().replace(/\s/g, "") || `unknown_${Date.now()}`;
      const id = makeNajizId("case", cn);
      const key = `${id}|${date}|${f.court || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        najiz_case_id: id.slice(0, 120),
        session_date: date,
        court: (f.court || "").slice(0, 200) || undefined,
        room: (f.room || "").slice(0, 200) || undefined,
        status: (f.status || "").slice(0, 200) || undefined,
      });
    }
    return out;
  }

  function toDocumentPayload(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const f = it.fields || {};
      const dn = (f.deed_number || f.case_number || "").toString().replace(/\s/g, "");
      if (!dn) continue;
      const id = makeNajizId("doc", dn);
      if (seen.has(id)) continue;
      seen.add(id);
      const title = (f.judgment_type || f.title || `صك ${dn}`).toString().slice(0, 200);
      out.push({
        najiz_id: id.slice(0, 120),
        title,
        case_number: (f.case_number || "").toString().replace(/\s/g, "").slice(0, 200) || undefined,
        court: (f.court || "").slice(0, 200) || undefined,
        status: (f.status || "").slice(0, 200) || undefined,
        filed_date: parseDateISO(f.filed_date),
        source_url: location.href.slice(0, 1000),
      });
    }
    return out;
  }

  // =====================================================
  // Deep-dive helpers — يجدون روابط التفاصيل ويستخلصون البيانات الغنية من صفحة التفاصيل
  // =====================================================

  // Find detail-page links on the current list page, based on the kind hint
  function findDetailLinks(kindHint) {
    const links = [];
    const seen = new Set();
    // Strategy 1: <a href> with path containing kind-specific keywords
    const kindPatterns = {
      cases: /lawsuit\/(view|details|case)|cases?\/\d+|lawsuit\/\d+/i,
      executions: /iexecution\/(view|details|request)|execution\/\d+/i,
      powers: /wekalat\/(view|details|procuration)|agency\/\d+|procuration\/\d+/i,
    };
    const pattern = kindPatterns[kindHint] || /\/(view|details|show|info)\//i;

    $all("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!href || href === "#" || href.startsWith("javascript:")) return;
      if (!pattern.test(href)) return;
      // Resolve to absolute
      const abs = href.startsWith("http") ? href : new URL(href, location.origin).toString();
      if (seen.has(abs)) return;
      seen.add(abs);
      // Try to capture an identifier (case_number or row text) for matching back later
      const row = a.closest("tr, [role='row'], [class*='row'], li, [class*='item']");
      const rowText = row ? clean(row.innerText || "") : clean(a.innerText || "");
      const idMatch = rowText.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/);
      links.push({ url: abs, identifier: idMatch ? idMatch[0].replace(/\s/g, "") : null, rowText: rowText.slice(0, 200) });
    });

    // Strategy 2: buttons with onclick / data-* that navigate (look for trigger elements)
    if (links.length === 0) {
      $all("button, [role='button'], [class*='action']").forEach((b) => {
        const t = clean(b.innerText || "");
        if (/(عرض|التفاصيل|التفصيل|تفاصيل|details|view)/i.test(t)) {
          // We can't extract URL from onclick, but we can flag the row
          const row = b.closest("tr, [role='row'], [class*='row'], li, [class*='item']");
          if (row) {
            const rowText = clean(row.innerText || "");
            const idMatch = rowText.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/);
            // Use placeholder url — the bot will click instead of navigate
            links.push({ url: "__CLICK__", clickTarget: true, identifier: idMatch ? idMatch[0].replace(/\s/g, "") : null, rowText: rowText.slice(0, 200) });
          }
        }
      });
    }
    return links;
  }

  // Extract rich detail-page key-value pairs (generic, works for case/execution/agency detail pages)
  function scrapeDetailPage() {
    const fields = {};

    // Strategy A: <dt>/<dd> pairs
    $all("dt").forEach((dt) => {
      const label = clean(dt.textContent);
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") {
        const value = clean(dd.textContent);
        if (label && value) fields[label] = value;
      }
    });

    // Strategy B: label-value side-by-side via "field" containers (Najiz uses Angular components)
    $all("[class*='field'], [class*='form-row'], [class*='detail'], [class*='info-row'], [class*='label-value']").forEach((row) => {
      if (row.children.length < 2 || row.children.length > 6) return;
      const t = clean(row.innerText || "");
      if (t.length > 300) return;
      // Look for pattern "label : value" or "label\nvalue"
      const labelEl = row.querySelector("[class*='label'], label, .lbl, dt, .title, .key, strong, b");
      const valueEl = row.querySelector("[class*='value'], [class*='val'], dd, .data, .content");
      if (labelEl && valueEl) {
        const label = clean(labelEl.textContent);
        const value = clean(valueEl.textContent);
        if (label && value && label !== value) fields[label] = value;
      } else {
        // Heuristic split by ":" or "::" or first child as label
        const parts = t.split(/[:：]\s*/);
        if (parts.length === 2 && parts[0].length < 60 && parts[1].length < 300) {
          fields[clean(parts[0])] = clean(parts[1]);
        }
      }
    });

    // Strategy C: tables on detail pages (often have inline data)
    $all("table").forEach((tbl) => {
      $all("tr", tbl).forEach((tr) => {
        const cells = $all("td, th", tr).map(text);
        if (cells.length === 2 && cells[0].length < 60 && cells[1] && cells[0] !== cells[1]) {
          fields[cells[0]] = cells[1];
        }
      });
    });

    // Strategy D: card grids ("col-md-3" pattern with label above value)
    $all("[class*='col-'], [class*='grid-item'], [class*='item-cell']").forEach((col) => {
      if (col.children.length !== 2) return;
      const [label, val] = Array.from(col.children).map((c) => clean(c.textContent));
      if (label && val && label !== val && label.length < 60 && val.length < 200) {
        if (!/[a-z0-9]{20,}/i.test(label)) fields[label] = val;
      }
    });

    return fields;
  }

  // Map raw detail fields (Arabic labels) to schema keys per kind
  function detailToSchema(kind, raw) {
    const get = (...keys) => {
      for (const k of keys) {
        for (const rk of Object.keys(raw)) {
          if (rk.includes(k)) return raw[rk];
        }
      }
      return undefined;
    };
    if (kind === "cases") {
      return {
        case_number: get("رقم القضية", "رقم الدعوى"),
        title: get("الموضوع", "موضوع الدعوى", "وصف القضية"),
        court: get("اسم المحكمة", "المحكمة", "الدائرة"),
        case_type: get("نوع القضية", "نوع الدعوى", "التصنيف"),
        status: get("حالة القضية", "الحالة"),
        opened_at: get("تاريخ القضية", "تاريخ القيد", "تاريخ الإيداع"),
        client_name: get("المدعي", "اسم المدعي", "الموكل", "العميل"),
        description: get("ملخص", "تفاصيل", "الوصف"),
      };
    }
    if (kind === "executions") {
      return {
        execution_number: get("رقم الطلب", "رقم التنفيذ"),
        court: get("اسم المحكمة", "المحكمة"),
        amount: get("مبلغ", "قيمة المطالبة", "المبلغ"),
        debtor_name: get("المنفذ ضده", "المدين", "اسم المدعى عليه"),
        status: get("حالة الطلب", "الحالة"),
        filed_date: get("تاريخ تقديم الطلب", "تاريخ الطلب", "تاريخ الإيداع"),
      };
    }
    if (kind === "powers") {
      return {
        wakalah_number: get("رقم الوكالة", "رقم الصك"),
        issuer_name: get("اسم الموكل", "الموكل", "الأصيل"),
        agent_name: get("اسم الوكيل", "الوكيل"),
        issue_date: get("تاريخ الإصدار", "تاريخ التحرير", "تاريخ الاصدار"),
        expiry_date: get("تاريخ الانتهاء", "تاريخ الإنتهاء", "تاريخ الصلاحية"),
        scope: get("نطاق الوكالة", "نوع الوكالة", "موضوع الوكالة", "الموضوع"),
        status: get("حالة الوكالة", "الحالة"),
      };
    }
    return raw;
  }

  // =====================================================
  // API الرئيسي — sccrape() يُرجع payload بصيغة /api/public/najiz-sync
  // =====================================================
  window.__ADALA_NAJIZ__ = {
    detectKindFromUrl,
    autoScrollFull,
    clickSubTab,
    findDetailLinks,
    scrapeDetailPage,
    detailToSchema,

    async scrape(kindFilter) {
      console.log("[منصة العدالة] بدء السحب — kindFilter:", kindFilter, "URL:", location.href);
      await autoScrollFull();
      await sleep(200);

      // اجمع من كل الماسحات المتخصصة (Hybrid)
      const allCases = scrapeLawsuitTable();
      const allPowers = scrapeAgencyTable();
      const allExecs = scrapeExecutionTable();
      const allSessions = [...scrapeSessionsTable(), ...scrapeDashboardCalendar()];
      const allJudgments = scrapeJudgmentTable();
      const allRequests = scrapeLawsuitRequestsTable();

      const urlKind = detectKindFromUrl();
      const focus = kindFilter || urlKind;

      // Aggressive fallback for cases — works on any layout (cards, virtual scroll, custom grid)
      if ((focus === "cases" || !focus) && allCases.length === 0) {
        const aggressive = scrapeCasesAggressive();
        console.log("[منصة العدالة] aggressive cases fallback found:", aggressive.length);
        allCases.push(...aggressive);
      }

      // ALWAYS run aggressive for sessions on dashboard/appointment pages
      if (focus === "sessions" || !focus) {
        const aggressive = scrapeSessionsAggressive();
        const existingKeys = new Set(allSessions.map((s) => `${s.fields?.session_date}|${s.fields?.case_number || ""}`));
        const additions = aggressive.filter((s) => !existingKeys.has(`${s.fields?.session_date}|${s.fields?.case_number || ""}`));
        if (additions.length) {
          console.log("[منصة العدالة] aggressive sessions added:", additions.length);
          allSessions.push(...additions);
        }
      }

      // ALWAYS run aggressive for agencies — catches rows the table scraper missed (cards/grids/lazy-loaded)
      if (focus === "powers" || !focus) {
        const aggressive = scrapeAgenciesAggressive();
        const existingNumbers = new Set(allPowers.map((p) => p.fields?.wakalah_number));
        const additions = aggressive.filter((p) => !existingNumbers.has(p.fields?.wakalah_number));
        if (additions.length) {
          console.log("[منصة العدالة] aggressive agencies added:", additions.length);
          allPowers.push(...additions);
        }
      }

      // ALWAYS run aggressive for judgments — catches all on judgments page + cards layouts
      if (focus === "cases" || focus === "documents" || !focus) {
        const aggressive = scrapeJudgmentsAggressive();
        const existingDeeds = new Set(allJudgments.map((j) => j.fields?.deed_number).filter(Boolean));
        const additions = aggressive.filter((j) => !existingDeeds.has(j.fields?.deed_number));
        if (additions.length) {
          console.log("[منصة العدالة] aggressive judgments added:", additions.length);
          allJudgments.push(...additions);
        }
      }

      // Aggressive fallback for lawsuit requests
      if (focus === "documents" || !focus) {
        if (allRequests.length === 0) {
          const aggressive = scrapeLawsuitRequestsAggressive();
          console.log("[منصة العدالة] aggressive requests fallback found:", aggressive.length);
          allRequests.push(...aggressive);
        }
      }

      // Merge requests into judgments stream (both go to documents in the system)
      allJudgments.push(...allRequests.map((r) => ({
        _kind: "request",
        fields: {
          deed_number: r.fields?.request_number,
          case_number: r.fields?.case_number,
          judgment_type: r.fields?.request_type || "طلب على قضية",
          court: r.fields?.court,
          filed_date: r.fields?.filed_date,
          status: r.fields?.status,
        },
        text: r.text,
      })));

      // Context-aware: when forced to "documents" on /lawsuit (the الأحكام/القرارات sub-tab),
      // capture EVERY visible table row as a judgment record, regardless of header text.
      // Also explicitly detects "الصك", "رقم الصك", "تاريخ الصك" as deed indicators.
      if (focus === "documents" && /\/lawsuit(?!\/requests)/i.test(location.href)) {
        const contextRows = [];
        // Look at page headers/labels for explicit deed terminology hint
        const pageHasDeedTerms = /الصك|رقم\s*الصك|تاريخ\s*الصك|رقم\s*الحكم|تاريخ\s*الحكم/.test(document.body.innerText || "");
        $all("table").forEach((table) => {
          const headers = $all("thead th, thead td, tr:first-child th, tr:first-child td", table).map(text).join(" ");
          const tableHasDeedTerms = /الصك|رقم\s*الصك|تاريخ\s*الصك|رقم\s*الحكم|تاريخ\s*الحكم/.test(headers);
          const rows = $all("tbody tr", table).length ? $all("tbody tr", table) : $all("tr", table);
          rows.forEach((row, i) => {
            if (i === 0 && $all("th", row).length && !$all("td", row).length) return;
            const cells = $all("td, th", row).map(text);
            if (cells.length < 2) return;
            const idMatch = cells.find((v) => /\d{4}\s*\/\s*\d{3,}|\d{9,}/.test(v));
            if (!idMatch) return;
            // Only emit if either page or table mentions deed/judgment terms
            if (!pageHasDeedTerms && !tableHasDeedTerms) return;
            const dateMatch = cells.find((v) => /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]14\d{2}/.test(v));
            const id = (idMatch.match(/\d{4}\s*\/\s*\d{3,}|\d{9,}/) || [""])[0].replace(/\s/g, "");
            contextRows.push({
              _kind: "judgment",
              fields: {
                deed_number: id,
                case_number: id,
                judgment_type: cells.find((v) => /حكم|صك|قرار|قضائي/.test(v)) || "صك",
                court: cells.find((v) => /محكمة|دائرة/.test(v)),
                filed_date: dateMatch || undefined,
                status: cells.find((v) => /^(قطعي|ابتدائي|نهائي|مكتمل|قيد)/.test(v.trim())),
              },
              text: cells.join(" | "),
            });
          });
        });
        const existingDeeds = new Set(allJudgments.map((j) => j.fields?.deed_number).filter(Boolean));
        const adds = contextRows.filter((r) => !existingDeeds.has(r.fields.deed_number));
        if (adds.length) {
          console.log("[منصة العدالة] context-aware deeds captured:", adds.length);
          allJudgments.push(...adds);
        }
      }

      console.log("[منصة العدالة] استخلاص خام:", {
        cases: allCases.length, powers: allPowers.length,
        executions: allExecs.length, sessions: allSessions.length,
        judgments: allJudgments.length, requests: allRequests.length, url: location.href,
      });

      if (focus === "cases" && allCases.length === 0) {
        collectCards(["القضية", "رقم القضية", "الموضوع", "الدعوى"]).forEach((el, i) => {
          const cn = fieldFromContainer(el, ["رقم القضية", "رقم الدعوى", "رقم"]);
          if (!cn) return;
          allCases.push({
            _kind: "case",
            fields: {
              case_number: cn,
              title: fieldFromContainer(el, ["الموضوع", "موضوع"]),
              court: fieldFromContainer(el, ["المحكمة"]),
              case_type: fieldFromContainer(el, ["النوع", "نوع القضية"]),
              status: fieldFromContainer(el, ["الحالة"]),
              plaintiff: fieldFromContainer(el, ["المدعي", "الموكل", "العميل"]),
            },
            text: clean(el.innerText || "").slice(0, 400),
          });
        });
      }
      if (focus === "powers" && allPowers.length === 0) {
        collectCards(["الوكالة", "رقم الوكالة", "الموكل", "الوكيل"]).forEach((el, i) => {
          const wn = fieldFromContainer(el, ["رقم الوكالة", "رقم"]);
          if (!wn) return;
          allPowers.push({
            _kind: "power",
            fields: {
              wakalah_number: wn,
              issuer_name: fieldFromContainer(el, ["الموكل", "اسم الموكل"]),
              agent_name: fieldFromContainer(el, ["الوكيل", "اسم الوكيل"]),
              issue_date: fieldFromContainer(el, ["تاريخ الإصدار", "تاريخ الاصدار"]),
              expiry_date: fieldFromContainer(el, ["تاريخ الانتهاء", "الانتهاء"]),
              scope: fieldFromContainer(el, ["النطاق", "نطاق"]),
            },
            text: clean(el.innerText || "").slice(0, 400),
          });
        });
      }
      if (focus === "executions" && allExecs.length === 0) {
        collectCards(["التنفيذ", "رقم الطلب", "المبلغ", "المنفذ"]).forEach((el, i) => {
          const en = fieldFromContainer(el, ["رقم الطلب", "رقم التنفيذ", "رقم"]);
          if (!en) return;
          allExecs.push({
            _kind: "execution",
            fields: {
              execution_number: en,
              court: fieldFromContainer(el, ["المحكمة"]),
              amount: fieldFromContainer(el, ["المبلغ"]),
              debtor_name: fieldFromContainer(el, ["المنفذ ضده", "المدين"]),
              status: fieldFromContainer(el, ["الحالة"]),
              filed_date: fieldFromContainer(el, ["تاريخ الإيداع", "التاريخ", "تاريخ تقديم الطلب"]),
            },
            text: clean(el.innerText || "").slice(0, 400),
          });
        });
      }

      // بناء الـ payload بصيغة API النظام
      const cases = toCasePayload(allCases);
      const powers = toPowerPayload(allPowers);
      const executions = toExecutionPayload(allExecs);
      const sessions = toSessionPayload(allSessions);
      const documents = toDocumentPayload(allJudgments);

      // كم سيتم إرسال؟
      const total = cases.length + powers.length + executions.length + sessions.length + documents.length;
      const sections = [];
      if (cases.length) sections.push("cases");
      if (powers.length) sections.push("powers");
      if (executions.length) sections.push("executions");
      if (sessions.length) sections.push("sessions");
      if (documents.length) sections.push("documents");

      // حدد kind: إذا كان فلتر — التزم به، وإلا استنتج
      let kind = "mixed";
      if (sections.length === 1) kind = sections[0];
      else if (kindFilter && sections.includes(kindFilter)) kind = kindFilter;
      else if (urlKind && sections.includes(urlKind)) kind = urlKind;

      const payload = {
        kind,
        sourceUrl: location.href.slice(0, 1000),
      };
      if (cases.length) payload.cases = cases;
      if (powers.length) payload.powers = powers;
      if (executions.length) payload.executions = executions;
      if (sessions.length) payload.sessions = sessions;
      if (documents.length) payload.documents = documents;

      console.log("[منصة العدالة] payload نهائي:", {
        kind, total,
        cases: cases.length, powers: powers.length, executions: executions.length,
        sessions: sessions.length, documents: documents.length,
      });

      return payload;
    },
  };

  // =====================================================
  // زر عائم داخل صفحة ناجز
  // =====================================================
  function injectFab() {
    if (document.getElementById("adala-najiz-fab")) return;
    const fab = document.createElement("button");
    fab.id = "adala-najiz-fab";
    fab.title = "منصة العدالة — مزامنة بيانات ناجز";
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    const menu = document.createElement("div");
    menu.id = "adala-najiz-menu";
    menu.innerHTML = `
      <div class="ad-title">⚖️ منصة العدالة — مزامنة ناجز v4.6</div>
      <button class="ad-primary" id="ad-bot" style="background:linear-gradient(135deg,#16a34a,#065f46);color:#fff;border:1.5px solid #10b981;margin-bottom:6px">🚀 تشغيل البوت (سحب كل الصفحات)</button>
      <button class="ad-primary" data-k="">مزامنة الصفحة الحالية فقط</button>
      <div class="ad-grid">
        <button class="ad-chip" data-k="cases">القضايا</button>
        <button class="ad-chip" data-k="sessions">الجلسات</button>
        <button class="ad-chip" data-k="powers">الوكالات</button>
        <button class="ad-chip" data-k="executions">التنفيذ</button>
      </div>
      <div class="ad-status" id="ad-status"></div>`;
    document.body.appendChild(fab);
    document.body.appendChild(menu);
    fab.addEventListener("click", () => menu.classList.toggle("open"));

    const setS = (msg, cls) => {
      const s = menu.querySelector("#ad-status");
      s.className = "ad-status show " + cls;
      s.textContent = msg;
    };

    menu.querySelector("#ad-bot").addEventListener("click", async () => {
      try {
        const cfg = await chrome.storage.local.get(["baseUrl", "syncToken"]);
        if (!cfg.baseUrl || !cfg.syncToken) {
          setS("افتح الإعدادات وأدخل الرابط والرمز أولاً", "err");
          return;
        }
        setS("🤖 جارٍ تشغيل البوت التلقائي...", "info");
        chrome.runtime.sendMessage({
          type: "ADALA_AUTOPILOT_START_HERE",
          baseUrl: cfg.baseUrl, syncToken: cfg.syncToken,
        });
      } catch (e) { setS("خطأ: " + (e?.message || e), "err"); }
    });

    menu.querySelectorAll("[data-k]").forEach((b) => {
      b.addEventListener("click", async () => {
        const kf = b.dataset.k || null;
        try {
          const cfg = await chrome.storage.local.get(["baseUrl", "syncToken"]);
          if (!cfg.baseUrl || !cfg.syncToken) {
            setS("افتح إعدادات الإضافة وأدخل الرابط والرمز أولاً", "err"); return;
          }
          setS("جارٍ التمرير والسحب...", "info");
          const payload = await window.__ADALA_NAJIZ__.scrape(kf);
          const total = (payload.cases?.length || 0) + (payload.powers?.length || 0) +
                        (payload.executions?.length || 0) + (payload.sessions?.length || 0) +
                        (payload.documents?.length || 0);
          if (!total) { setS("لم يتم العثور على بيانات في هذه الصفحة", "err"); return; }
          setS(`جارٍ إرسال ${total} عنصر إلى النظام...`, "info");
          const resp = await chrome.runtime.sendMessage({
            type: "ADALA_SYNC", baseUrl: cfg.baseUrl, syncToken: cfg.syncToken, payload,
          });
          if (resp?.ok) {
            const d = resp.data || {};
            setS(`✓ تمت المزامنة — ${d.total ?? total} عنصر · ${d.inserted ?? 0} جديد · ${d.updated ?? 0} محدّث`, "ok");
            chrome.storage.local.set({ lastSync: new Date().toISOString() });
          } else setS("فشل: " + (resp?.error || "خطأ غير معروف"), "err");
        } catch (e) { setS("خطأ: " + (e?.message || e), "err"); }
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectFab);
  else injectFab();

  // استقبل أوامر السحب من popup عبر background
  chrome.runtime.onMessage?.addListener?.((msg, _sender, sendResponse) => {
    if (msg?.action === "SCRAPE_KIND") {
      window.__ADALA_NAJIZ__.scrape(msg.kind || null)
        .then((payload) => sendResponse({ ok: true, payload }))
        .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
      return true;
    }
    return false;
  });

  console.log("[منصة العدالة v4.6] واجهة موحّدة + أحكام context-aware — نوع الصفحة:", detectKindFromUrl());
})();
