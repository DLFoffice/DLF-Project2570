/* ==========================================================================
   app-calendar.js — ปฏิทินงาน (หน้า Dashboard)
   · วันหยุดราชการไทย (ข้อมูลในไฟล์นี้) · กำหนดส่งรายงานรายไตรมาส (คำนวณอัตโนมัติ)
   · งาน/กิจกรรมที่ผู้ใช้เพิ่มเอง → เก็บในชีต Calendar70 / Calendar71 ผ่าน Apps Script
   ใช้ร่วมกันทั้งปี 2570 / 2571 (สีจากตัวแปรธีม)
   ========================================================================== */
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────────────
  //  วันหยุดราชการ (ค.ศ.)
  //  · ต.ค.–ธ.ค. 2569 และทั้งปี 2570: ตามประกาศ ครม. / ธปท.
  //  · ปี 2571: ยังไม่มีประกาศ — ใส่เฉพาะวันหยุดวันที่ตายตัว (tentative)
  //    วันหยุดตามจันทรคติ (มาฆะ/วิสาขะ/อาสาฬหะ/เข้าพรรษา), วันพืชมงคล และวันหยุดพิเศษ
  //    ให้เพิ่มเป็นงานหมวด "วันหยุดหน่วยงาน" ได้เองเมื่อมีประกาศ
  // ──────────────────────────────────────────────────────────────────────
  const HOLIDAYS = [
    ['2026-10-13', 'วันคล้ายวันสวรรคต รัชกาลที่ 9'],
    ['2026-10-23', 'วันปิยมหาราช'],
    ['2026-12-05', 'วันคล้ายวันพระบรมราชสมภพ ร.9 · วันชาติ · วันพ่อแห่งชาติ'],
    ['2026-12-07', 'วันหยุดชดเชยวันพ่อแห่งชาติ'],
    ['2026-12-10', 'วันรัฐธรรมนูญ'],
    ['2026-12-31', 'วันสิ้นปี'],
    ['2027-01-01', 'วันขึ้นปีใหม่'],
    ['2027-02-21', 'วันมาฆบูชา'],
    ['2027-02-22', 'วันหยุดชดเชยวันมาฆบูชา'],
    ['2027-04-06', 'วันจักรี'],
    ['2027-04-13', 'วันสงกรานต์'],
    ['2027-04-14', 'วันสงกรานต์'],
    ['2027-04-15', 'วันสงกรานต์'],
    ['2027-05-04', 'วันฉัตรมงคล'],
    ['2027-05-20', 'วันวิสาขบูชา'],
    ['2027-06-03', 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี'],
    ['2027-07-18', 'วันอาสาฬหบูชา'],
    ['2027-07-19', 'วันเข้าพรรษา'],
    ['2027-07-28', 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว'],
    ['2027-08-12', 'วันเฉลิมพระชนมพรรษา พระพันปีหลวง · วันแม่แห่งชาติ'],
    ['2027-10-13', 'วันคล้ายวันสวรรคต รัชกาลที่ 9'],
    ['2027-10-23', 'วันปิยมหาราช'],
    ['2027-10-25', 'วันหยุดชดเชยวันปิยมหาราช'],
    ['2027-12-05', 'วันคล้ายวันพระบรมราชสมภพ ร.9 · วันชาติ · วันพ่อแห่งชาติ'],
    ['2027-12-06', 'วันหยุดชดเชยวันพ่อแห่งชาติ'],
    ['2027-12-10', 'วันรัฐธรรมนูญ'],
    ['2027-12-31', 'วันสิ้นปี'],
    // ── 2571 (ยังไม่มีประกาศทางการ) ──
    ['2028-01-01', 'วันขึ้นปีใหม่', 1],
    ['2028-04-06', 'วันจักรี', 1],
    ['2028-04-13', 'วันสงกรานต์', 1],
    ['2028-04-14', 'วันสงกรานต์', 1],
    ['2028-04-15', 'วันสงกรานต์', 1],
    ['2028-05-04', 'วันฉัตรมงคล', 1],
    ['2028-06-03', 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี', 1],
    ['2028-07-28', 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', 1],
    ['2028-08-12', 'วันเฉลิมพระชนมพรรษา พระพันปีหลวง · วันแม่แห่งชาติ', 1],
    ['2028-10-13', 'วันคล้ายวันสวรรคต รัชกาลที่ 9', 1],
    ['2028-10-23', 'วันปิยมหาราช', 1],
  ];

  const CATS = {
    meeting:  { label: 'ประชุม', color: '#6366f1' },
    training: { label: 'อบรม / สัมมนา', color: '#0ea5e9' },
    activity: { label: 'กิจกรรมโครงการ', color: '#10b981' },
    deadline: { label: 'กำหนดส่ง / Deadline', color: '#f59e0b' },
    holiday:  { label: 'วันหยุดหน่วยงาน', color: '#ef4444' },
    other:    { label: 'อื่น ๆ', color: '#8b5cf6' },
  };
  // งานที่ต้องส่ง (ใช้กับหมวด "กำหนดส่ง")
  const DELIVERABLES = {
    quarterly: { label: 'รายงานผลการดำเนินงานรายไตรมาส', q: true, page: 'report' },
    annual:    { label: 'รายงานผลการดำเนินงานประจำปี', page: 'report' },
    plan:      { label: 'แผนปฏิบัติการ / คำของบประมาณ', page: 'projects' },
    risk:      { label: 'รายงานผลการบริหารความเสี่ยง', page: 'risk' },
    budget:    { label: 'รายงานการใช้จ่ายงบประมาณ', page: 'report' },
    other:     { label: 'เอกสาร / งานอื่น ๆ' },
  };
  const REMIND_OPTS = [1, 3, 7, 14, 30];
  const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const TH_DOW_L = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const thLong = s => { const d = parse(s); return `${TH_DOW_L[d.getDay()]} ${d.getDate()} ${TH_MONTH[d.getMonth()]} ${d.getFullYear() + 543}`; };
  const thShort = s => { const d = parse(s); return `${d.getDate()} ${TH_MON_S[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)}`; };
  const year = () => (typeof currentYear !== 'undefined' ? Number(currentYear) : 2570);
  const KEY = () => 'dltv_cal_' + year();
  const toast = (m, d) => { if (typeof showToast === 'function') showToast(m, d || 2600); };
  const canEdit = () => { try { return typeof _isEditable === 'function' && _isEditable(); } catch (e) { return false; } };
  const me = () => { try { return (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.email || '').toLowerCase(); } catch (e) { return ''; } };
  const projs = () => (typeof projects !== 'undefined' && Array.isArray(projects)) ? projects : [];

  const ICON = {
    cal: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 10h18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  };
  const svg = (k, s) => `<svg width="${s || 16}" height="${s || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

  // ──────────────────────────────────────────────────────────────────────
  //  STATE
  // ──────────────────────────────────────────────────────────────────────
  const today = iso(new Date());
  const S = { ym: today.slice(0, 7), sel: today, events: [], loaded: false, localOnly: false };
  try { const c = JSON.parse(localStorage.getItem(KEY()) || 'null'); if (c && Array.isArray(c.events)) { S.events = c.events; S.localOnly = !!c.localOnly; } } catch (e) {}
  const saveCache = () => { try { localStorage.setItem(KEY(), JSON.stringify({ events: S.events, localOnly: S.localOnly })); } catch (e) {} };

  // ── รวบรวมทุกอย่างของวันหนึ่ง ──
  function holidaysOn(d) { return HOLIDAYS.filter(h => h[0] === d).map(h => ({ kind: 'holiday', title: h[1], tentative: !!h[2] })); }
  function dueOn(d) {
    const P = window.DLFPerf; if (!P || !P.qDue) return [];
    const out = [];
    for (let q = 1; q <= 4; q++) { if (iso(P.qDue(q)) === d) out.push({ kind: 'due', title: `กำหนดส่งรายงานผล ไตรมาส ${q}`, q }); }
    return out;
  }
  function eventsOn(d) {
    return S.events.filter(e => e.startDate <= d && (e.endDate || e.startDate) >= d)
      .sort((a, b) => (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || String(a.startTime).localeCompare(String(b.startTime)));
  }
  function dayItems(d) { return { hol: holidaysOn(d), due: dueOn(d), ev: eventsOn(d) }; }
  const isOrgHoliday = d => S.events.some(e => e.category === 'holiday' && e.startDate <= d && (e.endDate || e.startDate) >= d);

  // ──────────────────────────────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────────────────────────────
  function render() {
    const el = document.getElementById('ovCal'); if (!el) return;
    const [y, m] = S.ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = iso(d), it = dayItems(ds);
      const out = d.getMonth() !== m - 1;
      if (i >= 35 && out && cells.length >= 35) break; // ไม่ต้องแสดงแถวที่ 6 ถ้าเป็นของเดือนถัดไปทั้งแถว
      const hol = it.hol.length || isOrgHoliday(ds);
      const wk = d.getDay() === 0 || d.getDay() === 6;
      const dots = [];
      if (hol) dots.push('<i class="h"></i>');
      if (it.due.length) dots.push('<i class="d"></i>');
      it.ev.filter(e => e.category !== 'holiday').slice(0, 2).forEach(e => dots.push(`<i style="background:${(CATS[e.category] || CATS.other).color}"></i>`));
      const tip = [...it.hol.map(h => h.title), ...it.due.map(x => x.title), ...it.ev.map(e => e.title)].join('\n');
      cells.push(`<button type="button" class="cal-d${out ? ' out' : ''}${wk ? ' wk' : ''}${hol ? ' hol' : ''}${ds === today ? ' today' : ''}${ds === S.sel ? ' sel' : ''}" data-d="${ds}" title="${esc(tip)}" aria-label="${esc(thLong(ds) + (tip ? ' — ' + tip.replace(/\n/g, ', ') : ''))}">
        <span class="n">${d.getDate()}</span><span class="dots">${dots.slice(0, 3).join('')}</span></button>`);
    }
    const monthHol = HOLIDAYS.filter(h => h[0].startsWith(S.ym)).length;
    el.innerHTML = `
      <div class="ov-card-head"><h3>${svg('cal', 17)}ปฏิทินงาน</h3>
        <div class="cal-head-r">${(() => { const n = reminders().length; return `<button type="button" class="cal-bell${n ? ' on' : ''}" onclick="DLFCal.reminders()" title="งานที่ใกล้ถึงกำหนดส่ง" aria-label="งานที่ใกล้ถึงกำหนดส่ง ${n} รายการ">${svg('bell', 16)}${n ? `<b>${n}</b>` : ''}</button>`; })()}
        ${canEdit() ? `<button type="button" class="cal-add" onclick="DLFCal.add()">${svg('plus', 14)}เพิ่มงาน</button>` : ''}</div></div>
      <div class="cal-body">
        <div class="cal-nav">
          <button type="button" class="cal-ic" onclick="DLFCal.move(-1)" aria-label="เดือนก่อนหน้า">${svg('left', 16)}</button>
          <div class="cal-title"><b>${TH_MONTH[m - 1]}</b> ${y + 543}${monthHol ? `<small>วันหยุด ${monthHol} วัน</small>` : ''}</div>
          <button type="button" class="cal-ic" onclick="DLFCal.move(1)" aria-label="เดือนถัดไป">${svg('right', 16)}</button>
          <button type="button" class="cal-today" onclick="DLFCal.today()">วันนี้</button>
        </div>
        <div class="cal-grid" role="grid">
          ${TH_DOW.map((w, i) => `<span class="cal-w${i === 0 || i === 6 ? ' wk' : ''}">${w}</span>`).join('')}
          ${cells.join('')}
        </div>
        <div class="cal-legend"><span><i class="h"></i>วันหยุด</span><span><i class="d"></i>กำหนดส่งรายงาน</span><span><i class="e"></i>งาน/กิจกรรม</span></div>
        <div class="cal-day" id="calDay">${dayHtml(S.sel)}</div>
        ${upcomingHtml()}
        ${S.localOnly ? '<div class="cal-warn">งานที่เพิ่มถูกเก็บไว้ในเครื่องนี้เท่านั้น — ต้องอัปเดต Apps Script เวอร์ชันปฏิทินก่อน จึงจะแชร์ให้ทุกคนเห็น</div>' : ''}
      </div>`;
    el.querySelectorAll('.cal-d').forEach(b => b.addEventListener('click', () => select(b.dataset.d)));
    el.querySelector('.cal-grid').addEventListener('keydown', gridKey);
  }

  function itemHtml(x) {
    if (x.kind === 'holiday') return `<li class="cal-it hol"><span class="bar"></span><div><b>${esc(x.title)}</b><small>วันหยุดราชการ${x.tentative ? ' · ยังไม่มีประกาศทางการ' : ''}</small></div></li>`;
    if (x.kind === 'due') return `<li class="cal-it due" onclick="showPage('track')" role="button" tabindex="0"><span class="bar"></span><div><b>${esc(x.title)}</b><small>ดูสถานะการส่งในหน้า "ติดตามและวิเคราะห์ผล"</small></div></li>`;
    const c = CATS[x.category] || CATS.other;
    const time = x.allDay ? 'ทั้งวัน' : [x.startTime, x.endTime].filter(Boolean).join(' – ') + ' น.';
    const multi = x.endDate && x.endDate !== x.startDate ? ` · ${thShort(x.startDate)} – ${thShort(x.endDate)}` : '';
    return `<li class="cal-it ev" style="--c:${c.color}" onclick="DLFCal.view('${esc(x.id)}')" role="button" tabindex="0"><span class="bar"></span>
      <div><b>${esc(x.title)}</b><small>${svg('clock', 12)}${esc(time)}${esc(multi)}${x.location ? ` · ${svg('pin', 12)}${esc(x.location)}` : ''}</small></div>
      <span class="cat">${esc(c.label)}</span></li>`;
  }
  function dayHtml(d) {
    const it = dayItems(d);
    const all = [...it.hol, ...it.due, ...it.ev.map(e => ({ ...e, kind: 'ev' }))];
    return `<div class="cal-day-h"><b>${thLong(d)}</b>${d === today ? '<span class="cal-pill">วันนี้</span>' : ''}</div>
      ${all.length ? `<ul class="cal-list">${all.map(itemHtml).join('')}</ul>`
        : `<div class="cal-none">ไม่มีงานในวันนี้${canEdit() ? ` · <button type="button" class="ov-link" onclick="DLFCal.add('${d}')">เพิ่มงาน</button>` : ''}</div>`}`;
  }
  function upcomingHtml() {
    const list = [];
    for (let i = 1; i <= 45 && list.length < 4; i++) {
      const d = addDays(today, i), it = dayItems(d);
      it.hol.forEach(h => list.push({ d, x: h }));
      it.due.forEach(h => list.push({ d, x: h }));
      it.ev.filter(e => e.startDate === d).forEach(e => list.push({ d, x: { ...e, kind: 'ev' } }));
    }
    if (!list.length) return '';
    return `<div class="cal-up"><div class="cal-up-h">กำลังจะมาถึง</div>${list.slice(0, 4).map(({ d, x }) => {
      const dt = parse(d), color = x.kind === 'holiday' ? 'var(--red)' : x.kind === 'due' ? 'var(--amber)' : (CATS[x.category] || CATS.other).color;
      return `<button type="button" class="cal-up-i" onclick="DLFCal.go('${d}')"><span class="dd" style="--c:${color}"><b>${dt.getDate()}</b><small>${TH_MON_S[dt.getMonth()]}</small></span>
        <span class="tt"><b>${esc(x.title)}</b><small>${x.kind === 'holiday' ? 'วันหยุดราชการ' : x.kind === 'due' ? 'กำหนดส่งรายงาน' : esc((CATS[x.category] || CATS.other).label)} · อีก ${Math.round((dt - parse(today)) / 864e5)} วัน</small></span></button>`;
    }).join('')}</div>`;
  }

  function select(d) {
    S.sel = d;
    if (d.slice(0, 7) !== S.ym) { S.ym = d.slice(0, 7); render(); focusSel(); return; }
    document.querySelectorAll('#ovCal .cal-d').forEach(b => b.classList.toggle('sel', b.dataset.d === d));
    const box = document.getElementById('calDay'); if (box) box.innerHTML = dayHtml(d);
  }
  function focusSel() { const b = document.querySelector(`#ovCal .cal-d[data-d="${S.sel}"]`); if (b) b.focus(); }
  function gridKey(e) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault(); select(addDays(S.sel, step)); focusSel();
  }
  function move(n) { const [y, m] = S.ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); S.ym = iso(d).slice(0, 7); render(); }

  // ──────────────────────────────────────────────────────────────────────
  //  โหลด / บันทึก (Apps Script)
  // ──────────────────────────────────────────────────────────────────────
  async function load() {
    if (typeof GAS_ENABLED === 'undefined' || !GAS_ENABLED || typeof gasFetchPost !== 'function') { render(); autoRemind(); return; }
    try {
      const res = await gasFetchPost('getAllEvents', {});
      if (res && res.success && Array.isArray(res.data)) {
        const pending = S.localOnly ? S.events.filter(e => e._local) : [];
        S.events = res.data.concat(pending); S.loaded = true;
        saveCache();
      } else if (res && /Unknown action/i.test(res.message || '')) {
        S.localOnly = true; saveCache();
      }
    } catch (e) { /* ออฟไลน์: ใช้ข้อมูลที่เก็บไว้ในเครื่อง */ }
    render();
    autoRemind();
  }

  async function persist(action, data) {
    if (typeof GAS_ENABLED === 'undefined' || !GAS_ENABLED || typeof gasFetchPost !== 'function') return { local: true };
    const res = await gasFetchPost(action, data);
    if (res && res.success) return { ok: true, res };
    if (res && /Unknown action/i.test(res.message || '')) return { local: true };
    throw Object.assign(new Error((res && res.message) || 'บันทึกไม่สำเร็จ'), { shown: false });
  }

  // ──────────────────────────────────────────────────────────────────────
  //  MODAL: ดู / เพิ่ม / แก้ไข
  // ──────────────────────────────────────────────────────────────────────
  function modal(html, cls) {
    closeModal();
    const ov = document.createElement('div'); ov.className = 'cal-ov'; ov.id = 'calOv';
    ov.innerHTML = `<div class="cal-m ${cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(); });
    document.addEventListener('keydown', escClose);
    return ov;
  }
  function escClose(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() { const o = document.getElementById('calOv'); if (o) o.remove(); document.removeEventListener('keydown', escClose); }

  function form(ev) {
    if (!canEdit()) { toast('🔒 ไม่อนุญาต · กรุณาเข้าสู่ระบบก่อนเพิ่มงาน'); return; }
    const e = Object.assign({ title: '', startDate: S.sel || today, endDate: '', allDay: true, startTime: '09:00', endTime: '12:00', category: 'meeting', projectId: '', location: '', note: '', deliverable: 'quarterly', quarter: '', remindDays: 7 }, ev || {});
    if (!e.quarter && window.DLFPerf && DLFPerf.currentQ) e.quarter = String(DLFPerf.currentQ());
    const isEdit = !!(ev && ev.id);
    const ov = modal(`
      <div class="cal-m-h"><h3>${isEdit ? 'แก้ไขงาน' : 'เพิ่มงานในปฏิทิน'}</h3><button type="button" class="cal-ic" data-x aria-label="ปิด">${svg('x', 16)}</button></div>
      <form class="cal-f" novalidate>
        <label class="full"><span class="lb">ชื่องาน <em>*</em></span><input name="title" maxlength="200" required value="${esc(e.title)}" placeholder="เช่น ประชุมคณะอนุกรรมการ ครั้งที่ 1/2570"></label>
        <div class="full cal-cats">${Object.entries(CATS).map(([k, c]) => `<label class="cal-cat" style="--c:${c.color}"><input type="radio" name="category" value="${k}" ${e.category === k ? 'checked' : ''}><span>${esc(c.label)}</span></label>`).join('')}</div>
        <div class="full cal-dl" hidden>
          <div class="cal-dl-h">${svg('bell', 15)} รายละเอียดงานที่ต้องส่ง <small>ระบบจะแสดง popup แจ้งเตือนผู้ใช้ก่อนถึงกำหนด</small></div>
          <div class="cal-dl-g">
            <label class="cal-dl-w"><span class="lb">งานที่ต้องส่ง</span><select name="deliverable">${Object.entries(DELIVERABLES).map(([k, v]) => `<option value="${k}" ${e.deliverable === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
            <label class="cal-dl-q"><span class="lb">ไตรมาส</span><select name="quarter">${[1, 2, 3, 4].map(q => `<option value="${q}" ${String(e.quarter) === String(q) ? 'selected' : ''}>ไตรมาส ${q}</option>`).join('')}</select></label>
            <label><span class="lb">แจ้งเตือนล่วงหน้า</span><select name="remindDays">${REMIND_OPTS.map(n => `<option value="${n}" ${Number(e.remindDays || 7) === n ? 'selected' : ''}>${n} วัน</option>`).join('')}</select></label>
          </div>
        </div>
        <label><span class="lb">วันที่เริ่ม <em>*</em></span><input type="date" name="startDate" required value="${esc(e.startDate)}"></label>
        <label><span class="lb">ถึงวันที่ <small>(ถ้าหลายวัน)</small></span><input type="date" name="endDate" value="${esc(e.endDate && e.endDate !== e.startDate ? e.endDate : '')}"></label>
        <label class="full cal-switch"><input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''}><span class="sw"></span>ทั้งวัน</label>
        <label class="cal-time"><span class="lb">เวลาเริ่ม</span><input type="time" name="startTime" value="${esc(e.startTime || '')}"></label>
        <label class="cal-time"><span class="lb">เวลาสิ้นสุด</span><input type="time" name="endTime" value="${esc(e.endTime || '')}"></label>
        <label class="full"><span class="lb">โครงการที่เกี่ยวข้อง <small>(ไม่บังคับ)</small></span><select name="projectId"><option value="">— ไม่ระบุ —</option>${projs().map(p => `<option value="${esc(p.id)}" ${String(p.id) === String(e.projectId) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="full"><span class="lb">สถานที่</span><input name="location" maxlength="200" value="${esc(e.location)}" placeholder="เช่น ห้องประชุม 1 / Zoom"></label>
        <label class="full"><span class="lb">รายละเอียด</span><textarea name="note" rows="3" maxlength="2000" placeholder="วาระ ผู้เข้าร่วม สิ่งที่ต้องเตรียม">${esc(e.note)}</textarea></label>
        <div class="full cal-err" hidden></div>
        <div class="full cal-m-btns"><button type="button" class="btn btn-sm" data-x>ยกเลิก</button><button type="submit" class="btn btn-sm btn-primary">${isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มงาน'}</button></div>
      </form>`);
    const f = ov.querySelector('form');
    const syncTime = () => ov.querySelectorAll('.cal-time').forEach(x => { x.hidden = f.allDay.checked; });
    f.allDay.addEventListener('change', syncTime); syncTime();
    // หมวด "กำหนดส่ง": แสดงช่องรายละเอียดงานที่ต้องส่ง + เติมชื่องานให้อัตโนมัติถ้ายังว่าง
    const dlBox = ov.querySelector('.cal-dl');
    let autoTitle = !e.title;
    const suggest = () => {
      const dv = DELIVERABLES[f.deliverable.value] || DELIVERABLES.other;
      ov.querySelector('.cal-dl-q').hidden = !dv.q;
      if (autoTitle && f.deliverable.value !== 'other') f.title.value = 'ส่ง' + dv.label + (dv.q ? ' ไตรมาส ' + f.quarter.value : '') + ' ปีงบประมาณ ' + year();
    };
    const syncCat = () => { const on = f.category.value === 'deadline'; dlBox.hidden = !on; f.note.placeholder = on ? 'สิ่งที่ต้องส่ง รูปแบบไฟล์ ช่องทางการส่ง ผู้รับ เช่น ส่งไฟล์ PDF ทางระบบ / อีเมล กลุ่มงานนโยบายและแผน' : 'วาระ ผู้เข้าร่วม สิ่งที่ต้องเตรียม'; if (on) suggest(); else if (autoTitle) f.title.value = ''; };
    f.addEventListener('change', ev3 => { if (ev3.target.name === 'category') syncCat(); if (['deliverable', 'quarter'].includes(ev3.target.name)) suggest(); });
    f.title.addEventListener('input', () => { autoTitle = !f.title.value.trim(); });
    syncCat();
    ov.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', closeModal));
    setTimeout(() => f.title.focus(), 30);
    f.addEventListener('submit', async ev2 => {
      ev2.preventDefault();
      const err = ov.querySelector('.cal-err');
      const d = {
        id: e.id || '', title: f.title.value.trim(), category: (f.category.value || 'other'),
        startDate: f.startDate.value, endDate: f.endDate.value || f.startDate.value, allDay: f.allDay.checked,
        startTime: f.allDay.checked ? '' : f.startTime.value, endTime: f.allDay.checked ? '' : f.endTime.value,
        projectId: f.projectId.value, location: f.location.value.trim(), note: f.note.value.trim(),
        deliverable: '', quarter: '', remindDays: ''
      };
      if (d.category === 'deadline') {
        d.deliverable = f.deliverable.value;
        d.quarter = (DELIVERABLES[d.deliverable] || {}).q ? f.quarter.value : '';
        d.remindDays = Number(f.remindDays.value) || 7;
      }
      const bad = !d.title ? 'กรุณากรอกชื่องาน' : !d.startDate ? 'กรุณาเลือกวันที่เริ่ม'
        : d.endDate < d.startDate ? 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม'
        : (!d.allDay && d.startTime && d.endTime && d.endTime <= d.startTime && d.endDate === d.startDate) ? 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' : '';
      if (bad) { err.hidden = false; err.textContent = bad; return; }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      toast('⏳ กำลังบันทึกข้อมูล...', 8000);
      try {
        const r = await persist('saveEvent', d);
        let rec;
        if (r.local) { rec = { ...d, id: d.id || ('local' + Date.now()), _local: true, createdBy: me() }; S.localOnly = true; }
        else rec = r.res.data;
        const i = S.events.findIndex(x => x.id === rec.id);
        if (i >= 0) S.events[i] = rec; else S.events.push(rec);
        saveCache(); closeModal();
        S.sel = rec.startDate; S.ym = rec.startDate.slice(0, 7); render();
        toast(isEdit ? '✅ แก้ไขงานสำเร็จ' : '✅ เพิ่มงานในปฏิทินสำเร็จ');
      } catch (e2) {
        btn.disabled = false;
        if (!e2.code) toast('❌ บันทึกข้อมูลไม่สำเร็จ · ' + (e2.message || 'เชื่อมต่อไม่ได้'), 3500);
      }
    });
  }

  function view(id) {
    const e = S.events.find(x => x.id === id); if (!e) return;
    const c = CATS[e.category] || CATS.other;
    const p = e.projectId ? projs().find(x => String(x.id) === String(e.projectId)) : null;
    const when = (e.endDate && e.endDate !== e.startDate ? `${thLong(e.startDate)} – ${thLong(e.endDate)}` : thLong(e.startDate))
      + (e.allDay ? ' · ทั้งวัน' : (e.startTime ? ` · ${e.startTime}${e.endTime ? ' – ' + e.endTime : ''} น.` : ''));
    const ov = modal(`
      <div class="cal-m-h"><span class="cal-chip" style="--c:${c.color}">${esc(c.label)}</span><button type="button" class="cal-ic" data-x aria-label="ปิด">${svg('x', 16)}</button></div>
      <h3 class="cal-v-t">${esc(e.title)}</h3>
      <ul class="cal-v">
        <li>${svg('clock', 15)}<span>${esc(when)}</span></li>
        ${e.category === 'deadline' && e.deliverable ? `<li>${svg('bell', 15)}<span>งานที่ต้องส่ง: <b>${esc((DELIVERABLES[e.deliverable] || DELIVERABLES.other).label)}${e.quarter ? ' ไตรมาส ' + esc(e.quarter) : ''}</b> · แจ้งเตือนล่วงหน้า ${esc(e.remindDays || 7)} วัน</span></li>` : ''}
        ${e.location ? `<li>${svg('pin', 15)}<span>${esc(e.location)}</span></li>` : ''}
        ${p ? `<li>${svg('cal', 15)}<span>โครงการ: <a href="#" onclick="event.preventDefault();DLFCal.close();openDetail(${p.id})">${esc(p.name)}</a></span></li>` : ''}
      </ul>
      ${e.note ? `<div class="cal-v-note">${esc(e.note)}</div>` : ''}
      <div class="cal-v-by">${e.createdBy ? 'เพิ่มโดย ' + esc(e.createdBy) : ''}${e._local ? ' · เก็บในเครื่องนี้เท่านั้น' : ''}</div>
      ${canEdit() ? `<div class="cal-m-btns"><button type="button" class="btn btn-sm cal-del">${svg('trash', 14)} ลบ</button><button type="button" class="btn btn-sm btn-primary cal-edit">${svg('edit', 14)} แก้ไข</button></div>` : ''}`, 'view');
    ov.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', closeModal));
    const ed = ov.querySelector('.cal-edit'); if (ed) ed.addEventListener('click', () => form(e));
    const del = ov.querySelector('.cal-del');
    if (del) del.addEventListener('click', async () => {
      if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.innerHTML = 'กดอีกครั้งเพื่อยืนยันการลบ'; del.classList.add('danger'); return; }
      del.disabled = true;
      toast('⏳ กำลังลบข้อมูล...', 8000);
      try {
        if (!e._local) await persist('deleteEvent', { id: e.id });
        S.events = S.events.filter(x => x.id !== e.id); saveCache(); closeModal(); render();
        toast('✅ ลบงานสำเร็จ');
      } catch (err) { del.disabled = false; if (!err.code) toast('❌ ลบไม่สำเร็จ · ' + (err.message || ''), 3500); }
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  //  🔔 แจ้งเตือนกำหนดส่งงาน
  //  · งานหมวด "กำหนดส่ง" ที่ใกล้ถึง (ตามจำนวนวันแจ้งเตือนล่วงหน้า) หรือเลยกำหนดไม่เกิน 7 วัน
  //  · กำหนดส่งรายงานผลรายไตรมาส (ภายใน 14 วัน หรือเลยกำหนดแล้วแต่ยังมีโครงการไม่ส่ง)
  // ──────────────────────────────────────────────────────────────────────
  const daysLeft = d => Math.round((parse(d) - parse(today)) / 864e5);
  function reminders() {
    const out = [];
    S.events.filter(e => e.category === 'deadline').forEach(e => {
      const due = e.endDate || e.startDate, n = daysLeft(due), w = Number(e.remindDays) || 7;
      if (n <= w && n >= -7) out.push({ type: 'ev', id: e.id, due, n, title: e.title, deliverable: e.deliverable, quarter: e.quarter, note: e.note, time: e.allDay ? '' : e.endTime || e.startTime, projectId: e.projectId });
    });
    const P = window.DLFPerf;
    if (P && P.qDue && P.reportState) {
      for (let q = 1; q <= 4; q++) {
        const due = iso(P.qDue(q)), n = daysLeft(due);
        const ps = projs(), miss = ps.filter(p => P.reportState(p, q) === 'missing').length;
        if ((n <= 14 && n >= 0) || (n < 0 && n >= -45 && miss > 0)) {
          out.push({ type: 'due', q, due, n, miss, total: ps.length,
            title: q === 4 ? 'ส่งรายงานผลการดำเนินงาน ไตรมาส 4 และสรุปผลประจำปี' : `ส่งรายงานผลการดำเนินงาน ไตรมาส ${q}`,
            deliverable: 'quarterly', quarter: q });
        }
      }
    }
    return out.sort((a, b) => a.n - b.n);
  }
  function countdown(n) {
    if (n < 0) return ['เลยกำหนด ' + (-n) + ' วัน', 'late'];
    if (n === 0) return ['ครบกำหนดวันนี้', 'today'];
    if (n === 1) return ['พรุ่งนี้', 'soon'];
    return ['อีก ' + n + ' วัน', n <= 3 ? 'soon' : 'ok'];
  }
  function showReminders(auto) {
    const list = reminders();
    if (!list.length) { if (!auto) toast('✅ ไม่มีงานที่ใกล้ถึงกำหนดส่ง'); return; }
    const ov = modal(`
      <div class="cal-rm-hero">
        <div class="cal-rm-bell">${svg('bell', 26)}</div>
        <div><h3>แจ้งเตือนกำหนดส่งงาน</h3><p>มี <b>${list.length}</b> งานที่ใกล้ถึงกำหนดหรือเลยกำหนดส่ง</p></div>
        <button type="button" class="cal-ic" data-x aria-label="ปิด">${svg('x', 16)}</button>
      </div>
      <ul class="cal-rm">${list.map((x, i) => {
        const [cd, cls] = countdown(x.n);
        const dv = x.deliverable ? (DELIVERABLES[x.deliverable] || DELIVERABLES.other) : null;
        const p = x.projectId ? projs().find(pp => String(pp.id) === String(x.projectId)) : null;
        const sent = x.type === 'due' ? x.total - x.miss : 0;
        return `<li class="cal-rm-i ${cls}" style="animation-delay:${0.08 + i * 0.06}s">
          <div class="cal-rm-top"><span class="cal-rm-cd">${cd}</span><span class="cal-rm-date">${svg('cal', 13)} ${esc(thLong(x.due))}${x.time ? ' · ' + esc(x.time) + ' น.' : ''}</span></div>
          <b class="cal-rm-t">${esc(x.title)}</b>
          ${dv ? `<div class="cal-rm-dv">📄 ${esc(dv.label)}${x.quarter ? ' · ไตรมาส ' + esc(x.quarter) : ''}${p ? ' · โครงการ ' + esc(p.name) : ''}</div>` : ''}
          ${x.type === 'due' ? `<div class="cal-rm-prog"><div class="cal-rm-bar"><i style="width:${x.total ? sent / x.total * 100 : 0}%"></i></div>
              <span>ส่งแล้ว <b>${sent}</b>/${x.total} โครงการ${x.miss ? ` · ยังไม่ส่ง <b class="r">${x.miss}</b>` : ' · ครบทุกโครงการ'}</span></div>` : ''}
          ${x.note ? `<div class="cal-rm-note">${esc(x.note)}</div>` : ''}
          <div class="cal-rm-act">
            ${x.type === 'due' ? `<button type="button" class="btn btn-sm" data-go="track" data-q="${x.q}">ดูรายชื่อที่ยังไม่ส่ง</button><button type="button" class="btn btn-sm btn-primary" data-go="report">กรอกรายงานผล</button>`
              : `<button type="button" class="btn btn-sm" data-ev="${esc(x.id)}">รายละเอียด</button>${dv && dv.page ? `<button type="button" class="btn btn-sm btn-primary" data-go="${dv.page}">ไปที่หน้า${dv.page === 'report' ? 'รายงานผล' : dv.page === 'risk' ? 'บริหารความเสี่ยง' : 'โครงการ'}</button>` : ''}`}
          </div></li>`;
      }).join('')}</ul>
      <div class="cal-rm-foot"><label><input type="checkbox" class="cal-rm-mute" ${auto ? 'checked' : ''}> ไม่ต้องแจ้งเตือนอีกในวันนี้</label><button type="button" class="btn btn-sm btn-primary" data-x>รับทราบ</button></div>`, 'remind');
    const close = () => {
      try { if (ov.querySelector('.cal-rm-mute').checked) localStorage.setItem('dltv_remind_' + year(), JSON.stringify({ d: today, sig: sig(list) })); else localStorage.removeItem('dltv_remind_' + year()); } catch (e) {}
      closeModal();
    };
    ov.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', close));
    ov.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
      close();
      const pg = b.dataset.go;
      if (pg === 'track') { showPage('track'); if (window.DLFPerf && DLFPerf.quarter) { DLFPerf.quarter(Number(b.dataset.q)); DLFPerf.filter('missing'); } }
      else if (pg === 'risk') showPage('risk');
      else if (pg === 'projects') showPage('projects', '');
      else showPage('report');
    }));
    ov.querySelectorAll('[data-ev]').forEach(b => b.addEventListener('click', () => { close(); view(b.dataset.ev); }));
  }
  const sig = list => list.map(x => (x.id || 'q' + x.q) + ':' + x.n).join('|');
  // แสดงอัตโนมัติวันละครั้ง (หรือเมื่อมีงานใหม่) หลังล็อกอิน — รอให้ popup ต้อนรับปิดก่อน
  let _autoTimer = null;
  function autoRemind() {
    clearTimeout(_autoTimer);
    let tries = 0;
    const tick = () => {
      if (!canEdit()) return;
      const busy = document.querySelector('._wlc-overlay, .auth-overlay.open, #calOv, .modal-overlay.open');
      if (busy && tries++ < 40) { _autoTimer = setTimeout(tick, 500); return; }
      const list = reminders(); if (!list.length) return;
      try { const m = JSON.parse(localStorage.getItem('dltv_remind_' + year()) || 'null'); if (m && m.d === today && m.sig === sig(list)) return; } catch (e) {}
      showReminders(true);
    };
    _autoTimer = setTimeout(tick, 1200);
  }

  window.DLFCal = {
    render, load,
    move, go: d => select(d), today: () => { S.ym = today.slice(0, 7); S.sel = today; render(); },
    add: d => { if (d) S.sel = d; form(); }, view, close: closeModal,
    reminders: () => showReminders(false), autoRemind,
  };

  // โหลดงานเมื่อเปิดหน้า และหลังล็อกอิน/ออกจากระบบ (ปุ่ม "เพิ่มงาน" แสดงตามสิทธิ์)
  function init() {
    load();
    ['_setLoggedIn', 'authLogout'].forEach(fn => {
      const o = window[fn];
      if (typeof o === 'function' && !o._cal) { window[fn] = function () { const r = o.apply(this, arguments); setTimeout(render, 60); if (fn === '_setLoggedIn') autoRemind(); return r; }; window[fn]._cal = 1; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
