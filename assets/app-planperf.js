/* ==========================================================================
   app-planperf.js — แผนเทียบผล + ติดตามการรายงาน
   ใช้ร่วมกันทั้งปี 2570 / 2571 (สีทั้งหมดอ่านจากตัวแปรธีม)
   1) ฟอร์มแผน: แหล่งงบประมาณ, แผนการใช้จ่ายรายไตรมาส, ค่าเป้าหมาย+หน่วยของ KPI
   2) ฟอร์มรายงาน: ความคืบหน้า (%), เทียบผล KPI กับเป้าหมาย (คำนวณ % อัตโนมัติ), สถานะการตรวจ
   3) หน้ารายละเอียดโครงการ: การ์ด "แผนเทียบผล"
   4) หน้าใหม่ "ติดตามและวิเคราะห์": ติดตามการส่งรายงาน + ตรวจ/อนุมัติ, วิเคราะห์แผน–ผล
   ========================================================================== */
(function () {
  'use strict';
  const Q = ['1', '2', '3', '4'];
  const Q_RANGE = { 1: 'ต.ค.–ธ.ค.', 2: 'ม.ค.–มี.ค.', 3: 'เม.ย.–มิ.ย.', 4: 'ก.ค.–ก.ย.' };
  const DUE_DAYS_AFTER_QUARTER = 15; // กำหนดส่งรายงาน = วันสิ้นไตรมาส + 15 วัน
  const BUDGET_SOURCES = ['งบประมาณประจำปีของมูลนิธิฯ', 'เงินรายได้', 'เงินบริจาค', 'งบประมาณแผ่นดิน', 'เงินสนับสนุนจากหน่วยงานภายนอก'];

  const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s == null ? '' : String(s))
    : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { if (v === null || v === undefined || v === '') return null; const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const baht = n => Math.round(Number(n) || 0).toLocaleString('th-TH');
  const pctTxt = n => (n == null || !isFinite(n)) ? '—' : (Math.round(n * 10) / 10).toLocaleString('th-TH') + '%';
  const year = () => (typeof currentYear !== 'undefined' ? Number(currentYear) : 2570);
  const projs = () => (typeof projects !== 'undefined' && Array.isArray(projects)) ? projects : [];
  const toast = (m, d) => { if (typeof showToast === 'function') showToast(m, d || 2600); };

  // ──────────────────────────────────────────────────────────────────────
  //  DATA MODEL
  // ──────────────────────────────────────────────────────────────────────
  function planExtra(p) {
    let x = p && p.planExtra;
    if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = {}; } }
    x = (x && typeof x === 'object') ? x : {};
    const kt = Array.isArray(x.kpiTargets) ? x.kpiTargets : [];
    const d = (Array.isArray(x.disburse) ? x.disburse : []).map(v => Number(v) || 0);
    while (d.length < 4) d.push(0);
    return { kpiTargets: kt, disburse: d.slice(0, 4) };
  }
  function _arr(v) {
    if (Array.isArray(v)) return v;
    try { return typeof v === 'string' && v.trim().startsWith('[') ? JSON.parse(v) : (v ? [v] : []); } catch (e) { return v ? [v] : []; }
  }
  // ตัวชี้วัดตามแผน พร้อมค่าเป้าหมาย/หน่วย
  function planKpis(p) {
    const pe = planExtra(p);
    let rows;
    if (Array.isArray(p.evalRows) && p.evalRows.length) rows = p.evalRows.map(r => ({ ...r }));
    else {
      const k = _arr(p.kpi), m = _arr(p.evalMethod), t = _arr(p.evaluator);
      rows = k.map((x, i) => ({ kpi: x, method: m[i] || '', tool: t[i] || '' }));
    }
    return rows.map((r, i) => {
      const t = pe.kpiTargets[i] || {};
      const tval = num(t.tval != null && t.tval !== '' ? t.tval : r.tval);
      return { kpi: String((typeof _unwrapMaybeJsonArrayString === 'function' ? _unwrapMaybeJsonArrayString(r.kpi) : r.kpi) || '').trim(), tval, unit: t.unit || r.unit || '' };
    }).filter(r => r.kpi);
  }
  function qReport(p, q) { return (p && p.reportsByQuarter && p.reportsByQuarter[String(q)]) || null; }
  function latestQ(p) {
    const qs = Object.keys((p && p.reportsByQuarter) || {}).filter(q => Q.includes(q)).map(Number);
    return qs.length ? Math.max(...qs) : 0;
  }
  // ผล KPI: ใช้ค่าจากรายงานไตรมาสล่าสุดที่มีตัวชี้วัดนั้น (ถือเป็นค่าสะสมถึงไตรมาสนั้น)
  function kpiStatus(p) {
    const plan = planKpis(p);
    return plan.map((k, i) => {
      let actual = null, atQ = 0, achieved = '';
      for (let q = 4; q >= 1; q--) {
        const r = qReport(p, q); if (!r || !Array.isArray(r.kpiResults)) continue;
        const rows = r.kpiResults.map(x => (x && typeof x === 'object') ? x : { indicator: String(x || '') });
        const hit = rows.find(x => String(x.indicator || '').trim() === k.kpi) || rows[i];
        if (hit && (num(hit.target) != null || hit.achieved)) { actual = num(hit.target); achieved = hit.achieved || ''; atQ = q; break; }
      }
      const pct = (k.tval && actual != null) ? actual / k.tval * 100 : null;
      let state = 'nodata';
      if (achieved === 'yes' || (pct != null && pct >= 100)) state = 'met';
      else if (pct != null) state = pct >= atQ * 25 - 0.0001 ? 'ontrack' : 'behind';
      else if (achieved === 'no') state = 'behind';
      else if (!k.tval) state = 'notarget';
      return { ...k, actual, atQ, pct, achieved, state };
    });
  }
  function disbursement(p) {
    const pe = planExtra(p);
    const plan = pe.disburse, hasPlan = plan.some(v => v > 0);
    const act = Q.map(q => { const r = qReport(p, q); return r ? (Number(r.spent) || 0) : 0; });
    const cum = a => a.reduce((o, v, i) => (o.push((o[i - 1] || 0) + v), o), []);
    return { hasPlan, plan, act, planCum: cum(plan), actCum: cum(act), planTotal: plan.reduce((a, b) => a + b, 0) };
  }
  // สถานะการส่งรายงานของไตรมาส q
  function reportState(p, q) {
    const r = qReport(p, q);
    if (!r) return 'missing';
    const s = r.reviewStatus || '';
    return s === 'approved' ? 'approved' : s === 'revise' ? 'revise' : 'submitted';
  }

  // ── ปฏิทินปีงบประมาณ (ต.ค. – ก.ย.) ──
  function fyStart() { return new Date(year() - 543 - 1, 9, 1); }
  function qStart(q) { const s = fyStart(); return new Date(s.getFullYear(), s.getMonth() + 3 * (q - 1), 1); }
  function qEnd(q) { const s = qStart(q); return new Date(s.getFullYear(), s.getMonth() + 3, 0, 23, 59, 59); }
  function qDue(q) { const e = qEnd(q); return new Date(e.getFullYear(), e.getMonth(), e.getDate() + DUE_DAYS_AFTER_QUARTER, 23, 59, 59); }
  function currentQ(now) {
    now = now || new Date();
    for (let q = 4; q >= 1; q--) if (now >= qStart(q)) return q;
    return 1;
  }
  const thDate = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const daysTo = d => Math.ceil((d - new Date()) / 86400000);

  if (typeof window.goToReportForm !== 'function') {
    window.goToReportForm = function (projectId, quarter) {
      if (typeof closeDetail === 'function') closeDetail();
      showPage('report');
      const sel = document.getElementById('reportProjectSelect'); if (sel) sel.value = projectId;
      if (typeof onReportProjectChange === 'function') onReportProjectChange();
      if (quarter) { const f = document.getElementById('fQuarter'); if (f) { f.value = quarter; if (typeof onReportQuarterChange === 'function') onReportQuarterChange(); } }
      setTimeout(() => { const el = document.getElementById('reportFormPanel'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
    };
  }
  window.DLFPerf = { planExtra, planKpis, kpiStatus, disbursement, reportState, qDue, currentQ };

  // ──────────────────────────────────────────────────────────────────────
  //  1) ฟอร์มแผนโครงการ
  // ──────────────────────────────────────────────────────────────────────
  function injectPlanForm() {
    const b = document.getElementById('fBudget');
    if (!b || document.getElementById('fBudgetSource')) return;
    const field = b.closest('.form-field');
    const src = document.createElement('div');
    src.className = 'form-field';
    src.innerHTML = `<label class="form-label">แหล่งงบประมาณ</label>
      <input type="text" id="fBudgetSource" class="form-input" list="ppBudgetSrcList" placeholder="เลือกหรือพิมพ์แหล่งงบประมาณ" autocomplete="off">
      <datalist id="ppBudgetSrcList">${BUDGET_SOURCES.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
    field.after(src);
    const disb = document.createElement('div');
    disb.className = 'form-field full';
    disb.innerHTML = `<div class="pp-disb">
      <div class="pp-disb-head">
        <div><b>แผนการใช้จ่ายงบประมาณรายไตรมาส</b><span>ใช้เทียบกับยอดใช้จ่ายจริงในหน้า "ติดตามและวิเคราะห์"</span></div>
        <div class="pp-disb-btns">
          <button type="button" class="btn btn-sm" onclick="DLFPerf.splitEven()">แบ่งเท่ากัน 4 ไตรมาส</button>
          <button type="button" class="btn btn-sm" onclick="DLFPerf.clearDisb()">ล้าง</button>
        </div>
      </div>
      <div class="pp-disb-grid">
        ${Q.map(q => `<label class="pp-disb-cell"><span>ไตรมาส ${q}<small>${Q_RANGE[q]}</small></span>
          <input type="number" min="0" step="any" id="fDisbQ${q}" class="form-input" placeholder="0" oninput="DLFPerf.refreshDisb()"></label>`).join('')}
      </div>
      <div class="pp-disb-sum" id="ppDisbSum"></div>
    </div>`;
    src.after(disb);
    b.addEventListener('input', refreshDisb);

    // ตารางตัวชี้วัด: เพิ่มคอลัมน์ "ค่าเป้าหมาย"
    const th = document.querySelector('#evalTable thead tr');
    if (th && !th.querySelector('.pp-th-target')) {
      const last = th.lastElementChild;
      const c = document.createElement('th');
      c.className = 'pp-th-target';
      c.style.cssText = 'border:1px solid #b0bcd4;padding:6px 8px;text-align:left;width:170px';
      c.innerHTML = 'ค่าเป้าหมาย <span style="font-weight:400;color:var(--text3)">(ตัวเลข + หน่วย)</span>';
      th.insertBefore(c, last);
      const tbl = document.getElementById('evalTable'); if (tbl) tbl.style.minWidth = '720px';
    }
  }
  function getDisbInputs() { return Q.map(q => { const el = document.getElementById('fDisbQ' + q); return el ? (parseFloat(el.value) || 0) : 0; }); }
  function setDisbInputs(arr) { Q.forEach((q, i) => { const el = document.getElementById('fDisbQ' + q); if (el) el.value = arr && arr[i] ? arr[i] : ''; }); refreshDisb(); }
  function refreshDisb() {
    const out = document.getElementById('ppDisbSum'); if (!out) return;
    const v = getDisbInputs(), tot = v.reduce((a, b) => a + b, 0);
    const budget = parseFloat((document.getElementById('fBudget') || {}).value) || 0;
    if (!tot) { out.className = 'pp-disb-sum'; out.innerHTML = 'ยังไม่ได้กำหนดแผน (ไม่บังคับ)'; return; }
    const diff = budget - tot;
    const ok = Math.abs(diff) < 1;
    out.className = 'pp-disb-sum ' + (ok ? 'ok' : 'warn');
    out.innerHTML = `รวมแผน <b>${baht(tot)}</b> บาท · งบประมาณรวม ${baht(budget)} บาท · ` +
      (ok ? '✓ ตรงกับงบประมาณ' : (diff > 0 ? `ยังไม่ได้กระจาย ${baht(diff)} บาท` : `เกินงบประมาณ ${baht(-diff)} บาท`));
  }
  function splitEven() {
    const budget = parseFloat((document.getElementById('fBudget') || {}).value) || 0;
    if (!budget) { toast('⚠️ กรุณากรอกงบประมาณรวมก่อน'); return; }
    const base = Math.floor(budget / 4);
    setDisbInputs([base, base, base, budget - base * 3]);
  }
  Object.assign(window.DLFPerf, { splitEven, refreshDisb, clearDisb: () => setDisbInputs([0, 0, 0, 0]) });

  window.dlfGetBudgetSource = function () { const el = document.getElementById('fBudgetSource'); return el ? el.value.trim() : ''; };
  window.dlfCollectPlanExtra = function () {
    const rows = (typeof evalRows !== 'undefined' ? evalRows : []).filter(r => (r.kpi || '').trim() || (r.method || '').trim() || (r.tool || '').trim());
    return {
      kpiTargets: rows.map(r => ({ tval: num(r.tval), unit: String(r.unit || '').trim() })),
      disburse: getDisbInputs()
    };
  };

  // แถวตารางตัวชี้วัด (แทนของเดิม เพิ่มช่องค่าเป้าหมาย)
  window._mkEvalRow = function (kpi = '', method = '', tool = '', tval = '', unit = '') { return { kpi, method, tool, tval, unit }; };
  window.renderEvalTable = function () {
    const tbody = document.getElementById('evalBody'); if (!tbody) return;
    const un = v => (typeof _unwrapMaybeJsonArrayString === 'function') ? _unwrapMaybeJsonArrayString(v) : v;
    const ta = (i, f, ph, v) => `<td style="border:1px solid #ccd5e4;padding:4px"><textarea oninput="evalRows[${i}].${f}=this.value;syncEvalHidden()" style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent;resize:vertical;min-height:48px" placeholder="${ph}">${esc(un(v) || '')}</textarea></td>`;
    tbody.innerHTML = evalRows.map((row, i) => `<tr>
      <td style="border:1px solid #ccd5e4;padding:4px;text-align:center;font-size:12px">${i + 1}</td>
      ${ta(i, 'kpi', 'ตัวชี้วัด...', row.kpi)}${ta(i, 'method', 'วิธีการประเมิน...', row.method)}${ta(i, 'tool', 'เครื่องมือ...', row.tool)}
      <td style="border:1px solid #ccd5e4;padding:4px;vertical-align:top">
        <div class="pp-tgt">
          <input type="number" step="any" min="0" placeholder="เช่น 80" value="${row.tval == null ? '' : esc(row.tval)}" oninput="evalRows[${i}].tval=this.value">
          <input type="text" placeholder="หน่วย เช่น %" value="${esc(row.unit || '')}" oninput="evalRows[${i}].unit=this.value">
        </div>
      </td>
      <td style="border:1px solid #ccd5e4;padding:0;text-align:center"><button type="button" onclick="removeEvalRow(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;width:28px;height:28px">×</button></td>
    </tr>`).join('');
    if (typeof syncEvalHidden === 'function') syncEvalHidden();
  };

  function wrapPlanModal() {
    const oAdd = window.openAdd, oEdit = window.openEdit;
    if (typeof oAdd === 'function' && !oAdd._pp) {
      window.openAdd = function () {
        const r = oAdd.apply(this, arguments);
        injectPlanForm();
        const s = document.getElementById('fBudgetSource'); if (s) s.value = '';
        setDisbInputs([0, 0, 0, 0]);
        return r;
      };
      window.openAdd._pp = 1;
    }
    if (typeof oEdit === 'function' && !oEdit._pp) {
      window.openEdit = function (id) {
        const r = oEdit.apply(this, arguments);
        injectPlanForm();
        const p = projs().find(x => x.id == id); if (!p) return r;
        const pe = planExtra(p);
        if (typeof evalRows !== 'undefined') {
          evalRows.forEach((row, i) => { const t = pe.kpiTargets[i] || {}; row.tval = t.tval == null ? (row.tval || '') : t.tval; row.unit = t.unit || row.unit || ''; });
          window.renderEvalTable();
        }
        const s = document.getElementById('fBudgetSource'); if (s) s.value = p.budgetSource || '';
        setDisbInputs(pe.disburse);
        return r;
      };
      window.openEdit._pp = 1;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  //  2) ฟอร์มรายงานผล
  // ──────────────────────────────────────────────────────────────────────
  function injectReportForm() {
    const st = document.getElementById('fStatus');
    if (st && !document.getElementById('fProgress')) {
      const f = document.createElement('div');
      f.className = 'form-field';
      f.innerHTML = `<label class="form-label">ความคืบหน้าของโครงการ (สะสม)</label>
        <div class="pp-prog"><input type="range" id="fProgressRange" min="0" max="100" step="5" value="0" oninput="DLFPerf.setProgress(this.value)">
        <div class="pp-prog-num"><input type="number" id="fProgress" min="0" max="100" value="0" oninput="DLFPerf.setProgress(this.value)"><span>%</span></div></div>`;
      st.closest('.form-field').after(f);
      st.addEventListener('change', () => { if (st.value === 'done') setProgress(100); });
    }
    const relabel = (id, txt, hint) => { const el = document.getElementById(id); const f = el && el.closest('.form-field'); const l = f && f.querySelector('.form-label'); if (l && !l.dataset.pp) { l.dataset.pp = 1; l.textContent = txt; if (hint) { const h = document.createElement('div'); h.className = 'pp-field-hint'; h.textContent = hint; el.after(h); } } };
    relabel('fSpent', 'งบประมาณที่ใช้ไปในไตรมาสนี้ (บาท)', 'กรอกเฉพาะยอดของไตรมาสนี้ — ระบบรวมเป็นยอดสะสมให้เอง');
    relabel('fPO', 'PO ที่ผูกพันงบ เพิ่มในไตรมาสนี้ (บาท)');
    const card = document.getElementById('reportKpiCard');
    if (card && !document.getElementById('ppReviewBanner')) {
      const b = document.createElement('div'); b.className = 'pp-review-banner'; b.id = 'ppReviewBanner'; b.hidden = true;
      const body = document.querySelector('.section-progress .card-body');
      if (body) body.prepend(b);
    }
    const th = document.querySelector('#reportKpiTable thead tr');
    if (th && !th.dataset.pp) {
      th.dataset.pp = 1;
      th.innerHTML = '<th style="width:40px">ที่</th><th>ตัวชี้วัดโครงการ</th><th style="width:120px">เป้าหมาย (แผน)</th><th style="width:150px">ผลที่ทำได้ (สะสม)</th><th style="width:80px">เทียบเป้า</th><th style="width:150px">ผลการประเมิน</th><th style="width:34px"></th>';
      const hint = document.querySelector('#reportKpiCard .card-body > div');
      if (hint) hint.textContent = 'ระบบดึงตัวชี้วัดและค่าเป้าหมายจากแผนโครงการมาให้ — กรอก "ผลที่ทำได้ (สะสมถึงไตรมาสนี้)" เป็นตัวเลข ระบบจะคำนวณ % เทียบเป้าหมาย และตั้งผล "บรรลุ" ให้อัตโนมัติเมื่อถึง 100%';
    }
  }
  function setProgress(v) {
    v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    const a = document.getElementById('fProgress'), b = document.getElementById('fProgressRange');
    if (a && String(a.value) !== String(v) && document.activeElement !== a) a.value = v;
    if (a && document.activeElement === a && Number(a.value) > 100) a.value = 100;
    if (b) b.value = v;
    if (b) b.style.setProperty('--v', v + '%');
  }
  window.DLFPerf.setProgress = setProgress;
  window.dlfGetReportProgress = function () { const a = document.getElementById('fProgress'); return a ? Math.max(0, Math.min(100, Math.round(Number(a.value) || 0))) : 0; };

  // เก็บฟิลด์เสริมของแถว KPI ไว้ (planTarget/unit)
  window._reportKpiObj = function (k) {
    if (k && typeof k === 'object') return { indicator: k.indicator || '', target: k.target == null ? '' : String(k.target), achieved: k.achieved || '', planTarget: k.planTarget == null ? '' : k.planTarget, unit: k.unit || '' };
    return { indicator: k || '', target: '', achieved: '', planTarget: '', unit: '' };
  };
  function kpiPctHtml(k) {
    const t = num(k.planTarget), a = num(k.target);
    if (!t || a == null) return '<span class="pp-pct none">—</span>';
    const p = a / t * 100;
    const q = Number((document.getElementById('fQuarter') || {}).value) || 4;
    const cls = p >= 100 ? 'met' : p >= q * 25 ? 'ok' : 'low';
    return `<span class="pp-pct ${cls}" title="${cls === 'met' ? 'บรรลุเป้าหมายแล้ว' : cls === 'ok' ? 'เป็นไปตามแผน (คาดหวัง ' + q * 25 + '% ภายในไตรมาส ' + q + ')' : 'ต่ำกว่าแผน (คาดหวัง ' + q * 25 + '% ภายในไตรมาส ' + q + ')'}">${pctTxt(p)}</span>`;
  }
  window.renderReportKpiResults = function () {
    const body = document.getElementById('reportKpiTableBody'); if (!body) return;
    if (!reportTempKpiResults.length) { body.innerHTML = '<tr><td colspan="7" class="mini-table-empty">ยังไม่มีตัวชี้วัด — กด "+ เพิ่มตัวชี้วัด" ด้านล่าง</td></tr>'; return; }
    body.innerHTML = reportTempKpiResults.map((k, i) => {
      const kk = window._reportKpiObj(k);
      const t = num(kk.planTarget);
      return `<tr>
        <td style="text-align:center;color:var(--text3)">${i + 1}</td>
        <td><input type="text" value="${esc(kk.indicator)}" placeholder="ชื่อตัวชี้วัด" onchange="updateReportKpiRow(${i},'indicator',this.value)"></td>
        <td class="pp-plan-tgt">${t != null ? `<b>${t.toLocaleString('th-TH')}</b> ${esc(kk.unit)}` : '<span style="color:var(--text3)">ไม่ได้กำหนด</span>'}</td>
        <td><input type="text" inputmode="decimal" value="${esc(kk.target)}" placeholder="${t != null ? 'ตัวเลข เช่น ' + Math.round(t / 2) : 'เช่น 10 ตอน'}" oninput="DLFPerf.kpiInput(${i},this.value)"></td>
        <td style="text-align:center" id="ppKpiPct${i}">${kpiPctHtml(kk)}</td>
        <td><select id="ppKpiAch${i}" onchange="updateReportKpiRow(${i},'achieved',this.value)">
          <option value="" ${kk.achieved === '' ? 'selected' : ''}>— ยังไม่ประเมิน —</option>
          <option value="yes" ${kk.achieved === 'yes' ? 'selected' : ''}>✅ บรรลุเป้าหมาย</option>
          <option value="no" ${kk.achieved === 'no' ? 'selected' : ''}>❌ ไม่บรรลุเป้าหมาย</option></select></td>
        <td><button type="button" class="mini-remove-btn" onclick="removeReportKpiResult(${i})" title="ลบตัวชี้วัดนี้">×</button></td>
      </tr>`;
    }).join('');
  };
  window.DLFPerf.kpiInput = function (i, val) {
    const row = reportTempKpiResults[i]; if (!row) return;
    if (typeof row !== 'object') reportTempKpiResults[i] = window._reportKpiObj(row);
    const r = reportTempKpiResults[i];
    r.target = val;
    const cell = document.getElementById('ppKpiPct' + i); if (cell) cell.innerHTML = kpiPctHtml(r);
    const t = num(r.planTarget), a = num(val);
    if (t && a != null && a / t >= 1 && !r.achieved) {
      r.achieved = 'yes';
      const s = document.getElementById('ppKpiAch' + i); if (s) s.value = 'yes';
    }
  };
  window.addReportKpiRow = function () { reportTempKpiResults.push(window._reportKpiObj({})); window.renderReportKpiResults(); };

  function wrapReportForm() {
    const o = window.loadReportFormForQuarter;
    if (typeof o !== 'function' || o._pp) return;
    window.loadReportFormForQuarter = function (p, quarter) {
      const res = o.apply(this, arguments);
      injectReportForm();
      try {
        const plan = planKpis(p);
        reportTempKpiResults = reportTempKpiResults.map((k, i) => {
          const kk = window._reportKpiObj(k);
          const pk = plan.find(x => x.kpi === kk.indicator.trim()) || (plan[i] && !kk.indicator ? plan[i] : null);
          if (pk && pk.tval != null) { kk.planTarget = pk.tval; kk.unit = pk.unit; }
          return kk;
        });
        window.renderReportKpiResults();
        const r = qReport(p, quarter);
        // ระบบรวมยอด "ใช้ไป/PO" ของทุกไตรมาสเป็นยอดสะสม จึงต้องกรอกเฉพาะยอดของไตรมาสนี้
        // (เดิมดึงยอดไตรมาสก่อนมาใส่ให้ → ถ้าไม่แก้ ยอดจะถูกนับซ้ำ)
        if (!r) { const a = document.getElementById('fSpent'), b = document.getElementById('fPO'); if (a) a.value = 0; if (b) b.value = 0; }
        let prog = r ? (Number(r.progress) || 0) : 0;
        if (!r) for (let q = Number(quarter) - 1; q >= 1; q--) { const pr = qReport(p, q); if (pr) { prog = Number(pr.progress) || 0; break; } }
        setProgress(prog);
        const ban = document.getElementById('ppReviewBanner');
        if (ban) {
          const st = r ? reportState(p, quarter) : 'missing';
          const due = qDue(Number(quarter)), dl = daysTo(due);
          const dueTxt = `กำหนดส่งรายงานไตรมาส ${quarter}: <b>${thDate(due)}</b>` + (st === 'missing' ? (dl >= 0 ? ` (อีก ${dl} วัน)` : ` · <b class="pp-red">เลยกำหนด ${-dl} วัน</b>`) : '');
          const map = {
            missing: ['', '📝', 'ยังไม่ได้ส่งรายงานไตรมาสนี้'],
            submitted: ['sub', '📨', 'ส่งรายงานแล้ว · รอผู้ตรวจ'],
            approved: ['ok', '✅', 'ผู้ตรวจอนุมัติรายงานไตรมาสนี้แล้ว'],
            revise: ['rev', '↩️', 'ผู้ตรวจส่งกลับให้แก้ไข']
          }[st];
          ban.hidden = false;
          ban.className = 'pp-review-banner ' + map[0];
          ban.innerHTML = `<span class="pp-rb-ico">${map[1]}</span><div><b>${map[2]}</b>${r && r.reviewNote && st !== 'approved' ? `<div class="pp-rb-note">“${esc(r.reviewNote)}”${r.reviewedBy ? ' — ' + esc(r.reviewedBy) : ''}</div>` : ''}<div class="pp-rb-due">${dueTxt}</div></div>`;
        }
      } catch (e) { console.warn('planperf report', e); }
      return res;
    };
    window.loadReportFormForQuarter._pp = 1;
  }

  // ──────────────────────────────────────────────────────────────────────
  //  3) รายละเอียดโครงการ: การ์ด "แผนเทียบผล"
  // ──────────────────────────────────────────────────────────────────────
  const STATE_LBL = { met: ['บรรลุ', 'met'], ontrack: ['ตามแผน', 'ok'], behind: ['ต่ำกว่าแผน', 'bad'], nodata: ['ยังไม่รายงาน', 'none'], notarget: ['ไม่มีค่าเป้าหมาย', 'none'] };
  const RS_LBL = { missing: ['ยังไม่ส่ง', 'none'], submitted: ['รอตรวจ', 'sub'], approved: ['อนุมัติแล้ว', 'met'], revise: ['ส่งกลับแก้ไข', 'bad'] };
  function disbChart(d, h, upto) {
    h = h || 150; upto = upto || 4;
    const W = 420, H = h, padL = 8, padB = 22, padT = 18, max = Math.max(1, ...d.planCum, ...d.actCum);
    const cw = (W - padL * 2) / 4, bw = Math.min(34, cw * 0.42);
    const y = v => padT + (H - padT - padB) * (1 - v / max);
    const bars = Q.map((q, i) => {
      const x = padL + cw * i + cw / 2 - bw / 2, future = i + 1 > upto, v = future ? 0 : d.actCum[i], top = y(v), base = y(0);
      const hgt = Math.max(0, base - top);
      return `<g class="pp-bar"><title>ไตรมาส ${q}\n${future ? 'ยังไม่ถึงไตรมาสนี้' : 'ใช้จ่ายจริงสะสม ' + baht(v) + ' บาท'}${d.hasPlan ? `\nแผนสะสม ${baht(d.planCum[i])} บาท` : ''}</title>
        <rect x="${x - 6}" y="${padT}" width="${bw + 12}" height="${base - padT}" fill="transparent"/>
        ${hgt > 0 ? `<path d="M${x},${base} V${top + Math.min(4, hgt)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${base} Z" fill="var(--accent)"/>` : ''}
        <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="pp-ax">Q${q}</text></g>`;
    }).join('');
    const line = d.hasPlan ? (() => {
      const pts = Q.map((q, i) => [padL + cw * i + cw / 2, y(d.planCum[i])]);
      return `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--text2)" stroke-width="2" stroke-dasharray="5 4"/>` +
        pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="var(--surface)" stroke="var(--text2)" stroke-width="2"/>`).join('');
    })() : '';
    return `<svg viewBox="0 0 ${W} ${H}" class="pp-chart" role="img" aria-label="แผนเทียบการใช้จ่ายจริงสะสมรายไตรมาส">
      <line x1="${padL}" x2="${W - padL}" y1="${y(0)}" y2="${y(0)}" stroke="var(--border)" />${bars}${line}</svg>`;
  }
  function legendHtml(hasPlan) {
    return `<div class="pp-legend"><span><i class="act"></i>ใช้จ่ายจริงสะสม</span>${hasPlan ? '<span><i class="plan"></i>แผนการใช้จ่ายสะสม</span>' : ''}</div>`;
  }
  function detailCard(p) {
    const ks = kpiStatus(p), d = disbursement(p), lq = latestQ(p);
    const prog = lq ? Number((qReport(p, lq) || {}).progress) || 0 : 0;
    const kpiRows = ks.length ? ks.map(k => {
      const w = k.pct == null ? 0 : Math.min(100, k.pct);
      const [lbl, cls] = STATE_LBL[k.state];
      return `<div class="pp-kpi">
        <div class="pp-kpi-top"><span class="pp-kpi-name">${esc(k.kpi)}</span><span class="pp-chip ${cls}">${lbl}</span></div>
        <div class="pp-kpi-bar"><i style="width:${w}%"></i></div>
        <div class="pp-kpi-meta">เป้าหมาย ${k.tval != null ? `<b>${k.tval.toLocaleString('th-TH')}</b> ${esc(k.unit)}` : '—'} · ผล ${k.actual != null ? `<b>${k.actual.toLocaleString('th-TH')}</b> ${esc(k.unit)}` : '—'}${k.pct != null ? ` · <b>${pctTxt(k.pct)}</b>` : ''}${k.atQ ? ` <span class="pp-muted">(ถึง Q${k.atQ})</span>` : ''}</div>
      </div>`;
    }).join('') : '<div class="pp-empty">ยังไม่ได้กำหนดตัวชี้วัดในแผนโครงการ</div>';
    const disbGap = d.hasPlan && lq ? d.actCum[lq - 1] - d.planCum[lq - 1] : null;
    return `<div class="detail-section pp-detail">
      <div class="detail-section-title">📐 แผนเทียบผลการดำเนินงาน</div>
      <div class="pp-detail-grid">
        <div class="pp-box">
          <div class="pp-box-h">การใช้จ่ายงบประมาณ (สะสม)</div>
          ${disbChart(d, 140, Math.max(lq, currentQ()))}${legendHtml(d.hasPlan)}
          <div class="pp-box-f">${d.hasPlan ? (lq ? `ถึงไตรมาส ${lq}: ใช้จริง <b>${baht(d.actCum[lq - 1])}</b> / แผน <b>${baht(d.planCum[lq - 1])}</b> บาท · <b class="${disbGap < 0 ? 'pp-red' : 'pp-green'}">${disbGap < 0 ? 'ต่ำกว่าแผน ' + baht(-disbGap) : 'ตามแผน/สูงกว่า ' + baht(disbGap)}</b>` : 'ยังไม่มีรายงานผล') : 'ยังไม่ได้กำหนดแผนการใช้จ่ายรายไตรมาส — กด "แก้ไข" เพื่อเพิ่มในข้อ 5'}</div>
        </div>
        <div class="pp-box">
          <div class="pp-box-h">ตัวชี้วัด (KPI) <span class="pp-muted">ความคืบหน้าโครงการ <b>${prog}%</b></span></div>
          <div class="pp-kpis">${kpiRows}</div>
        </div>
      </div>
      <div class="pp-qstrip">${Q.map(q => { const s = reportState(p, q); const [l, c] = RS_LBL[s]; return `<div class="pp-qs"><span>Q${q}</span><span class="pp-chip ${c}">${l}</span></div>`; }).join('')}</div>
    </div>`;
  }
  function wrapDetail() {
    const o = window.openDetail;
    if (typeof o !== 'function' || o._pp) return;
    window.openDetail = function (id) {
      const r = o.apply(this, arguments);
      try {
        const p = projs().find(x => x.id == id);
        const body = document.getElementById('detailBody');
        if (p && body) {
          const hero = body.querySelector('.dt-hero') || body.firstElementChild;
          const wrap = document.createElement('div'); wrap.innerHTML = detailCard(p);
          const node = wrap.firstElementChild;
          const info = hero && hero.nextElementSibling;
          if (info) info.after(node); else body.prepend(node);
        }
      } catch (e) { console.warn('planperf detail', e); }
      return r;
    };
    window.openDetail._pp = 1;
  }

  // ──────────────────────────────────────────────────────────────────────
  //  4) หน้า "ติดตามและวิเคราะห์"
  // ──────────────────────────────────────────────────────────────────────
  const T = { tab: 'track', q: null, filter: 'all', search: '', strategy: '' };
  function mountPage() {
    if (document.getElementById('page-track')) return;
    const anchor = document.getElementById('page-report'); if (!anchor) return;
    const pg = document.createElement('div'); pg.id = 'page-track'; pg.style.display = 'none';
    anchor.after(pg);
    const navRep = Array.from(document.querySelectorAll('.nav-item')).find(el => (el.getAttribute('onclick') || '').indexOf("showPage('report'") === 0);
    if (navRep && !document.querySelector('.nav-item[data-pp]')) {
      const b = document.createElement('button');
      b.className = 'nav-item'; b.dataset.pp = 1;
      b.setAttribute('onclick', "showPage('track',undefined,this)");
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/><circle cx="19" cy="8" r="1.5"/></svg> ติดตามและวิเคราะห์ผล';
      navRep.after(b);
    }
    const o = window.showPage;
    window.showPage = function (page) {
      const r = o.apply(this, arguments);
      const el = document.getElementById('page-track');
      if (el) el.style.display = page === 'track' ? 'block' : 'none';
      if (page === 'track') {
        const t = document.getElementById('topbar-title'), s = document.getElementById('topbar-sub');
        if (t) t.textContent = 'ติดตามและวิเคราะห์ผล';
        if (s) s.textContent = 'การส่งรายงานรายไตรมาส · แผนเทียบผลการใช้จ่ายและตัวชี้วัด ปีงบประมาณ พ.ศ. ' + year();
        renderPage();
      }
      return r;
    };
  }

  function renderPage() {
    const el = document.getElementById('page-track'); if (!el) return;
    if (!T.q) T.q = currentQ();
    el.innerHTML = `<div class="pp-page">
      <div class="pp-tabs" role="tablist">
        <button role="tab" class="${T.tab === 'track' ? 'on' : ''}" onclick="DLFPerf.tab('track')">📨 ติดตามการรายงาน</button>
        <button role="tab" class="${T.tab === 'analyze' ? 'on' : ''}" onclick="DLFPerf.tab('analyze')">📐 วิเคราะห์แผน–ผล</button>
      </div>
      <div id="ppBody">${T.tab === 'track' ? trackHtml() : analyzeHtml()}</div>
    </div>`;
  }

  // ── แท็บ 1: ติดตามการรายงาน ──
  function trackHtml() {
    const q = T.q, due = qDue(q), dl = daysTo(due);
    const all = projs().slice();
    const st = all.map(p => ({ p, s: reportState(p, q), r: qReport(p, q) }));
    const cnt = k => st.filter(x => x.s === k).length;
    const sent = all.length - cnt('missing');
    const pctSent = all.length ? sent / all.length * 100 : 0;
    const started = new Date() >= qStart(q);
    let list = st;
    if (T.filter !== 'all') list = list.filter(x => x.s === T.filter);
    if (T.strategy) list = list.filter(x => String(x.p.strategy) === T.strategy);
    if (T.search) { const s = T.search.toLowerCase(); list = list.filter(x => [x.p.name, x.p.owner, x.p.coordinator].join(' ').toLowerCase().includes(s)); }
    const order = { revise: 0, missing: 1, submitted: 2, approved: 3 };
    list.sort((a, b) => order[a.s] - order[b.s] || String(a.p.name).localeCompare(String(b.p.name), 'th'));
    const editable = typeof _isEditable === 'function' && _isEditable();
    const sNames = (typeof S_NAMES !== 'undefined') ? S_NAMES : {};
    const dueTxt = !started ? `ไตรมาสนี้ยังไม่เริ่ม (เริ่ม ${thDate(qStart(q))})`
      : dl >= 0 ? `กำหนดส่ง <b>${thDate(due)}</b> · เหลืออีก <b>${dl}</b> วัน` : `กำหนดส่ง <b>${thDate(due)}</b> · <b class="pp-red">เลยกำหนดมาแล้ว ${-dl} วัน</b>`;
    const chip = (k, lbl, n) => `<button class="pp-fchip ${T.filter === k ? 'on' : ''}" onclick="DLFPerf.filter('${k}')">${lbl} <b>${n}</b></button>`;
    return `
      <div class="pp-toolbar">
        <div class="pp-qsel">${Q.map(x => `<button class="${x == q ? 'on' : ''}" onclick="DLFPerf.quarter(${x})">ไตรมาส ${x}<small>${Q_RANGE[x]}</small></button>`).join('')}</div>
        <div class="pp-due">${dueTxt}</div>
      </div>
      <div class="pp-stats">
        <div class="pp-stat hero"><span>ส่งรายงานแล้ว</span><b>${sent}<small>/${all.length}</small></b><div class="pp-meter"><i style="width:${pctSent}%"></i></div><em>${pctTxt(pctSent)} ของโครงการทั้งหมด</em></div>
        <div class="pp-stat"><span>ยังไม่ส่ง</span><b class="${cnt('missing') && started && dl < 0 ? 'pp-red' : ''}">${cnt('missing')}</b><em>${started && dl < 0 ? 'เลยกำหนดแล้ว' : 'ยังอยู่ในกำหนด'}</em></div>
        <div class="pp-stat"><span>รอตรวจ</span><b>${cnt('submitted')}</b><em>ส่งแล้ว รอผู้ตรวจ</em></div>
        <div class="pp-stat"><span>ส่งกลับแก้ไข</span><b class="${cnt('revise') ? 'pp-red' : ''}">${cnt('revise')}</b><em>ต้องแก้ไขและส่งใหม่</em></div>
        <div class="pp-stat"><span>อนุมัติแล้ว</span><b class="pp-green">${cnt('approved')}</b><em>ผ่านการตรวจ</em></div>
      </div>
      <div class="card pp-card">
        <div class="pp-card-head">
          <div class="pp-fchips">${chip('all', 'ทั้งหมด', st.length)}${chip('missing', 'ยังไม่ส่ง', cnt('missing'))}${chip('submitted', 'รอตรวจ', cnt('submitted'))}${chip('revise', 'ส่งกลับแก้ไข', cnt('revise'))}${chip('approved', 'อนุมัติแล้ว', cnt('approved'))}</div>
          <div class="pp-tools">
            <select class="select-filter" onchange="DLFPerf.strategy(this.value)"><option value="">ทุกยุทธศาสตร์</option>${Object.keys(sNames).map(k => `<option value="${k}" ${T.strategy === k ? 'selected' : ''}>${esc(sNames[k])}</option>`).join('')}</select>
            <input class="search-input" placeholder="ค้นหาโครงการ / ผู้รับผิดชอบ" value="${esc(T.search)}" oninput="DLFPerf.search(this.value)" id="ppSearch">
            <button class="btn btn-sm" onclick="DLFPerf.csv()">⬇ CSV</button>
          </div>
        </div>
        <div class="pp-table-wrap"><table class="pp-table">
          <thead><tr><th>โครงการ</th><th>ผู้รับผิดชอบ</th><th>สถานะรายงาน</th><th class="r">ใช้จ่ายไตรมาสนี้</th><th class="r">ความคืบหน้า</th><th>แก้ไขล่าสุด</th><th></th></tr></thead>
          <tbody>${list.length ? list.map(x => trackRow(x, q, editable)).join('') : '<tr><td colspan="7" class="pp-empty">ไม่มีโครงการตามเงื่อนไขที่เลือก</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="pp-note">กำหนดส่ง = วันสิ้นไตรมาส + ${DUE_DAYS_AFTER_QUARTER} วัน · ผู้ที่กดอนุมัติ/ส่งกลับได้ คือผู้ที่ตั้งไว้ใน Script properties (REVIEWER_EMAILS) ของ Apps Script · เมื่อผู้รับผิดชอบแก้ไขรายงาน สถานะจะกลับเป็น "รอตรวจ" อัตโนมัติ</div>`;
  }
  function trackRow(x, q, editable) {
    const { p, s, r } = x; const [lbl, cls] = RS_LBL[s];
    const actions = s === 'missing'
      ? `<button class="btn btn-sm btn-primary" onclick="goToReportForm(${p.id},'${q}')">กรอกรายงาน</button>`
      : `<button class="btn btn-sm" onclick="openQuarterReportPreview(${p.id},'${q}')">ดู</button>` +
        (editable ? `<button class="btn btn-sm pp-ok" onclick="DLFPerf.review(${p.id},${q},'approved')" ${s === 'approved' ? 'disabled' : ''}>อนุมัติ</button><button class="btn btn-sm pp-rev" onclick="DLFPerf.review(${p.id},${q},'revise')">ส่งกลับ</button>` : '');
    return `<tr>
      <td><div class="pp-pname" onclick="openDetail(${p.id})">${esc(p.name)}</div><div class="pp-sub">${esc(p.owner || '')}</div></td>
      <td>${esc(p.coordinator || '—')}</td>
      <td><span class="pp-chip ${cls}">${lbl}</span>${r && r.reviewNote && s === 'revise' ? `<div class="pp-sub" title="${esc(r.reviewNote)}">“${esc(String(r.reviewNote).slice(0, 60))}”</div>` : ''}</td>
      <td class="r">${r ? baht(r.spent) : '—'}</td>
      <td class="r">${r ? `<span class="pp-mini"><i style="width:${Math.min(100, Number(r.progress) || 0)}%"></i></span> ${Number(r.progress) || 0}%` : '—'}</td>
      <td class="pp-sub">${r ? esc(r.lastEditedAt || '') + (r.lastEditedBy ? '<br>' + esc(r.lastEditedBy) : '') : ''}</td>
      <td class="pp-act">${actions}</td>
    </tr>`;
  }

  // ── ตรวจ/อนุมัติ ──
  function reviewDialog(title, needNote) {
    return new Promise(res => {
      const ov = document.createElement('div'); ov.className = 'pp-dlg-ov';
      ov.innerHTML = `<div class="pp-dlg" role="dialog" aria-modal="true"><h3>${esc(title).replace(/\n/g, '<br><small>')}</small></h3>
        <textarea id="ppDlgNote" rows="4" placeholder="${needNote ? 'ระบุสิ่งที่ต้องแก้ไข (จำเป็น)' : 'หมายเหตุถึงผู้รับผิดชอบ (ไม่บังคับ)'}"></textarea>
        <div class="pp-dlg-btns"><button class="btn btn-sm" data-x="0">ยกเลิก</button><button class="btn btn-sm btn-primary" data-x="1">ยืนยัน</button></div></div>`;
      document.body.appendChild(ov);
      const ta = ov.querySelector('textarea'); setTimeout(() => ta.focus(), 30);
      ov.addEventListener('click', e => {
        const b = e.target.closest('[data-x]'); if (!b && e.target !== ov) return;
        if (b && b.dataset.x === '1') { if (needNote && !ta.value.trim()) { ta.classList.add('err'); ta.focus(); return; } ov.remove(); res(ta.value.trim()); }
        else { ov.remove(); res(null); }
      });
    });
  }
  async function review(id, q, status) {
    const p = projs().find(x => x.id == id); if (!p) return;
    const r = qReport(p, q); if (!r) return;
    const note = await reviewDialog((status === 'approved' ? 'อนุมัติรายงาน' : 'ส่งกลับให้แก้ไข') + ` · ไตรมาส ${q}\n` + p.name, status === 'revise');
    if (note === null) return;
    if (!GAS_ENABLED || typeof gasFetchPost !== 'function') { toast('⚠️ ยังไม่ได้เชื่อมต่อ Google Sheet'); return; }
    toast('⏳ กำลังบันทึกผลการตรวจ...', 1500);
    try {
      const res = await gasFetchPost('reviewReport', { id: p.id, quarter: String(q), status, note });
      if (!res || !res.success) { toast('⚠️ บันทึกผลการตรวจไม่สำเร็จ · ' + ((res && res.message) || ''), 4000); return; }
      const old = JSON.parse(JSON.stringify(p));
      Object.assign(r, { reviewStatus: status, reviewNote: note, reviewedBy: res.reviewedBy || '', reviewedAt: res.reviewedAt || '' });
      if (latestQ(p) === Number(q)) Object.assign(p, { reviewStatus: status, reviewNote: note });
      if (typeof actlogRecord === 'function') actlogRecord('ตรวจรายงาน', p, [{ key: 'review', label: `ผลการตรวจรายงาน ไตรมาส ${q}`, from: (RS_LBL[reportState(old, q)] || [''])[0], to: RS_LBL[status][0] + (note ? ' · ' + note : '') }], old);
      if (typeof saveToLocal === 'function') saveToLocal(true);
      toast(status === 'approved' ? '✅ อนุมัติรายงานแล้ว' : '✅ ส่งกลับให้แก้ไขแล้ว', 2400);
      renderPage();
    } catch (e) { if (!e || !e.code) toast('⚠️ เชื่อมต่อ Google Sheet ไม่ได้', 3000); }
  }

  function csv() {
    const q = T.q;
    const rows = [['ไตรมาส', 'โครงการ', 'ฝ่าย/กลุ่ม', 'ผู้รับผิดชอบ', 'สถานะรายงาน', 'ใช้จ่ายไตรมาสนี้', 'ความคืบหน้า(%)', 'หมายเหตุผู้ตรวจ', 'กำหนดส่ง']];
    projs().forEach(p => { const s = reportState(p, q), r = qReport(p, q) || {}; rows.push([q, p.name, p.owner || '', p.coordinator || '', RS_LBL[s][0], r.spent || 0, r.progress || 0, r.reviewNote || '', thDate(qDue(q))]); });
    const text = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = `ติดตามรายงาน_ปี${year()}_Q${q}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ── แท็บ 2: วิเคราะห์แผน–ผล ──
  function analyzeHtml() {
    const all = projs();
    const lq = Math.max(0, ...all.map(latestQ));
    const uptoQ = Math.max(1, Math.min(4, Math.max(lq, currentQ())));
    const agg = { plan: [0, 0, 0, 0], act: [0, 0, 0, 0], budget: 0 };
    let noPlan = 0;
    const sNames = (typeof S_NAMES !== 'undefined') ? S_NAMES : {};
    const byS = {};
    all.forEach(p => {
      const d = disbursement(p);
      agg.budget += Number(p.budget) || 0;
      if (!d.hasPlan) noPlan++;
      for (let i = 0; i < 4; i++) { agg.plan[i] += d.plan[i]; agg.act[i] += d.act[i]; }
      const k = String(p.strategy || '');
      if (!byS[k]) byS[k] = { budget: 0, plan: 0, act: 0, n: 0, kpiMet: 0, kpiT: 0 };
      const s = byS[k]; s.n++; s.budget += Number(p.budget) || 0;
      s.plan += d.planCum[uptoQ - 1]; s.act += d.actCum[uptoQ - 1];
    });
    const cum = a => a.reduce((o, v, i) => (o.push((o[i - 1] || 0) + v), o), []);
    const D = { hasPlan: agg.plan.some(v => v > 0), plan: agg.plan, act: agg.act, planCum: cum(agg.plan), actCum: cum(agg.act) };
    const planTo = D.planCum[uptoQ - 1], actTo = D.actCum[uptoQ - 1];
    // KPI
    const ks = [];
    all.forEach(p => kpiStatus(p).forEach(k => { ks.push({ p, k }); const s = byS[String(p.strategy || '')]; if (s && k.tval) { s.kpiT++; if (k.state === 'met') s.kpiMet++; } }));
    const kc = st => ks.filter(x => x.k.state === st).length;
    const withT = ks.filter(x => x.k.tval != null).length;
    const behind = ks.filter(x => x.k.state === 'behind').sort((a, b) => (a.k.pct || 0) - (b.k.pct || 0));
    const noTarget = all.filter(p => planKpis(p).some(k => k.tval == null));
    return `
      <div class="pp-stats four">
        <div class="pp-stat hero"><span>เบิกจ่ายจริงสะสม (ถึง Q${uptoQ})</span><b>${baht(actTo)}<small> บาท</small></b><div class="pp-meter"><i style="width:${agg.budget ? Math.min(100, actTo / agg.budget * 100) : 0}%"></i></div><em>${pctTxt(agg.budget ? actTo / agg.budget * 100 : null)} ของงบประมาณรวม ${baht(agg.budget)} บาท</em></div>
        <div class="pp-stat"><span>เทียบแผนการใช้จ่าย</span><b class="${planTo && actTo < planTo ? 'pp-red' : 'pp-green'}">${planTo ? pctTxt(actTo / planTo * 100) : '—'}</b><em>${planTo ? `แผนสะสม ${baht(planTo)} บาท` : 'ยังไม่มีแผนการใช้จ่าย'}</em></div>
        <div class="pp-stat"><span>KPI บรรลุแล้ว</span><b class="pp-green">${kc('met')}<small>/${withT}</small></b><em>จากตัวชี้วัดที่มีค่าเป้าหมาย</em></div>
        <div class="pp-stat"><span>KPI ต่ำกว่าแผน</span><b class="${kc('behind') ? 'pp-red' : ''}">${kc('behind')}</b><em>ตามแผน ${kc('ontrack')} · ยังไม่รายงาน ${kc('nodata')}</em></div>
      </div>
      <div class="pp-grid2">
        <div class="card pp-card"><div class="pp-card-head"><b>แผนการใช้จ่าย vs ใช้จ่ายจริง (สะสม ทั้งปี)</b></div>
          <div class="pp-card-body">${disbChart(D, 200, uptoQ)}${legendHtml(D.hasPlan)}
          ${noPlan ? `<div class="pp-warnline">มี <b>${noPlan}</b> โครงการที่ยังไม่ได้กำหนดแผนการใช้จ่ายรายไตรมาส — เส้นแผนจึงต่ำกว่าความจริง</div>` : ''}</div></div>
        <div class="card pp-card"><div class="pp-card-head"><b>แยกตามยุทธศาสตร์ (ถึง Q${uptoQ})</b></div>
          <div class="pp-table-wrap"><table class="pp-table compact"><thead><tr><th>ยุทธศาสตร์</th><th class="r">งบประมาณ</th><th class="r">แผนสะสม</th><th class="r">ใช้จริงสะสม</th><th class="r">เทียบแผน</th><th class="r">KPI บรรลุ</th></tr></thead>
          <tbody>${Object.keys(byS).sort().map(k => { const s = byS[k]; const g = s.plan ? s.act / s.plan * 100 : null; return `<tr><td>${esc(sNames[k] || ('ยุทธศาสตร์ ' + k))} <span class="pp-muted">(${s.n})</span></td><td class="r">${baht(s.budget)}</td><td class="r">${s.plan ? baht(s.plan) : '—'}</td><td class="r">${baht(s.act)}</td><td class="r ${g != null && g < 100 ? 'pp-red' : ''}">${pctTxt(g)}</td><td class="r">${s.kpiT ? `${s.kpiMet}/${s.kpiT}` : '—'}</td></tr>`; }).join('')}</tbody></table></div></div>
      </div>
      <div class="pp-grid2">
        <div class="card pp-card"><div class="pp-card-head"><b>ตัวชี้วัดที่ต่ำกว่าแผน</b><span class="pp-muted">เทียบกับความคาดหวัง 25% ต่อไตรมาส</span></div>
          <div class="pp-table-wrap"><table class="pp-table compact"><thead><tr><th>โครงการ / ตัวชี้วัด</th><th class="r">เป้าหมาย</th><th class="r">ผล</th><th class="r">%</th></tr></thead>
          <tbody>${behind.length ? behind.slice(0, 30).map(x => `<tr><td><div class="pp-pname" onclick="openDetail(${x.p.id})">${esc(x.p.name)}</div><div class="pp-sub">${esc(x.k.kpi)}</div></td><td class="r">${x.k.tval != null ? x.k.tval.toLocaleString('th-TH') + ' ' + esc(x.k.unit) : '—'}</td><td class="r">${x.k.actual != null ? x.k.actual.toLocaleString('th-TH') : '—'} <span class="pp-muted">Q${x.k.atQ}</span></td><td class="r pp-red">${pctTxt(x.k.pct)}</td></tr>`).join('') : '<tr><td colspan="4" class="pp-empty">ไม่มีตัวชี้วัดที่ต่ำกว่าแผน 🎉</td></tr>'}</tbody></table></div></div>
        <div class="card pp-card"><div class="pp-card-head"><b>ข้อมูลแผนที่ยังไม่ครบ</b><span class="pp-muted">ทำให้วิเคราะห์ได้ไม่เต็มที่</span></div>
          <div class="pp-table-wrap"><table class="pp-table compact"><thead><tr><th>โครงการ</th><th>ขาด</th><th></th></tr></thead>
          <tbody>${(() => {
            const miss = all.map(p => ({ p, m: [!disbursement(p).hasPlan && 'แผนการใช้จ่ายรายไตรมาส', noTarget.includes(p) && 'ค่าเป้าหมาย KPI', !planKpis(p).length && 'ตัวชี้วัด', !p.budgetSource && 'แหล่งงบประมาณ'].filter(Boolean) })).filter(x => x.m.length);
            return miss.length ? miss.slice(0, 40).map(x => `<tr><td><div class="pp-pname" onclick="openDetail(${x.p.id})">${esc(x.p.name)}</div></td><td class="pp-sub">${x.m.join(' · ')}</td><td class="pp-act">${typeof _isEditable === 'function' && _isEditable() ? `<button class="btn btn-sm" onclick="openEdit(${x.p.id})">เติมข้อมูล</button>` : ''}</td></tr>`).join('') + (miss.length > 40 ? `<tr><td colspan="3" class="pp-empty">และอีก ${miss.length - 40} โครงการ</td></tr>` : '')
              : '<tr><td colspan="3" class="pp-empty">ข้อมูลแผนครบทุกโครงการ</td></tr>';
          })()}</tbody></table></div></div>
      </div>`;
  }

  Object.assign(window.DLFPerf, {
    tab: t => { T.tab = t; renderPage(); },
    quarter: q => { T.q = q; renderPage(); },
    filter: f => { T.filter = f; renderPage(); },
    strategy: s => { T.strategy = s; renderPage(); },
    search: s => { T.search = s; const b = document.getElementById('ppBody'); if (b) { b.innerHTML = trackHtml(); const i = document.getElementById('ppSearch'); if (i) { i.focus(); i.setSelectionRange(s.length, s.length); } } },
    review, csv, render: renderPage
  });

  // อัปเดตหน้าอัตโนมัติเมื่อมีข้อมูลใหม่ (sync จาก Sheet)
  function wrapDash() {
    const o = window.updateDashboard;
    if (typeof o !== 'function' || o._ppw) return;
    window.updateDashboard = function () {
      const r = o.apply(this, arguments);
      const el = document.getElementById('page-track');
      if (el && el.style.display === 'block' && !el.contains(document.activeElement)) renderPage();
      return r;
    };
    window.updateDashboard._ppw = 1;
  }

  function init() {
    try { injectPlanForm(); injectReportForm(); wrapPlanModal(); wrapReportForm(); wrapDetail(); mountPage(); wrapDash(); }
    catch (e) { console.warn('planperf init', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
