// ══════════════════════════════════════════════════════════════════
// ตัวจัดรูปแบบข้อความ (แบบที่ 1: เก็บเป็นข้อความธรรมดา + เครื่องหมาย)
//
//   **ข้อความ**   → ตัวหนา
//   *ข้อความ*     → ตัวเอียง
//   __ข้อความ__   → ขีดเส้นใต้
//   ขึ้นต้นบรรทัดด้วย Tab (หรือเว้นวรรค 4 ช่อง) → ย่อหน้า (กด Tab หลายครั้ง = ย่อลึกขึ้น)
//
// ข้อมูลใน Google Sheet ยังเป็นข้อความธรรมดาที่อ่านรู้เรื่อง ข้อมูลเก่าใช้ได้ทันทีโดยไม่ต้องแปลง
// หน้าพรีวิว / รายงาน / PDF แสดงผลผ่าน dlfRich() ด้านล่าง
//
// + ตั้งค่าหน้ากระดาษสำหรับ PDF (ขอบกระดาษ ขนาดตัวอักษร ระยะบรรทัด ฟอนต์ การจัดข้อความ ย่อหน้าอัตโนมัติ)
//   ฝังเข้าไปในหน้าต่าง "Export รายงาน PDF" อัตโนมัติ และจำค่าไว้ในเครื่องผู้ใช้
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ช่องข้อความยาวที่ได้แถบเครื่องมือ
  const RT_FIELDS = ['fRationale', 'fObjective', 'fTargetQuantity', 'fTarget', 'fExpectedBenefit', 'fResult', 'fProblems', 'fSolutions'];

  // ── แปลงข้อความเป็น HTML ─────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function inline(h) {
    return h
      .replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^\n]+?)__/g, '<u>$1</u>')
      .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  }
  const LIST_RE = /^(\d+(\.\d+)*[.)]?\s|[-•–]\s)/;

  function dlfRich(s) {
    if (s === null || s === undefined) return '';
    const text = String(s).replace(/\r\n?/g, '\n').replace(/\s+$/, '');
    if (!text) return '';
    const lines = text.split('\n').map(line => {
      const m = line.match(/^([ \t\u00a0\u3000]*)(.*)$/);
      const ws = m[1], body = m[2];
      let cols = 0;
      for (const ch of ws) cols += (ch === '\t') ? 4 : 1;
      const level = cols >= 4 ? Math.round(cols / 4) : (cols >= 2 ? 1 : 0);
      let ind = '';
      if (level) ind = `<span class="rt-ind" style="width:${(level * 2.5).toFixed(1)}em"></span>`;
      else if (body.trim() && !LIST_RE.test(body)) ind = '<span class="rt-ind rt-auto"></span>';
      return ind + inline(esc(body));
    });
    return `<span class="rt">${lines.join('<br>')}</span>`;
  }
  // ตัดเครื่องหมายออก (สำหรับที่ที่แสดงได้แค่ข้อความธรรมดา)
  function dlfRichPlain(s) {
    return String(s == null ? '' : s).replace(/\*\*([^\n]+?)\*\*/g, '$1').replace(/__([^\n]+?)__/g, '$1').replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2');
  }
  window.dlfRich = dlfRich;
  window.dlfRichPlain = dlfRichPlain;

  // ── สไตล์ (ใช้สีจากธีม) ─────────────────────────────────────────
  const css = `
    .rt { display:block; }
    .rt .rt-ind { display:inline-block; width:0; }
    .rt strong { font-weight:700; }
    .rt-wrap { position:relative; }
    .rt-bar {
      display:flex; flex-wrap:wrap; align-items:center; gap:2px;
      padding:4px; margin-bottom:6px;
      border:1px solid var(--border2); border-radius:12px; background:var(--surface2);
    }
    .rt-bar button {
      display:inline-flex; align-items:center; justify-content:center; gap:4px;
      min-width:32px; height:30px; padding:0 8px;
      border:none; border-radius:8px; background:transparent; color:var(--text2);
      font:inherit; font-size:13px; cursor:pointer; transition:background .15s, color .15s;
    }
    .rt-bar button:hover { background:var(--surface); color:var(--accent); box-shadow:0 1px 3px rgba(0,0,0,.08); }
    .rt-bar button:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
    .rt-bar button[aria-pressed="true"] { background:var(--accent-light); color:var(--accent); }
    .rt-bar svg { width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
    .rt-bar .sep { width:1px; height:18px; margin:0 4px; background:var(--border2); }
    .rt-bar .rt-b { font-weight:800; } .rt-bar .rt-i { font-style:italic; font-family:Georgia,serif; } .rt-bar .rt-u { text-decoration:underline; }
    .rt-bar .rt-txt { font-size:12px; font-weight:600; }
    .rt-bar .grow { flex:1; }
    .rt-hint { font-size:11.5px; color:var(--text3); margin-top:4px; }
    .rt-hint code { font-family:inherit; background:var(--surface2); border:1px solid var(--border); border-radius:5px; padding:0 4px; color:var(--text2); }
    .rt-preview {
      margin-top:8px; padding:12px 14px;
      border:1px dashed var(--border2); border-radius:12px; background:var(--surface);
      font-size:14px; line-height:1.85; color:var(--text);
    }
    .rt-preview::before { content:'ตัวอย่างการแสดงผล'; display:block; margin-bottom:6px; font-size:11px; font-weight:700; color:var(--accent); }
    .rt-preview:empty::after { content:'— ยังไม่มีข้อความ —'; color:var(--text3); }

    .pdfpg { margin-top:16px; border:1px solid #e4e7ed; border-radius:12px; background:#fafbfd; }
    .pdfpg > summary { list-style:none; cursor:pointer; display:flex; align-items:center; gap:8px; padding:11px 14px; font-size:13px; font-weight:700; color:#2b3242; }
    .pdfpg > summary::-webkit-details-marker { display:none; }
    .pdfpg > summary::after { content:'▾'; margin-left:auto; color:#8a93a6; transition:transform .2s; }
    .pdfpg[open] > summary::after { transform:rotate(180deg); }
    .pdfpg > summary small { font-weight:500; color:#8a93a6; }
    .pdfpg-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 14px; padding:2px 14px 14px; }
    .pdfpg-grid label { min-width:0; display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:600; color:#4a5263; }
    .pdfpg-grid select { width:100%; min-width:0; padding:7px 10px; border:1.5px solid #e4e7ed; border-radius:8px; font:inherit; font-size:13px; font-weight:400; background:#fff; color:#1c2333; }
    .pdfpg-grid .chk { flex-direction:row; align-items:center; gap:8px; grid-column:1/-1; font-weight:500; }
    .pdfpg-grid .chk input { width:16px; height:16px; accent-color:var(--accent, #2563eb); }
    .pdfpg-foot { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:0 14px 12px; font-size:11.5px; color:#8a93a6; }
    .pdfpg-foot button { border:none; background:none; color:#5b6477; font:inherit; font-size:12px; text-decoration:underline; cursor:pointer; }
    @media (max-width:560px) { .pdfpg-grid { grid-template-columns:1fr; } }
    /* หน้าต่าง Export PDF: ใช้สีหลักของธีมแทนสีแดงเดิม */
    #pdfSelectOverlay > div > div:first-child { background:linear-gradient(120deg, var(--accent), var(--accent-2, var(--accent))) !important; }
    #pdfSelectOverlay button[onclick="generateSelectedReportPDF()"] { background:linear-gradient(100deg, var(--accent), var(--accent-2, var(--accent))) !important; box-shadow:0 8px 18px -10px var(--accent) !important; }
  `;
  function injectCss() {
    if (document.getElementById('rt-style')) return;
    const st = document.createElement('style');
    st.id = 'rt-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── แถบเครื่องมือ ───────────────────────────────────────────────
  const I = {
    indent: '<svg viewBox="0 0 24 24"><path d="M21 6H11M21 12H11M21 18H3M3 8l4 4-4 4"/></svg>',
    outdent: '<svg viewBox="0 0 24 24"><path d="M21 6H11M21 12H11M21 18H3M7 8l-4 4 4 4"/></svg>',
    num: '<svg viewBox="0 0 24 24"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
    bullet: '<svg viewBox="0 0 24 24"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  };
  function barHtml() {
    return `
      <button type="button" data-act="bold" class="rt-b" title="ตัวหนา (Ctrl+B)" aria-label="ตัวหนา">B</button>
      <button type="button" data-act="italic" class="rt-i" title="ตัวเอียง (Ctrl+I)" aria-label="ตัวเอียง">I</button>
      <button type="button" data-act="under" class="rt-u" title="ขีดเส้นใต้ (Ctrl+U)" aria-label="ขีดเส้นใต้">U</button>
      <span class="sep"></span>
      <button type="button" data-act="indent" title="ย่อหน้า (Ctrl+])" aria-label="ย่อหน้า">${I.indent}</button>
      <button type="button" data-act="outdent" title="ลดย่อหน้า (Ctrl+[)" aria-label="ลดย่อหน้า">${I.outdent}</button>
      <span class="sep"></span>
      <button type="button" data-act="num" title="ใส่เลขข้อ 1. 2. 3." aria-label="เลขข้อ">${I.num}</button>
      <button type="button" data-act="sub" class="rt-txt" title="ใส่ข้อย่อย ต่อจากข้อล่าสุด เช่น 2.1 2.2" aria-label="ข้อย่อย">1.1</button>
      <button type="button" data-act="bullet" title="สัญลักษณ์หัวข้อ •" aria-label="สัญลักษณ์หัวข้อ">${I.bullet}</button>
      <span class="grow"></span>
      <button type="button" data-act="preview" class="rt-txt" aria-pressed="false" title="แสดงตัวอย่างการแสดงผล">${I.eye}ดูตัวอย่าง</button>`;
  }

  function fire(ta) { ta.dispatchEvent(new Event('input', { bubbles: true })); }

  function wrapSel(ta, mark, placeholder) {
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    const sel = v.slice(s, e);
    const L = mark.length;
    // กดซ้ำ = ยกเลิกรูปแบบ (ทั้งกรณีเลือกรวมเครื่องหมาย และเลือกเฉพาะข้อความข้างใน)
    if (sel.length >= 2 * L && sel.startsWith(mark) && sel.endsWith(mark)) {
      ta.setRangeText(sel.slice(L, -L), s, e, 'select'); fire(ta); return;
    }
    if (v.slice(s - L, s) === mark && v.slice(e, e + L) === mark) {
      ta.setRangeText(sel, s - L, e + L, 'select'); fire(ta); return;
    }
    // ตัดช่องว่างหัวท้ายออกจากส่วนที่ครอบ (กันได้ "** ข้อความ **" ที่ไม่ถูกแปลง)
    const lead = sel.match(/^\s*/)[0], trail = sel.match(/\s*$/)[0];
    const core = sel.slice(lead.length, sel.length - trail.length);
    if (!core) {
      ta.setRangeText(mark + placeholder + mark, s, e, 'end');
      ta.setSelectionRange(s + L, s + L + placeholder.length);
    } else {
      ta.setRangeText(lead + mark + core + mark + trail, s, e, 'select');
    }
    fire(ta);
  }

  // ทำงานทีละบรรทัดที่ถูกเลือก (หรือบรรทัดที่เคอร์เซอร์อยู่)
  function mapLines(ta, fn) {
    const v = ta.value;
    const s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let e = v.indexOf('\n', Math.max(ta.selectionEnd - (ta.selectionEnd > ta.selectionStart && v[ta.selectionEnd - 1] === '\n' ? 1 : 0), ta.selectionStart));
    if (e === -1) e = v.length;
    const before = v.slice(0, s);
    const lines = v.slice(s, e).split('\n');
    const out = fn(lines, before).join('\n');
    ta.setRangeText(out, s, e, 'select');
    if (lines.length === 1) ta.setSelectionRange(s + out.length, s + out.length);
    fire(ta);
  }
  const stripNum = l => l.replace(/^([ \t]*)(\d+(\.\d+)*[.)]?\s+|[-•–]\s+)/, '$1');

  function doAct(ta, act, bar) {
    ta.focus();
    if (act === 'bold') return wrapSel(ta, '**', 'ข้อความตัวหนา');
    if (act === 'italic') return wrapSel(ta, '*', 'ข้อความตัวเอียง');
    if (act === 'under') return wrapSel(ta, '__', 'ข้อความขีดเส้นใต้');
    if (act === 'indent') return mapLines(ta, ls => ls.map(l => '\t' + l));
    if (act === 'outdent') return mapLines(ta, ls => ls.map(l => l.replace(/^(\t| {1,4})/, '')));
    if (act === 'bullet') return mapLines(ta, ls => ls.map(l => {
      const m = l.match(/^([ \t]*)(.*)$/); return m[1] + '• ' + stripNum(m[2]);
    }));
    if (act === 'num') return mapLines(ta, (ls, before) => {
      // ต่อเลขจากข้อหลักล่าสุดด้านบน (เช่น มี 1. 2. อยู่แล้ว → เริ่มที่ 3.)
      const prev = before.split('\n').reverse().find(x => /^\s*\d+\.\s/.test(x) && !/^\s*\d+\.\d/.test(x));
      let n = prev ? parseInt(prev.trim(), 10) + 1 : 1;
      return ls.map(l => { const m = l.match(/^([ \t]*)(.*)$/); return m[1] + (n++) + '. ' + stripNum(m[2]); });
    });
    if (act === 'sub') return mapLines(ta, (ls, before) => {
      // หาข้อล่าสุดด้านบน: ถ้าเป็นข้อหลัก "2." → เริ่ม 2.1 / ถ้าเป็นข้อย่อย "2.3" → ต่อเป็น 2.4
      const prev = before.split('\n').reverse().find(x => /^\s*\d+(\.\d+)?[.\s]/.test(x));
      let major = 1, minor = 1;
      if (prev) {
        const m = prev.trim().match(/^(\d+)(?:\.(\d+))?/);
        major = parseInt(m[1], 10); minor = m[2] ? parseInt(m[2], 10) + 1 : 1;
      }
      return ls.map(l => { const m = l.match(/^([ \t]*)(.*)$/); return m[1] + major + '.' + (minor++) + ' ' + stripNum(m[2]); });
    });
    if (act === 'preview') {
      const pv = ta.parentNode.querySelector('.rt-preview[data-for="' + ta.id + '"]');
      const btn = bar.querySelector('[data-act="preview"]');
      const show = pv.hidden;
      pv.hidden = !show;
      btn.setAttribute('aria-pressed', String(show));
      if (show) pv.innerHTML = dlfRich(ta.value);
    }
  }

  function enhance(id) {
    const ta = document.getElementById(id);
    if (!ta || ta.dataset.rt) return;
    ta.dataset.rt = '1';
    const bar = document.createElement('div');
    bar.className = 'rt-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'จัดรูปแบบข้อความ');
    bar.innerHTML = barHtml();
    ta.parentNode.insertBefore(bar, ta);

    const pv = document.createElement('div');
    pv.className = 'rt-preview';
    pv.dataset.for = id;
    pv.hidden = true;
    // วางตัวอย่างไว้หลังตัวนับ/คำแนะนำของช่องนั้น (ถ้ามี) เพื่อไม่ให้แทรกกลาง
    let anchor = ta;
    while (anchor.nextElementSibling && /form-char-count|form-hint/.test(anchor.nextElementSibling.className)) anchor = anchor.nextElementSibling;
    anchor.after(pv);

    // คลิกปุ่มแล้วไม่ให้ช่องข้อความเสียตำแหน่งที่เลือกไว้
    bar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    bar.addEventListener('click', e => {
      const b = e.target.closest('button[data-act]');
      if (b) doAct(ta, b.dataset.act, bar);
    });
    ta.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const map = { b: 'bold', i: 'italic', u: 'under', ']': 'indent', '[': 'outdent' };
      if (map[k]) { e.preventDefault(); doAct(ta, map[k], bar); }
    });
    ta.addEventListener('input', () => { if (!pv.hidden) pv.innerHTML = dlfRich(ta.value); });
  }

  function addLegend() {
    // คำอธิบายสั้นๆ ใต้ช่องแรกของฟอร์มแผนโครงการ และฟอร์มรายงานผล
    ['fRationale', 'fResult'].forEach(id => {
      const ta = document.getElementById(id);
      if (!ta || ta.parentNode.querySelector('.rt-hint')) return;
      const h = document.createElement('div');
      h.className = 'rt-hint';
      h.innerHTML = 'จัดรูปแบบได้ทุกช่องข้อความยาว: <code>**ตัวหนา**</code> <code>*ตัวเอียง*</code> <code>__ขีดเส้นใต้__</code> · ปุ่มย่อหน้าใส่ Tab หน้าบรรทัด · ข้อมูลใน Google Sheet ยังเป็นข้อความธรรมดา';
      const pv = ta.parentNode.querySelector('.rt-preview[data-for="' + id + '"]');
      (pv || ta).after(h);
    });
  }

  // แก้ตัวนับตัวอักษรไม่อัปเดตตอนเปิดฟอร์มแก้ไข (ค่าในช่องถูกใส่ด้วยโค้ด ซึ่งไม่ทำให้เกิด event input)
  function refreshCounters() {
    if (typeof window.updateCharCount !== 'function') return;
    window.updateCharCount('fRationale', 'fRationaleCount', 2000);
    window.updateCharCount('fName', 'fNameCount', 200);
  }
  function watchFormOpen() {
    const ov = document.getElementById('modalOverlay');
    if (!ov) return;
    new MutationObserver(() => {
      if (ov.classList.contains('open')) {
        refreshCounters();
        // ปิดตัวอย่างที่ค้างจากครั้งก่อน
        ov.querySelectorAll('.rt-preview').forEach(p => { p.hidden = true; });
        ov.querySelectorAll('.rt-bar [data-act="preview"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      }
    }).observe(ov, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  // ════════════════ ตั้งค่าหน้ากระดาษ PDF ════════════════
  const PG_KEY = 'dlf_pdf_page_v1';
  const PG_DEFAULT = { margin: 'normal', size: '100', lh: '1.7', font: 'sarabun', align: 'justify', autoIndent: false };
  const MARGINS = {
    narrow: { label: 'แคบ (1 ซม.)', css: '10mm 10mm 12mm' },
    normal: { label: 'ปกติ (เดิม)', css: '14mm 12mm 16mm' },
    gov: { label: 'หนังสือราชการ (บน 2.5 ซ้าย 3 ขวา 2 ล่าง 2 ซม.)', css: '25mm 20mm 20mm 30mm' },
    wide: { label: 'แบบ Word (2.54 ซม. ทุกด้าน)', css: '25.4mm' },
  };
  function getPg() {
    try { return Object.assign({}, PG_DEFAULT, JSON.parse(localStorage.getItem(PG_KEY) || '{}')); }
    catch (e) { return Object.assign({}, PG_DEFAULT); }
  }
  function setPg(v) { try { localStorage.setItem(PG_KEY, JSON.stringify(v)); } catch (e) {} }

  // CSS ที่หน้าต่างพิมพ์ PDF จะใส่เพิ่ม (เรียกจาก _runPdfExport)
  window.dlfPdfPageCss = function (pageSize) {
    const p = getPg();
    const m = (MARGINS[p.margin] || MARGINS.normal).css;
    const isTH = p.font === 'thsarabun';
    // TH Sarabun มีขนาดตัวเล็กกว่า Sarabun ที่ค่า px เท่ากัน จึงขยายเพิ่มให้ใกล้เคียงกัน
    const zoom = (parseFloat(p.size) / 100) * (isTH ? 1.28 : 1);
    const fontStack = isTH
      ? `'TH Sarabun New','TH SarabunPSK','THSarabunNew','Sarabun',sans-serif`
      : `'Sarabun',sans-serif`;
    return `
  @page { size: ${pageSize}; margin: ${m}; }
  table.pdf-print-table > tbody > tr > td { zoom: ${zoom.toFixed(3)}; }
  ${isTH ? `body, body * { font-family: ${fontStack} !important; }` : ''}
  .rt { line-height: ${p.lh}; text-align: ${p.align === 'justify' ? 'justify' : 'left'}; ${p.align === 'justify' ? 'text-justify: inter-character;' : ''} }
  .rt .rt-ind { display:inline-block; width:0; }
  .rt .rt-ind[style] { }
  .rt .rt-auto { width: ${p.autoIndent ? '2.5em' : '0'}; }
  .rt strong { font-weight:700; }`;
  };
  window.dlfPdfPageSettings = getPg;

  function injectPdfSettings() {
    const anchor = document.getElementById('pdfStrategySelect');
    if (!anchor || document.getElementById('pdfPageSettings')) return;
    const p = getPg();
    const opt = (pairs, cur) => pairs.map(([v, l]) => `<option value="${v}"${String(cur) === v ? ' selected' : ''}>${l}</option>`).join('');
    const d = document.createElement('details');
    d.className = 'pdfpg';
    d.id = 'pdfPageSettings';
    d.innerHTML = `
      <summary>📐 ตั้งค่าหน้ากระดาษ <small>ใช้กับ PDF ทุกแบบ · จำค่าไว้ในเครื่องนี้</small></summary>
      <div class="pdfpg-grid">
        <label>ขอบกระดาษ<select data-k="margin">${opt(Object.keys(MARGINS).map(k => [k, MARGINS[k].label]), p.margin)}</select></label>
        <label>ขนาดตัวอักษร<select data-k="size">${opt([['90', 'เล็ก (90%)'], ['100', 'ปกติ (100%)'], ['110', 'ใหญ่ (110%)'], ['120', 'ใหญ่มาก (120%)']], p.size)}</select></label>
        <label>ระยะห่างบรรทัด (ข้อความยาว)<select data-k="lh">${opt([['1.5', 'แคบ (1.5)'], ['1.7', 'ปกติ (1.7)'], ['2', 'กว้าง (2.0)']], p.lh)}</select></label>
        <label>ฟอนต์<select data-k="font">${opt([['sarabun', 'Sarabun (ค่าเริ่มต้น)'], ['thsarabun', 'TH Sarabun New (ต้องติดตั้งในเครื่อง)']], p.font)}</select></label>
        <label>การจัดข้อความ (ข้อความยาว)<select data-k="align">${opt([['justify', 'เต็มแนว (แบบเอกสารราชการ)'], ['left', 'ชิดซ้าย']], p.align)}</select></label>
        <label class="chk"><input type="checkbox" data-k="autoIndent"${p.autoIndent ? ' checked' : ''}> ย่อหน้าบรรทัดแรกของทุกย่อหน้าอัตโนมัติ (ไม่รวมบรรทัดที่ขึ้นต้นด้วยเลขข้อ)</label>
      </div>
      <div class="pdfpg-foot"><span>ถ้าเลือก TH Sarabun New แต่เครื่องไม่มีฟอนต์ จะใช้ Sarabun แทน</span><button type="button" data-reset>คืนค่าเริ่มต้น</button></div>`;
    anchor.after(d);
    d.addEventListener('change', e => {
      const el = e.target.closest('[data-k]'); if (!el) return;
      const v = getPg();
      v[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
      setPg(v);
    });
    d.querySelector('[data-reset]').addEventListener('click', () => {
      setPg(PG_DEFAULT);
      d.querySelectorAll('[data-k]').forEach(el => {
        const v = PG_DEFAULT[el.dataset.k];
        if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      });
    });
  }

  function init() {
    injectCss();
    RT_FIELDS.forEach(enhance);
    addLegend();
    watchFormOpen();
    injectPdfSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
