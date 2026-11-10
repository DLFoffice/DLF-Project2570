/* ==========================================================================
   app-select.js — dropdown เลือกโครงการแบบใหม่ (ค้นหาได้ · จัดกลุ่มตามยุทธศาสตร์ · แสดงสถานะรายงาน)
   ทำงานซ้อนบน <select id="reportProjectSelect"> เดิม: select เดิมยังเป็นตัวเก็บค่าจริง
   โค้ดเดิมที่ตั้งค่า sel.value แล้วเรียก onReportProjectChange() จึงใช้ได้เหมือนเดิมทุกจุด
   ใช้ร่วมกันทั้งปี 2570 / 2571 (สีจากตัวแปรธีม)
   ========================================================================== */
(function () {
  'use strict';
  const SEL_ID = 'reportProjectSelect';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const baht = n => Math.round(Number(n) || 0).toLocaleString('th-TH');
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const projs = () => (typeof projects !== 'undefined' && Array.isArray(projects)) ? projects : [];

  let sel, root, trigger, panel, search, list, items = [], active = -1, open = false;

  const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const ICON_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>';
  const ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

  // สถานะรายงานของไตรมาสปัจจุบัน (ถ้ามีโมดูล planperf)
  function repChip(p) {
    const P = window.DLFPerf;
    if (!P || !P.reportState || !P.currentQ) return '';
    const q = P.currentQ();
    const s = P.reportState(p, q);
    const m = { missing: ['ยังไม่รายงาน', 'none'], submitted: ['รายงานแล้ว', 'sub'], approved: ['อนุมัติแล้ว', 'ok'], revise: ['ส่งกลับแก้ไข', 'bad'] }[s];
    return `<span class="dsel-chip ${m[1]}">Q${q} · ${m[0]}</span>`;
  }

  function build() {
    const sNames = typeof S_NAMES !== 'undefined' ? S_NAMES : {};
    const sFull = typeof S_FULL !== 'undefined' ? S_FULL : {};
    const sCol = typeof S_COLORS !== 'undefined' ? S_COLORS : {};
    const byId = {}; projs().forEach(p => { byId[String(p.id)] = p; });
    const html = [];
    items = [];
    Array.from(sel.children).forEach(node => {
      if (node.tagName === 'OPTGROUP') {
        const opts = Array.from(node.children);
        const p0 = byId[opts[0] && opts[0].value];
        const s = p0 ? String(p0.strategy) : '';
        const color = sCol[s] || 'var(--accent)';
        html.push(`<div class="dsel-group" data-g="${esc(s)}"><span class="dsel-gdot" style="background:${color}"></span><b>${esc(sNames[s] || node.label.split('—')[0])}</b><span class="dsel-gfull">${esc(sFull[s] || '')}</span><span class="dsel-gcount">${opts.length}</span></div>`);
        opts.forEach(o => {
          const p = byId[o.value] || {};
          const i = items.length;
          items.push({ value: o.value, text: o.textContent, g: s, hay: norm([o.textContent, p.owner, p.coordinator, sNames[s]].join(' ')) });
          html.push(`<div class="dsel-opt" role="option" data-i="${i}" data-g="${esc(s)}" style="--g:${color}">
            <span class="dsel-bar"></span>
            <div class="dsel-main"><div class="dsel-name">${esc(o.textContent)}</div>
              <div class="dsel-meta">${p.owner ? `<span>${esc(p.owner)}</span>` : ''}${p.budget ? `<span>งบ ${baht(p.budget)} บาท</span>` : ''}${repChip(p)}</div></div>
            <span class="dsel-tick">${ICON_CHECK}</span></div>`);
        });
      }
    });
    list.innerHTML = html.join('') + '<div class="dsel-empty" hidden>ไม่พบโครงการที่ค้นหา</div>';
    syncLabel();
    filter(search.value);
  }

  function syncLabel() {
    const v = sel.value;
    const it = items.find(x => x.value === v);
    const sNames = typeof S_NAMES !== 'undefined' ? S_NAMES : {};
    const sCol = typeof S_COLORS !== 'undefined' ? S_COLORS : {};
    trigger.classList.toggle('has-value', !!it);
    trigger.querySelector('.dsel-tlabel').innerHTML = it
      ? `<span class="dsel-tdot" style="background:${sCol[it.g] || 'var(--accent)'}"></span><span class="dsel-ttext">${esc(it.text)}</span><span class="dsel-tg">${esc(sNames[it.g] || '')}</span>`
      : `<span class="dsel-ticon">${ICON_FOLDER}</span><span class="dsel-ph">เลือกโครงการที่ต้องการรายงานผล…</span>`;
    list.querySelectorAll('.dsel-opt').forEach(el => el.classList.toggle('sel', items[el.dataset.i] && items[el.dataset.i].value === v));
  }

  function visibleOpts() { return Array.from(list.querySelectorAll('.dsel-opt:not([hidden])')); }

  function filter(q) {
    q = norm(q);
    let shown = 0;
    const groupHas = {};
    list.querySelectorAll('.dsel-opt').forEach(el => {
      const it = items[el.dataset.i];
      const ok = !q || q.split(' ').every(w => it.hay.includes(w));
      el.hidden = !ok; if (ok) { shown++; groupHas[it.g] = (groupHas[it.g] || 0) + 1; }
      const nm = el.querySelector('.dsel-name');
      nm.innerHTML = q ? hl(it.text, q) : esc(it.text);
    });
    list.querySelectorAll('.dsel-group').forEach(g => { g.hidden = !groupHas[g.dataset.g]; const c = g.querySelector('.dsel-gcount'); if (c && groupHas[g.dataset.g]) c.textContent = groupHas[g.dataset.g]; });
    list.querySelector('.dsel-empty').hidden = shown > 0;
    const c = root.querySelector('.dsel-count'); if (c) c.textContent = q ? `พบ ${shown} รายการ` : `ทั้งหมด ${items.length} รายการ`;
    setActive(visibleOpts().findIndex(el => el.classList.contains('sel')) >= 0 && !q ? visibleOpts().findIndex(el => el.classList.contains('sel')) : (shown ? 0 : -1), false);
  }
  function hl(text, q) {
    let out = esc(text);
    q.split(' ').filter(Boolean).forEach(w => {
      const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  function setActive(i, scroll) {
    const vis = visibleOpts();
    vis.forEach(el => el.classList.remove('act'));
    active = i;
    if (i >= 0 && vis[i]) {
      vis[i].classList.add('act');
      search.setAttribute('aria-activedescendant', vis[i].id = 'dsel-o' + vis[i].dataset.i);
      if (scroll !== false) vis[i].scrollIntoView({ block: 'nearest' });
    }
  }

  function choose(i) {
    const it = items[i]; if (!it) return;
    close();
    if (sel.value !== it.value) {
      sel.value = it.value;
      sel.dispatchEvent(new Event('change', { bubbles: true })); // เรียก onReportProjectChange() ผ่าน onchange เดิม
    }
    syncLabel();
  }

  function openPanel() {
    if (open) return;
    build();
    open = true; root.classList.add('open'); trigger.setAttribute('aria-expanded', 'true');
    search.value = ''; filter('');
    setTimeout(() => search.focus(), 20);
    const s = list.querySelector('.dsel-opt.sel'); if (s) s.scrollIntoView({ block: 'center' });
  }
  function close() {
    if (!open) return;
    open = false; root.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false');
  }

  function mount() {
    sel = document.getElementById(SEL_ID);
    if (!sel || sel.dataset.dsel) return;
    sel.dataset.dsel = 1;
    root = document.createElement('div');
    root.className = 'dsel';
    root.innerHTML = `
      <button type="button" class="dsel-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="dsel-tlabel"></span><span class="dsel-chev">${ICON_CHEV}</span>
      </button>
      <div class="dsel-panel">
        <div class="dsel-search">${ICON_SEARCH}<input type="text" placeholder="พิมพ์ชื่อโครงการ / ผู้รับผิดชอบ เพื่อค้นหา" role="combobox" aria-autocomplete="list" autocomplete="off"><span class="dsel-count"></span></div>
        <div class="dsel-list" role="listbox"></div>
        <div class="dsel-foot"><span><kbd>↑</kbd><kbd>↓</kbd> เลื่อน</span><span><kbd>Enter</kbd> เลือก</span><span><kbd>Esc</kbd> ปิด</span></div>
      </div>`;
    sel.after(root);
    sel.classList.add('dsel-native');
    trigger = root.querySelector('.dsel-trigger');
    panel = root.querySelector('.dsel-panel');
    search = root.querySelector('.dsel-search input');
    list = root.querySelector('.dsel-list');

    trigger.addEventListener('click', () => open ? close() : openPanel());
    trigger.addEventListener('keydown', e => { if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openPanel(); } });
    search.addEventListener('input', () => filter(search.value));
    search.addEventListener('keydown', e => {
      const vis = visibleOpts();
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(vis.length - 1, active + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (vis[active]) choose(+vis[active].dataset.i); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); }
      else if (e.key === 'Tab') close();
    });
    list.addEventListener('mousemove', e => { const o = e.target.closest('.dsel-opt'); if (o) { const i = visibleOpts().indexOf(o); if (i !== active) setActive(i, false); } });
    list.addEventListener('click', e => { const o = e.target.closest('.dsel-opt'); if (o) choose(+o.dataset.i); });
    document.addEventListener('mousedown', e => { if (open && !root.contains(e.target)) close(); });

    // สร้างรายการใหม่เมื่อโค้ดเดิม render ตัวเลือกใหม่ (renderReportProjectOptions)
    new MutationObserver(() => { build(); }).observe(sel, { childList: true });
    // โค้ดเดิมตั้ง sel.value แล้วเรียก onReportProjectChange() — ใช้จังหวะนั้นอัปเดตป้ายชื่อ
    const o = window.onReportProjectChange;
    if (typeof o === 'function' && !o._dsel) {
      window.onReportProjectChange = function () { const r = o.apply(this, arguments); try { syncLabel(); } catch (e) {} return r; };
      window.onReportProjectChange._dsel = 1;
    }
    build();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
