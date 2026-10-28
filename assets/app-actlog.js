// ══════════════════════════════════════════════════════════════════
// หน้า "ประวัติการแก้ไข" แบบใหม่: ไทม์ไลน์แยกตามวัน · ตัวกรองครบทุกประเภท · ดูการเปลี่ยนแปลงในแถว
// (ไฮไลต์คำที่เพิ่ม/ลบ) · สรุปผู้แก้ไขและโครงการที่แก้บ่อย · ส่งออก CSV
//
// ใช้ข้อมูลและการซิงค์เดิมทั้งหมดใน app-core.js (_readActlog, _syncActlogFromGAS, actlogRecord,
// clearActlog) — ไฟล์นี้แทนที่เฉพาะการแสดงผล renderActlog / showActlogDetail
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAGE = 30;

  const st = { q: '', kind: 'all', user: '', period: 'all', shown: PAGE, open: new Set() };

  // ── ประเภทการกระทำ ─────────────────────────────────────────────
  const KINDS = {
    add:    { label: 'เพิ่ม',     verb: 'เพิ่มโครงการ', icon: '<path d="M12 5v14M5 12h14"/>' },
    edit:   { label: 'แก้ไข',     verb: 'แก้ไข',        icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>' },
    report: { label: 'รายงานผล',  verb: 'รายงานผล',     icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 17v-3M12 17v-6M16 17v-2"/>' },
    del:    { label: 'ลบ',        verb: 'ลบโครงการ',    icon: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/>' },
  };
  function kindOf(a) {
    a = String(a || '');
    if (a === 'เพิ่ม') return 'add';
    if (a === 'แก้ไข') return 'edit';
    if (a === 'รายงานผล' || a === 'ตรวจรายงาน') return 'report';
    if (a.startsWith('ลบ')) return 'del';
    return 'edit';
  }
  function verbOf(l) {
    const k = kindOf(l.action);
    if (l.action === 'ตรวจรายงาน') return 'ตรวจรายงาน';
    if (k === 'del' && l.action !== 'ลบ') return l.action; // เช่น "ลบรายงานผล ไตรมาส 2"
    return KINDS[k].verb;
  }
  const svg = (d, s) => `<svg width="${s || 16}" height="${s || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  // ── เวลา ────────────────────────────────────────────────────────
  function tsOf(l) { const t = new Date(l.ts).getTime(); return isNaN(t) ? 0 : t; }
  function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function dayLabel(t) {
    if (!t) return 'ไม่ทราบวันที่';
    const d = new Date(t), today = new Date(), y = new Date(); y.setDate(today.getDate() - 1);
    const full = d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (dayKey(t) === dayKey(today.getTime())) return 'วันนี้ · ' + full;
    if (dayKey(t) === dayKey(y.getTime())) return 'เมื่อวาน · ' + full;
    return full;
  }
  const timeOf = t => t ? new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '';
  function inPeriod(t) {
    if (st.period === 'all') return true;
    if (!t) return false;
    const now = new Date();
    if (st.period === 'today') return dayKey(t) === dayKey(now.getTime());
    const days = st.period === '7' ? 7 : 30;
    return t >= now.getTime() - days * 864e5;
  }

  // ── แสดงค่าของแต่ละฟิลด์ให้อ่านง่าย ─────────────────────────────
  const MONEY = ['budget', 'spent', 'po'];
  function prettyVal(key, v) {
    v = v == null ? '' : String(v);
    if (v === '' ) return '';
    if (MONEY.includes(key) && v.trim() !== '' && !isNaN(Number(v))) return Number(v).toLocaleString('th-TH') + ' บาท';
    if (key === 'strategy' && typeof S_NAMES !== 'undefined' && S_NAMES[v]) return S_NAMES[v];
    if (key === 'status' && typeof STATUS_LABEL !== 'undefined' && STATUS_LABEL[v]) return STATUS_LABEL[v];
    if (key === 'quarter') return v === 'all' ? 'ทุกไตรมาส' : 'ไตรมาส ' + v;
    if (key === 'progress') return v + '%';
    return v;
  }

  // ── ไฮไลต์คำที่เพิ่ม/ลบ (เทียบเป็นคำ ใช้ตัวตัดคำภาษาไทยของเบราว์เซอร์) ──
  function tokens(s) {
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        return Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(s), x => x.segment);
      }
    } catch (e) {}
    return s.split(/(\s+)/).filter(Boolean);
  }
  function wordDiff(a, b) {
    const A = tokens(a), B = tokens(b);
    if (A.length * B.length > 900000) return null; // ยาวเกินไป แสดงก่อน/หลังแทน
    const n = A.length, m = B.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    const push = (t, s) => { const last = out[out.length - 1]; if (last && last.t === t) { last.s += s; last.k.push(s); } else out.push({ t, s, k: [s] }); };
    while (i < n && j < m) {
      if (A[i] === B[j]) { push('=', A[i]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { push('-', A[i]); i++; }
      else { push('+', B[j]); j++; }
    }
    while (i < n) push('-', A[i++]);
    while (j < m) push('+', B[j++]);
    return out;
  }
  function diffHtml(a, b) {
    const parts = wordDiff(a, b);
    if (!parts) return null;
    const CTX = 60; // ตัวอักษรรอบส่วนที่เปลี่ยน
    return parts.map((p, idx) => {
      if (p.t === '-') return `<del>${esc(p.s)}</del>`;
      if (p.t === '+') return `<ins>${esc(p.s)}</ins>`;
      // ตัดข้อความที่ไม่เปลี่ยนให้สั้นลง โดยตัดตรงรอยต่อของคำ (ไม่ตัดกลางสระ/วรรณยุกต์)
      const s = p.s, k = p.k;
      const first = idx === 0, last = idx === parts.length - 1;
      if (s.length > CTX * 2 + 10 || ((first || last) && s.length > CTX + 10)) {
        const takeHead = () => { let o = '', i = 0; while (i < k.length && o.length < CTX) o += k[i++]; return o; };
        const takeTail = () => { let o = '', i = k.length - 1; while (i >= 0 && o.length < CTX) o = k[i--] + o; return o; };
        const head = first ? '' : takeHead(), tail = last ? '' : takeTail();
        return `<span class="al-same">${esc(head)}</span><span class="al-gap">…</span><span class="al-same">${esc(tail)}</span>`;
      }
      return `<span class="al-same">${esc(s)}</span>`;
    }).join('');
  }
  function fieldDiff(f) {
    const ARR = ['images', 'activities', 'budgetDetail', 'evalRows', 'docFiles', 'committees'];
    const label = `<div class="al-f-label">${esc(f.label || f.key)}</div>`;
    if (ARR.includes(f.key) || (f.from === '(เดิม)' && f.to === '(ใหม่)')) {
      return `<div class="al-f">${label}<div class="al-f-note">มีการเปลี่ยนแปลงข้อมูลในตาราง</div></div>`;
    }
    const a = prettyVal(f.key, f.from), b = prettyVal(f.key, f.to);
    const empty = '<span class="al-empty">(ว่าง)</span>';
    const short = a.length < 70 && b.length < 70 && !/\n/.test(a + b);
    if (short) {
      return `<div class="al-f">${label}<div class="al-f-inline">
        <span class="al-old">${a ? esc(a) : empty}</span>${svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 14)}<span class="al-new">${b ? esc(b) : empty}</span></div></div>`;
    }
    const d = (a && b) ? diffHtml(a, b) : null;
    if (d) return `<div class="al-f">${label}<div class="al-f-text">${d}</div></div>`;
    return `<div class="al-f">${label}<div class="al-f-two">
      <div><em>ก่อน</em><div class="al-old-box">${a ? esc(a) : empty}</div></div>
      <div><em>หลัง</em><div class="al-new-box">${b ? esc(b) : empty}</div></div></div></div>`;
  }

  // ── ข้อมูลหลังกรอง ─────────────────────────────────────────────
  function allLogs() {
    let logs = [];
    try { logs = (typeof _readActlog === 'function') ? _readActlog() : []; } catch (e) { logs = []; }
    return logs.map(l => ({ ...l, _t: tsOf(l), _k: kindOf(l.action), fields: Array.isArray(l.fields) ? l.fields : [] }))
      .sort((a, b) => b._t - a._t);
  }
  function filtered(logs, ignoreKind) {
    const q = st.q.trim().toLowerCase();
    return logs.filter(l =>
      (ignoreKind || st.kind === 'all' || l._k === st.kind) &&
      (!st.user || l.user === st.user) &&
      inPeriod(l._t) &&
      (!q || [l.user, l.projectName, l.email, l.position, l.action, ...l.fields.map(f => f.label)].join(' ').toLowerCase().includes(q)));
  }
  const canEdit = () => { try { return typeof _isEditable === 'function' && _isEditable(); } catch (e) { return false; } };
  const projExists = id => typeof projects !== 'undefined' && Array.isArray(projects) && projects.some(p => String(p.id) === String(id));

  // ── วาด ───────────────────────────────────────────────────────
  function render() {
    if (typeof _syncActlogFromGAS === 'function') { try { _syncActlogFromGAS(); } catch (e) {} }
    if (!$('alRoot')) return;
    const logs = allLogs();
    const base = filtered(logs, true);
    const list = filtered(logs, false);

    // สถานะซิงค์
    const syncing = (typeof _actlogSyncing !== 'undefined' && _actlogSyncing) && !(typeof _actlogRemoteLoaded !== 'undefined' && _actlogRemoteLoaded);
    $('alSync').innerHTML = syncing
      ? `<span class="al-sync busy">${svg('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>', 13)}กำลังซิงค์จาก Google Sheet</span>`
      : `<span class="al-sync">${svg('<path d="m5 12 5 5L20 7"/>', 13)}ซิงค์กับ Google Sheet แล้ว</span>`;

    // ตัวเลขสรุป
    const weekAgo = Date.now() - 7 * 864e5;
    const users = new Set(logs.map(l => l.user));
    const projs = new Set(logs.map(l => String(l.projectId)));
    $('alKpis').innerHTML = [
      ['k1', logs.length, 'รายการทั้งหมด', '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>'],
      ['k2', logs.filter(l => l._t >= weekAgo).length, '7 วันล่าสุด', '<path d="M3 12h4l3-8 4 16 3-8h4"/>'],
      ['k3', users.size, 'ผู้แก้ไข (คน)', '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'],
      ['k4', projs.size, 'โครงการที่มีการเปลี่ยนแปลง', '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'],
    ].map(([c, n, l, ic]) => `<div class="al-kpi ${c}"><span class="ic">${svg(ic, 19)}</span><div><b>${n.toLocaleString('th-TH')}</b><em>${l}</em></div></div>`).join('');

    // ชิปประเภท (นับตามตัวกรองอื่นที่ใช้อยู่)
    const cnt = k => k === 'all' ? base.length : base.filter(l => l._k === k).length;
    $('alKinds').innerHTML = ['all', 'add', 'edit', 'report', 'del'].map(k => {
      const lab = k === 'all' ? 'ทั้งหมด' : KINDS[k].label;
      return `<button type="button" class="al-chip ${k}" data-kind="${k}" aria-pressed="${st.kind === k}">${lab}<span>${cnt(k)}</span></button>`;
    }).join('');

    // ตัวเลือกผู้แก้ไข
    const uSel = $('alUser');
    const names = Array.from(users).sort((a, b) => String(a).localeCompare(String(b), 'th'));
    const want = '<option value="">ผู้แก้ไขทุกคน</option>' + names.map(n => `<option value="${esc(n)}"${n === st.user ? ' selected' : ''}>${esc(n)}</option>`).join('');
    if (uSel.innerHTML !== want) uSel.innerHTML = want;

    // ไทม์ไลน์
    const feed = $('alFeed');
    const hasFilter = st.q || st.kind !== 'all' || st.user || st.period !== 'all';
    if (!list.length) {
      feed.innerHTML = logs.length
        ? `<div class="al-none">${svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', 26)}<b>ไม่พบรายการที่ตรงกับตัวกรอง</b><button type="button" class="al-link" data-reset>ล้างตัวกรอง</button></div>`
        : `<div class="al-none">${svg('<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>', 26)}<b>ยังไม่มีประวัติการแก้ไข</b><p>ประวัติจะแสดงหลังจากมีการเพิ่ม แก้ไข รายงานผล หรือลบโครงการ${syncing ? ' · กำลังซิงค์จาก Google Sheet…' : ''}</p></div>`;
    } else {
      const slice = list.slice(0, st.shown);
      let lastDay = null, html = '';
      slice.forEach(l => {
        const dk = l._t ? dayKey(l._t) : 'x';
        if (dk !== lastDay) {
          if (lastDay !== null) html += '</ol>';
          html += `<h3 class="al-day">${esc(dayLabel(l._t))}</h3><ol class="al-tl">`;
          lastDay = dk;
        }
        html += itemHtml(l);
      });
      html += '</ol>';
      const left = list.length - slice.length;
      if (left > 0) html += `<button type="button" class="al-more" data-more>แสดงเพิ่มอีก ${Math.min(PAGE, left)} รายการ <span>(เหลือ ${left.toLocaleString('th-TH')})</span></button>`;
      feed.innerHTML = html;
    }
    $('alCount').textContent = hasFilter ? `พบ ${list.length.toLocaleString('th-TH')} จาก ${logs.length.toLocaleString('th-TH')} รายการ` : `${logs.length.toLocaleString('th-TH')} รายการ`;
    $('alReset').hidden = !hasFilter;

    renderAside(logs);
  }

  function itemHtml(l) {
    const k = l._k, id = String(l.id);
    const isOpen = st.open.has(id);
    const guest = l.user === 'ผู้เยี่ยมชม';
    const init = guest ? '👁' : esc(String(l.user || '?').trim().charAt(0));
    const fields = l.fields;
    const chips = fields.slice(0, 5).map(f => `<span class="al-fchip">${esc(f.label || f.key)}</span>`).join('') + (fields.length > 5 ? `<span class="al-fchip more">+${fields.length - 5}</span>` : '');
    // ลบเฉพาะรายงานผล (ไม่ใช่ลบโครงการ) → โครงการยังอยู่ ให้คลิกเปิดได้ตามปกติ
    const proj = projExists(l.projectId) && l.action !== 'ลบ'
      ? `<button type="button" class="al-proj" data-proj="${esc(l.projectId)}">${esc(l.projectName)}</button>`
      : `<span class="al-proj gone${l.action === 'ลบ' ? ' removed' : ''}">${esc(l.projectName)}${l.action === 'ลบ' || projExists(l.projectId) ? '' : ' <small>(ไม่พบในระบบแล้ว)</small>'}</span>`;
    let extra = '';
    if (k === 'add') extra = '<span class="al-note">สร้างโครงการใหม่</span>';
    else if (k === 'del' && l.snapshot && l.snapshot.budget) extra = `<span class="al-note">งบประมาณ ${Number(l.snapshot.budget).toLocaleString('th-TH')} บาท</span>`;
    else if (!fields.length && k !== 'del') extra = '<span class="al-note">ไม่มีฟิลด์ที่เปลี่ยนแปลง</span>';
    return `<li class="al-item ${k}">
      <span class="al-dot" title="${esc(KINDS[k].label)}">${svg(KINDS[k].icon, 14)}</span>
      <div class="al-card">
        <div class="al-head">
          <span class="al-av" aria-hidden="true">${init}</span>
          <div class="al-what">
            <div><b class="al-user" data-user="${esc(l.user)}" role="button" tabindex="0" title="ดูเฉพาะของ ${esc(l.user)}">${esc(l.user)}</b> <span class="al-verb">${esc(verbOf(l))}</span> ${proj}</div>
            <div class="al-sub">${l.position ? esc(l.position) + ' · ' : ''}<time datetime="${esc(l.ts)}" title="${l._t ? esc(new Date(l._t).toLocaleString('th-TH')) : esc(l.ts)}">${timeOf(l._t) || esc(l.ts)}</time></div>
          </div>
        </div>
        ${chips || extra ? `<div class="al-fields">${chips}${extra}</div>` : ''}
        ${fields.length ? `<button type="button" class="al-toggle" data-toggle="${esc(id)}" aria-expanded="${isOpen}">${isOpen ? 'ซ่อนการเปลี่ยนแปลง' : 'ดูการเปลี่ยนแปลง ' + fields.length + ' รายการ'}${svg('<path d="m6 9 6 6 6-6"/>', 14)}</button>
        <div class="al-diff"${isOpen ? '' : ' hidden'}>${isOpen ? fields.map(fieldDiff).join('') : ''}</div>` : ''}
      </div>
    </li>`;
  }

  function renderAside(logs) {
    const top = (keyFn, n) => {
      const m = new Map();
      logs.forEach(l => { const k = keyFn(l); if (!k) return; m.set(k, (m.get(k) || 0) + 1); });
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
    };
    const users = top(l => l.user, 5), projs = top(l => l.projectName, 5);
    const bar = (list, attr) => {
      if (!list.length) return '<p class="al-muted">ยังไม่มีข้อมูล</p>';
      const max = list[0][1];
      return `<ul class="al-rank">${list.map(([k, v]) => `<li><button type="button" ${attr}="${esc(k)}"><span class="n">${esc(k)}</span><span class="c">${v}</span></button><div class="b"><i style="width:${(v / max * 100).toFixed(1)}%"></i></div></li>`).join('')}</ul>`;
    };
    $('alTopUsers').innerHTML = bar(users, 'data-user');
    $('alTopProjs').innerHTML = bar(projs, 'data-projq');
    $('alDanger').hidden = !canEdit();
  }

  // ── ส่งออก CSV (ตามตัวกรองที่ใช้อยู่) ───────────────────────────
  function exportCsv() {
    const list = filtered(allLogs(), false);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['วันที่-เวลา', 'ผู้แก้ไข', 'ตำแหน่ง', 'อีเมล', 'การกระทำ', 'รหัสโครงการ', 'โครงการ', 'ฟิลด์ที่เปลี่ยน']]
      .concat(list.map(l => [l._t ? new Date(l._t).toLocaleString('th-TH') : l.ts, l.user, l.position || '', l.email || '', l.action, l.projectId, l.projectName, l.fields.map(f => f.label).join(', ')]));
    const csv = '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ประวัติการแก้ไข_${typeof currentYear !== 'undefined' ? currentYear : ''}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    if (typeof showToast === 'function') showToast(`ส่งออก ${list.length} รายการเป็น CSV แล้ว`, 2200);
  }

  // ── โครงหน้า ──────────────────────────────────────────────────
  function mount() {
    const page = $('page-actlog');
    if (!page || $('alRoot')) return;
    page.classList.add('al-page');
    page.innerHTML = `
      <div id="alRoot">
        <section class="al-hero">
          <div class="al-hero-t">
            <span class="al-hero-ic">${svg('<path d="M12 8v4l3 2"/><path d="M3.05 11a9 9 0 1 1 .5 4M3 4v7h7"/>', 22)}</span>
            <div><h2>ประวัติการแก้ไข</h2><p>บันทึกการเพิ่ม แก้ไข รายงานผล และลบโครงการของผู้ใช้ทุกคน เรียงจากล่าสุด</p></div>
          </div>
          <div class="al-hero-a"><span id="alSync"></span>
            <button type="button" class="btn btn-sm" id="alCsv">${svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', 14)}ส่งออก CSV</button></div>
        </section>
        <div class="al-kpis" id="alKpis"></div>
        <div class="al-grid">
          <section class="al-main">
            <div class="al-tools">
              <div class="al-search">${svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', 15)}<input type="search" id="actlogSearch" placeholder="ค้นหาผู้แก้ไข โครงการ หรือชื่อฟิลด์" aria-label="ค้นหาประวัติ"></div>
              <select id="alUser" class="select-filter" aria-label="ผู้แก้ไข"></select>
              <select id="alPeriod" class="select-filter" aria-label="ช่วงเวลา">
                <option value="all">ทุกช่วงเวลา</option><option value="today">วันนี้</option><option value="7">7 วันล่าสุด</option><option value="30">30 วันล่าสุด</option>
              </select>
            </div>
            <div class="al-kinds-row"><div class="al-kinds" id="alKinds" role="group" aria-label="ประเภทการกระทำ"></div>
              <span class="al-count"><span id="alCount"></span> <button type="button" class="al-link" id="alReset" data-reset hidden>ล้างตัวกรอง</button></span></div>
            <div id="alFeed" class="al-feed" aria-live="polite"></div>
          </section>
          <aside class="al-aside">
            <div class="al-box"><h4>ผู้แก้ไขบ่อยที่สุด</h4><div id="alTopUsers"></div></div>
            <div class="al-box"><h4>โครงการที่แก้ไขบ่อย</h4><div id="alTopProjs"></div></div>
            <div class="al-box al-danger" id="alDanger" hidden>
              <h4>ล้างประวัติ</h4>
              <p>ลบประวัติทั้งหมดของทุกคนที่ใช้ระบบ ไม่สามารถกู้คืนได้ แนะนำให้ส่งออก CSV เก็บไว้ก่อน</p>
              <button type="button" class="btn btn-sm btn-danger" id="alClear">ล้างประวัติทั้งหมด</button>
            </div>
          </aside>
        </div>
      </div>`;

    const root = $('alRoot');
    let tmr;
    $('actlogSearch').addEventListener('input', e => { clearTimeout(tmr); tmr = setTimeout(() => { st.q = e.target.value; st.shown = PAGE; render(); }, 150); });
    $('alUser').addEventListener('change', e => { st.user = e.target.value; st.shown = PAGE; render(); });
    $('alPeriod').addEventListener('change', e => { st.period = e.target.value; st.shown = PAGE; render(); });
    $('alCsv').addEventListener('click', exportCsv);
    $('alClear').addEventListener('click', () => { if (typeof clearActlog === 'function') clearActlog(); });
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-kind],[data-toggle],[data-more],[data-reset],[data-user],[data-projq],[data-proj]');
      if (!t) return;
      if (t.dataset.kind) { st.kind = t.dataset.kind; st.shown = PAGE; render(); }
      else if (t.dataset.toggle) {
        const id = t.dataset.toggle;
        st.open.has(id) ? st.open.delete(id) : st.open.add(id);
        const li = t.closest('.al-item'), box = li && li.querySelector('.al-diff');
        const log = allLogs().find(l => String(l.id) === id);
        if (box && log) {
          const open = st.open.has(id);
          box.hidden = !open;
          box.innerHTML = open ? log.fields.map(fieldDiff).join('') : '';
          t.setAttribute('aria-expanded', String(open));
          t.firstChild.textContent = open ? 'ซ่อนการเปลี่ยนแปลง' : `ดูการเปลี่ยนแปลง ${log.fields.length} รายการ`;
        }
      }
      else if ('more' in t.dataset) { st.shown += PAGE; render(); }
      else if ('reset' in t.dataset) {
        Object.assign(st, { q: '', kind: 'all', user: '', period: 'all', shown: PAGE });
        $('actlogSearch').value = ''; $('alPeriod').value = 'all'; render();
      }
      else if (t.dataset.user !== undefined) { st.user = t.dataset.user; st.shown = PAGE; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else if (t.dataset.projq !== undefined) { st.q = t.dataset.projq; $('actlogSearch').value = st.q; st.shown = PAGE; render(); }
      else if (t.dataset.proj !== undefined && typeof openDetail === 'function') {
        const p = projects.find(x => String(x.id) === t.dataset.proj); if (p) openDetail(p.id);
      }
    });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-user][role=button]')) e.target.click(); });
  }

  // ── แทนที่ฟังก์ชันแสดงผลเดิม ──────────────────────────────────
  window.renderActlog = function () { mount(); render(); };
  window.showActlogDetail = function (id) {
    st.open.add(String(id));
    if (typeof showPage === 'function') showPage('actlog'); else window.renderActlog();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
