// ══════════════════════════════════════════════════════════════════
// หน้าภาพรวม (Dashboard) แบบใหม่: แบนเนอร์ทักทาย · การ์ดตัวเลข 4 ใบ · กริด 3 คอลัมน์
// (การใช้งบ / เมนูลัด / สถานะ / ความเคลื่อนไหวล่าสุด / ความครบถ้วนของข้อมูล / งบตามอนุกรรมการ)
// + ช่องค้นหาเมนูและโครงการในแถบบน (Ctrl+K)
//
// ไฟล์นี้ไม่แก้ตรรกะเดิม: แค่ "ต่อท้าย" updateDashboard / _setLoggedIn / authLogout ให้วาดส่วนใหม่ซ้ำ
// ส่วนรายละเอียดเดิม (การ์ดยุทธศาสตร์ กราฟ ตารางสรุป อนุกรรมการ) ยังอยู่ครบด้านล่าง
// สีทั้งหมดอ่านจากตัวแปรธีม จึงเป็นม่วงพาสเทลในปี 2570 และเขียวมิ้นต์ในปี 2571 อัตโนมัติ
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtFull = n => Number(n || 0).toLocaleString('th-TH');
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ตัวเลขย่อ: 120,500,000 → { v:"120.5", u:"ล้าน" }
  function short(n) {
    n = Number(n || 0);
    const a = Math.abs(n);
    if (a >= 1e6) { const v = n / 1e6; return { v: v.toLocaleString('th-TH', { maximumFractionDigits: a >= 1e8 ? 1 : 2 }), u: 'ล้าน' }; }
    if (a >= 1e3) { const v = n / 1e3; return { v: v.toLocaleString('th-TH', { maximumFractionDigits: 1 }), u: 'พัน' }; }
    return { v: n.toLocaleString('th-TH'), u: '' };
  }
  const pct = (a, b) => b > 0 ? Math.round(a / b * 1000) / 10 : 0;

  const ICON = {
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16" cy="14" r="1.4"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10"/>',
    piggy: '<path d="M19 9c1.5.5 2 2 2 3h-2c0 3-2 5-5 5.5V20h-3v-2H9v2H6v-3c-2-1-3-3-3-5 0-4 4-7 8-7 2 0 4 .6 5.5 1.6L19 5v4z"/><circle cx="15" cy="10.5" r=".8"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 17v-3M12 17v-6M16 17v-2"/>',
    gantt: '<path d="M3 5h10M7 12h12M5 19h8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M12 16h.01"/>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  };
  const svg = (k, s) => `<svg width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

  // ── โครงหน้า (แทรกครั้งเดียว) ────────────────────────────────────
  function mount() {
    const page = $('page-dashboard');
    if (!page || $('ovRoot')) return;
    const root = document.createElement('section');
    root.className = 'ov';
    root.id = 'ovRoot';
    root.innerHTML = `
      <div class="ov-hero" id="ovHero"></div>
      <div class="ov-kpis" id="ovKpis"></div>
      <div class="ov-grid">
        <div class="ov-col">
          <div class="ov-card" id="ovRing"></div>
          <div class="ov-card" id="ovQuick"></div>
        </div>
        <div class="ov-col">
          <div class="ov-card" id="ovStatus"></div>
          <div class="ov-card ov-grow" id="ovActivity"></div>
        </div>
        <div class="ov-col">
          <div class="ov-card" id="ovCheck"></div>
          <div class="ov-card" id="ovCom"></div>
        </div>
      </div>
      <div class="ov-divider"><span>รายละเอียดงบประมาณและยุทธศาสตร์</span></div>`;
    page.insertBefore(root, page.firstChild);
    page.classList.add('ov-on');
  }

  // ── ข้อมูลผู้ใช้ ────────────────────────────────────────────────
  function user() {
    try { return (typeof _currentUser !== 'undefined' && _currentUser) ? _currentUser : null; } catch (e) { return null; }
  }
  function canEdit() { try { return typeof _isEditable === 'function' && _isEditable(); } catch (e) { return false; } }

  // ── แบนเนอร์ทักทาย ───────────────────────────────────────────────
  function heroArt() {
    return `<svg class="ov-art" viewBox="0 0 240 150" aria-hidden="true">
      <ellipse cx="128" cy="140" rx="104" ry="7" fill="rgba(0,0,0,.18)"/>
      <rect class="b b1" x="40" y="74" width="26" height="64" rx="7" fill="rgba(255,255,255,.28)"/>
      <rect class="b b2" x="76" y="50" width="26" height="88" rx="7" fill="rgba(255,255,255,.4)"/>
      <rect class="b b3" x="112" y="22" width="26" height="116" rx="7" fill="var(--ov-art-bar)"/>
      <g class="ck"><circle cx="146" cy="22" r="15" fill="#fff"/><path d="m139 22 5 5 9-10" fill="none" stroke="var(--ov-art-bar-dk)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="coin"><circle cx="190" cy="86" r="25" fill="#F6C454"/><circle cx="190" cy="86" r="19" fill="#F9D677" stroke="#E9A92B" stroke-width="2"/>
        <text x="190" y="94" text-anchor="middle" font-size="22" font-weight="800" fill="#C27D10" font-family="Anuphan,Sarabun,sans-serif">฿</text></g>
    </svg>`;
  }
  function renderHero(fp, t) {
    const el = $('ovHero'); if (!el) return;
    const u = user();
    const name = u && !u.isGuest ? String(u.name || '').trim().split(/\s+/)[0] : '';
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'อรุณสวัสดิ์' : hour < 17 ? 'สวัสดี' : 'สวัสดีตอนเย็น';
    const greet = name ? `${hello} คุณ${esc(name)}` : 'ยินดีต้อนรับสู่ระบบรายงานผล';
    const used = pct(t.spent + t.po, t.budget);
    el.innerHTML = `
      <div class="ov-hero-txt">
        <div class="ov-hero-eyebrow">ปีงบประมาณ พ.ศ. ${typeof currentYear !== 'undefined' ? currentYear : ''}</div>
        <h2>${greet}</h2>
        <p>ภาพรวม ${fp.length} โครงการ · ใช้จ่ายและผูกพันแล้ว ${used}% ของงบประมาณรวม · แล้วเสร็จ ${t.done} โครงการ</p>
        <div class="ov-hero-btns">
          ${canEdit() ? `<button type="button" onclick="openAdd()">${svg('plus', 15)}เพิ่มโครงการ</button>` : ''}
          <button type="button" onclick="showPage('projects','')">${svg('folder', 15)}โครงการทั้งหมด</button>
          <button type="button" onclick="openPdfSelectModal()">${svg('pdf', 15)}Export PDF</button>
        </div>
      </div>
      ${heroArt()}`;
  }

  // ── การ์ดตัวเลข 4 ใบ ─────────────────────────────────────────────
  function renderKpis(fp, t) {
    const el = $('ovKpis'); if (!el) return;
    const card = (cls, icon, n, label, sub) => {
      const s = short(n);
      return `<div class="ov-kpi ${cls}" title="${fmtFull(n)} บาท">
        <span class="ic">${svg(icon, 20)}</span>
        <div><b>${s.v}<small>${s.u}</small></b><em>${label}</em><span>${sub}</span></div>
      </div>`;
    };
    const rem = t.budget - t.spent - t.po;
    el.innerHTML =
      card('k1', 'wallet', t.budget, 'งบประมาณรวมโครงการ', `บาท · ${fp.length} โครงการ`) +
      card('k2', 'cash', t.spent, 'ใช้จ่ายแล้ว', `${pct(t.spent, t.budget)}% ของงบ`) +
      card('k3', 'hourglass', t.po, 'PO ผูกพัน', `${pct(t.po, t.budget)}% ของงบ`) +
      card(rem < 0 ? 'k4 neg' : 'k4', 'piggy', rem, 'คงเหลือสุทธิ', `${pct(rem, t.budget)}% ของงบ`);
  }

  // ── วงแหวนการใช้งบ ───────────────────────────────────────────────
  function renderRing(fp, t) {
    const el = $('ovRing'); if (!el) return;
    const p = Math.max(0, Math.min(100, pct(t.spent + t.po, t.budget)));
    const ps = Math.max(0, Math.min(100, pct(t.spent, t.budget)));
    const C = 2 * Math.PI * 52;
    el.innerHTML = `
      <div class="ov-card-head center"><h3>การใช้งบประมาณ</h3></div>
      <div class="ov-ring">
        <svg viewBox="0 0 124 124" aria-hidden="true">
          <circle cx="62" cy="62" r="52" class="trk"/>
          <circle cx="62" cy="62" r="52" class="arc po" style="stroke-dasharray:${(C * p / 100).toFixed(1)} ${C.toFixed(1)}"/>
          <circle cx="62" cy="62" r="52" class="arc sp" style="stroke-dasharray:${(C * ps / 100).toFixed(1)} ${C.toFixed(1)}"/>
        </svg>
        <div class="ov-ring-c"><b>${p}%</b><span>ใช้ไป + PO</span></div>
      </div>
      <div class="ov-ring-leg"><span><i class="sp"></i>ใช้ไป ${ps}%</span><span><i class="po"></i>PO ${Math.round((p - ps) * 10) / 10}%</span></div>
      <div class="ov-ring-stats">
        <div><b>${fp.length}</b><span>โครงการ</span></div>
        <div class="ok"><b>${t.done}</b><span>แล้วเสร็จ</span></div>
        <div class="wait"><b>${t.pend}</b><span>ยังไม่เริ่ม</span></div>
      </div>`;
  }

  // ── เมนูลัด ─────────────────────────────────────────────────────
  function renderQuick() {
    const el = $('ovQuick'); if (!el) return;
    const items = [
      canEdit() ? ['q1', 'plus', 'เพิ่มโครงการ', "openAdd()"] : null,
      ['q2', 'folder', 'โครงการ', "showPage('projects','')"],
      ['q3', 'report', 'รายงานผล', "showPage('report')"],
      ['q4', 'gantt', 'Gantt', "showPage('gantt')"],
      ['q5', 'shield', 'ความเสี่ยง', "showPage('risk')"],
      ['q6', 'pdf', 'Export PDF', "openPdfSelectModal()"],
      canEdit() ? null : ['q1', 'sheet', 'Google Sheets', "showPage('gsheet')"],
    ].filter(Boolean);
    el.innerHTML = `
      <div class="ov-card-head"><h3><span class="hi zap">⚡</span>เมนูลัด</h3></div>
      <div class="ov-quick">${items.map(([c, i, l, fn]) =>
        `<button type="button" class="${c}" onclick="${fn}"><span>${svg(i, 22)}</span>${l}</button>`).join('')}</div>`;
  }

  // ── สถานะโครงการ ────────────────────────────────────────────────
  function renderStatus(fp, t) {
    const el = $('ovStatus'); if (!el) return;
    const n = fp.length || 1;
    const rows = [['done', 'แล้วเสร็จ', t.done], ['progress', 'อยู่ระหว่างดำเนินการ', t.prog], ['pending', 'ยังไม่เริ่มดำเนินการ', t.pend]];
    el.innerHTML = `
      <div class="ov-card-head"><h3>${svg('flag', 17)}สถานะโครงการ</h3><span class="ov-muted">${fp.length} โครงการ</span></div>
      <div class="ov-status">${rows.map(([k, l, c]) => `
        <div class="ov-st ${k}">
          <div class="ov-st-top"><span>${l}</span><span><b>${c}</b> โครงการ · ${Math.round(c / n * 100)}%</span></div>
          <div class="ov-bar"><i style="width:${(c / n * 100).toFixed(1)}%"></i></div>
        </div>`).join('')}</div>`;
  }

  // ── ความเคลื่อนไหวล่าสุด (จากการบันทึกรายงานผลรายไตรมาส) ─────────
  const TH_MON = { 'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5, 'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11 };
  function parseWhen(v) {
    if (!v) return 0;
    const s = String(v).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (iso) { let y = +iso[1]; if (y > 2400) y -= 543; return Date.UTC(y, +iso[2] - 1, +iso[3], +iso[4], +iso[5]); }
    const th = s.match(/(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (th && TH_MON[th[2]] !== undefined) { let y = +th[3]; if (y > 2400) y -= 543; return new Date(y, TH_MON[th[2]], +th[1], +(th[4] || 0), +(th[5] || 0)).getTime(); }
    const d = Date.parse(s); return isNaN(d) ? 0 : d;
  }
  function ago(ms) {
    if (!ms) return '';
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return 'เมื่อสักครู่';
    if (m < 60) return m + ' นาทีที่แล้ว';
    const h = Math.round(m / 60); if (h < 24) return h + ' ชั่วโมงที่แล้ว';
    const d = Math.round(h / 24); if (d < 30) return d + ' วันที่แล้ว';
    return new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  }
  function renderActivity(fp) {
    const el = $('ovActivity'); if (!el) return;
    const evs = [];
    fp.forEach(p => {
      const rq = p.reportsByQuarter || {};
      Object.keys(rq).forEach(q => {
        const r = rq[q] || {};
        if (!r.lastEditedAt && !r.lastEditedBy) return;
        evs.push({ p, q, who: r.lastEditedBy || 'ผู้ใช้', when: parseWhen(r.lastEditedAt), raw: r.lastEditedAt || '', status: r.status || p.status });
      });
    });
    evs.sort((a, b) => b.when - a.when || (+b.q || 0) - (+a.q || 0));
    const list = evs.slice(0, 6);
    const head = `<div class="ov-card-head"><h3>${svg('pulse', 17)}ความเคลื่อนไหวล่าสุด</h3>${evs.length ? `<button type="button" class="ov-link" onclick="showPage('report')">ดูทั้งหมด</button>` : ''}</div>`;
    if (!list.length) {
      el.innerHTML = head + `<div class="ov-empty"><span>${svg('pulse', 26)}</span><b>ยังไม่มีการรายงานผลการดำเนินงาน</b><p>เมื่อผู้รับผิดชอบบันทึกรายงานผลรายไตรมาส รายการล่าสุดจะแสดงที่นี่</p></div>`;
      return;
    }
    const SL = (typeof STATUS_LABEL !== 'undefined') ? STATUS_LABEL : {};
    el.innerHTML = head + `<ul class="ov-feed">${list.map(e => `
      <li onclick="openDetail(${JSON.stringify(e.p.id).replace(/"/g, '&quot;')})" tabindex="0" onkeydown="if(event.key==='Enter')this.click()">
        <span class="av">${esc((e.who || '?').trim().charAt(0))}</span>
        <div><div class="t"><b>${esc(e.who)}</b> รายงานผล${e.q === 'all' ? '' : 'ไตรมาส ' + esc(e.q)} · <span class="pill ${esc(e.status)}">${esc(SL[e.status] || '')}</span></div>
        <div class="n">${esc(e.p.name || '')}</div></div>
        <time title="${esc(e.raw)}">${ago(e.when) || esc(e.raw)}</time>
      </li>`).join('')}</ul>`;
  }

  // ── ความครบถ้วนของข้อมูลโครงการ (คล้าย "เริ่มต้นใช้งาน" ในภาพตัวอย่าง) ──
  function renderCheck(fp) {
    const el = $('ovCheck'); if (!el) return;
    const has = v => Array.isArray(v) ? v.filter(x => x && (typeof x !== 'object' || Object.values(x).some(Boolean))).length > 0 : !!String(v || '').trim();
    const reported = p => Object.keys(p.reportsByQuarter || {}).length > 0 || p.status !== 'pending';
    const items = [
      ['หลักการและเหตุผล', p => has(p.rationale)],
      ['วัตถุประสงค์', p => has(p.objective)],
      ['เป้าหมาย', p => has(p.targetQuantity) || has(p.target)],
      ['แผนกิจกรรม', p => has(p.activities)],
      ['รายละเอียดงบประมาณ', p => has(p.budgetDetail)],
      ['ตัวชี้วัด (KPI)', p => has(p.kpi)],
      ['รายงานผลการดำเนินงาน', reported],
    ];
    const n = fp.length;
    const rows = items.map(([l, f]) => ({ l, c: fp.filter(f).length }));
    const full = rows.filter(r => n && r.c === n).length;
    const total = rows.reduce((s, r) => s + r.c, 0);
    const p = n ? Math.round(total / (n * rows.length) * 100) : 0;
    el.innerHTML = `
      <div class="ov-card-head"><h3>${svg('list', 17)}ความครบถ้วนของข้อมูล</h3><span class="ov-muted">${full}/${rows.length}</span></div>
      <div class="ov-check-bar" title="ข้อมูลครบ ${p}%"><i style="width:${p}%"></i></div>
      <ul class="ov-check">${rows.map(r => {
        const ok = n && r.c === n;
        return `<li class="${ok ? 'ok' : ''}" onclick="showPage('projects','')" tabindex="0" onkeydown="if(event.key==='Enter')this.click()">
          <span class="dot">${ok ? svg('check', 14) : ''}</span><span class="l">${r.l}</span><span class="c">${r.c}/${n}</span>${svg('chev', 15)}</li>`;
      }).join('')}</ul>`;
  }

  // ── งบตามอนุกรรมการ ─────────────────────────────────────────────
  function renderCom(fp, t) {
    const el = $('ovCom'); if (!el) return;
    let rows = [];
    try {
      if (typeof COM_LIST !== 'undefined' && typeof _comStats === 'function') {
        const map = _comStats(fp);
        rows = [...COM_LIST, (typeof COM_UNASSIGNED !== 'undefined' ? COM_UNASSIGNED : null)].filter(Boolean)
          .map(c => ({ c, d: map[c.key] })).filter(x => x.d && x.d.projects.length);
      }
    } catch (e) { rows = []; }
    const max = Math.max(1, ...rows.map(x => x.d.budget || 0));
    el.innerHTML = `
      <div class="ov-card-head"><h3>${svg('users', 17)}งบตามอนุกรรมการ</h3><button type="button" class="ov-link" onclick="document.getElementById('committeeSummaryCard')&&document.getElementById('committeeSummaryCard').scrollIntoView({behavior:'smooth'})">รายละเอียด</button></div>
      ${rows.length ? `<ul class="ov-com">${rows.map(({ c, d }) => {
        const s = short(d.budget);
        return `<li><div class="top"><span><i style="background:${c.color || 'var(--accent)'}"></i>${esc(c.label)}</span><b title="${fmtFull(d.budget)} บาท">${s.v} ${s.u}</b></div>
          <div class="ov-bar thin"><i style="width:${(d.budget / max * 100).toFixed(1)}%;background:${c.color || 'var(--accent)'}"></i></div>
          <small>${d.projects.length} โครงการ</small></li>`;
      }).join('')}</ul>` : '<div class="ov-empty sm"><p>ยังไม่มีโครงการที่ระบุอนุกรรมการ</p></div>'}`;
  }

  // ── รวม ─────────────────────────────────────────────────────────
  function renderOverview() {
    mount();
    if (!$('ovRoot') || typeof getFilteredProjects !== 'function') return;
    let fp = [];
    try { fp = getFilteredProjects() || []; } catch (e) { fp = []; }
    const t = {
      budget: fp.reduce((s, p) => s + (p.budget || 0), 0),
      spent: fp.reduce((s, p) => s + (p.spent || 0), 0),
      po: fp.reduce((s, p) => s + (p.po || 0), 0),
      done: fp.filter(p => p.status === 'done').length,
      prog: fp.filter(p => p.status === 'progress').length,
      pend: fp.filter(p => p.status === 'pending').length,
    };
    [renderHero, renderKpis, renderRing, renderQuick, renderStatus, renderActivity, renderCheck, renderCom]
      .forEach(fn => { try { fn(fp, t); } catch (e) { console.warn('overview', fn.name, e); } });
    updateUserRole();
  }
  window.renderOverview = renderOverview;

  // ── ตำแหน่งงานใต้ชื่อในปุ่มผู้ใช้ (แบบภาพตัวอย่าง) ───────────────
  function updateUserRole() {
    const btn = $('userPillBtn'); if (!btn) return;
    const nameEl = $('userPillName'); if (!nameEl) return;
    let wrap = btn.querySelector('.up-txt');
    if (!wrap) {
      wrap = document.createElement('span'); wrap.className = 'up-txt';
      nameEl.parentNode.insertBefore(wrap, nameEl); wrap.appendChild(nameEl);
      const r = document.createElement('small'); r.id = 'userPillRole'; wrap.appendChild(r);
    }
    const u = user();
    $('userPillRole').textContent = u ? (u.isGuest ? 'ผู้เยี่ยมชม' : (u.position || 'ผู้ใช้งาน')) : '';
  }

  // ── ค้นหาเมนู/โครงการ (Ctrl+K) ──────────────────────────────────
  function mountSearch() {
    const actions = document.querySelector('.topbar .topbar-actions');
    if (!actions || $('ovSearch')) return;
    const box = document.createElement('div');
    box.className = 'ov-search';
    box.id = 'ovSearch';
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || '');
    box.innerHTML = `${svg('search', 16)}<input type="search" id="ovSearchInput" placeholder="ค้นหาเมนูหรือโครงการ" autocomplete="off" aria-label="ค้นหาเมนูหรือโครงการ" aria-controls="ovSearchList" aria-expanded="false" role="combobox"><kbd>${mac ? '⌘' : 'Ctrl'} K</kbd><ul id="ovSearchList" role="listbox" hidden></ul>`;
    actions.insertBefore(box, actions.firstChild);
    const inp = $('ovSearchInput'), list = $('ovSearchList');
    let items = [], sel = 0;
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    function build(q) {
      q = norm(q);
      const navs = Array.from(document.querySelectorAll('.sidebar .nav-item')).map(n => ({ kind: 'เมนู', label: norm(n.textContent).replace(/^📊\s*/, ''), text: n.textContent.trim().replace(/^📊\s*/, ''), go: () => n.click() }));
      const projs = (typeof projects !== 'undefined' && Array.isArray(projects) ? projects : []).map(p => ({ kind: (typeof S_NAMES !== 'undefined' && S_NAMES[p.strategy]) || 'โครงการ', label: norm(p.name), text: p.name || '', go: () => openDetail(p.id) }));
      const m = x => !q || x.label.includes(q);
      items = navs.filter(m).slice(0, q ? 6 : 8).concat(q ? projs.filter(m).slice(0, 6) : []);
      sel = 0; draw();
    }
    function draw() {
      if (!items.length) { list.innerHTML = '<li class="none">ไม่พบเมนูหรือโครงการที่ค้นหา</li>'; return; }
      let last = '';
      list.innerHTML = items.map((x, i) => {
        const grp = x.kind === 'เมนู' ? 'เมนู' : 'โครงการ';
        const h = grp !== last ? `<li class="grp" role="presentation">${grp}</li>` : ''; last = grp;
        return h + `<li role="option" data-i="${i}" class="${i === sel ? 'sel' : ''}" aria-selected="${i === sel}"><span>${esc(x.text)}</span>${grp === 'โครงการ' ? `<em>${esc(x.kind)}</em>` : ''}</li>`;
      }).join('');
    }
    function open() { list.hidden = false; inp.setAttribute('aria-expanded', 'true'); build(inp.value); }
    function close() { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); }
    function go(i) { const x = items[i]; if (!x) return; close(); inp.value = ''; inp.blur(); x.go(); }
    inp.addEventListener('focus', open);
    inp.addEventListener('input', () => { list.hidden = false; build(inp.value); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
      else if (e.key === 'Escape') { close(); inp.blur(); }
    });
    list.addEventListener('mousedown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); go(+li.dataset.i); } });
    inp.addEventListener('blur', () => setTimeout(close, 120));
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); inp.focus(); inp.select(); }
    });
  }

  // ── ต่อท้ายฟังก์ชันเดิมให้วาดส่วนใหม่ซ้ำ ─────────────────────────
  function after(name) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__ov) return;
    const w = function () { const r = orig.apply(this, arguments); try { renderOverview(); } catch (e) {} return r; };
    w.__ov = true;
    window[name] = w;
  }

  function init() {
    mount();
    mountSearch();
    ['updateDashboard', '_setLoggedIn', 'authLogout'].forEach(after);
    renderOverview();
    // แอนิเมชันตอนเปิดหน้าเล่นครั้งเดียว (ไม่ให้เล่นซ้ำทุกครั้งที่ข้อมูลอัปเดต)
    if (!reduceMotion()) {
      document.documentElement.classList.add('ov-anim');
      setTimeout(() => document.documentElement.classList.remove('ov-anim'), 6000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
