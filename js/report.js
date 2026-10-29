/* Generador del informe PDF (pdf-lib, 100% offline) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./scoring.js'));
  else root.WiscReport = factory(root.Wisc);
})(typeof self !== 'undefined' ? self : this, function (Wisc) {
  'use strict';

  const W = 595.28, H = 841.89, M = 40, CW = W - M * 2;

  function hex(PDFLib, h) {
    const n = parseInt(h.slice(1), 16);
    return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  // Las fuentes estándar del PDF solo admiten WinAnsi
  const EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
  function clean(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/\u2212/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=')
      .replace(/«/g, '"').replace(/»/g, '"').replace(/\u00a0/g, ' ').replace(/\s*\n\s*/g, ' ')
      .split('').map(c => (c.charCodeAt(0) <= 255 || EXTRA.has(c) ? c : '?')).join('');
  }

  async function build(state, res, PDFLib) {
    const { PDFDocument, StandardFonts } = PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle('WISC-IV · Informe de calificación e interpretación');
    doc.setAuthor((state.evaluador && state.evaluador.nombre) || 'WISC-IV');
    doc.setCreator('WISC-IV Calificador');
    const f = await doc.embedFont(StandardFonts.Helvetica);
    const fb = await doc.embedFont(StandardFonts.HelveticaBold);

    const C = {
      blue: hex(PDFLib, '#007AFF'), text: hex(PDFLib, '#1C1C1E'), sub: hex(PDFLib, '#6C6C70'),
      line: hex(PDFLib, '#E5E5EA'), bg: hex(PDFLib, '#F2F2F7'), white: PDFLib.rgb(1, 1, 1),
      green: hex(PDFLib, '#248A3D'), red: hex(PDFLib, '#D70015'), band: hex(PDFLib, '#E8F1FF')
    };

    let page, y;
    const pages = [];
    const newPage = () => { page = doc.addPage([W, H]); pages.push(page); y = M; };
    const py = v => H - v;
    const ensure = h => { if (y + h > H - M - 24) newPage(); };

    function text(s, x, yTop, size, font, color, opts) {
      s = clean(s);
      let xx = x;
      const w = font.widthOfTextAtSize(s, size);
      if (opts && opts.align === 'right') xx = x - w;
      if (opts && opts.align === 'center') xx = x - w / 2;
      page.drawText(s, { x: xx, y: py(yTop) - size * 0.8, size, font, color: color || C.text });
      return w;
    }
    function wrap(s, font, size, maxW) {
      const words = clean(s).split(/\s+/).filter(Boolean);
      const lines = [];
      let cur = '';
      words.forEach(w => {
        const t = cur ? cur + ' ' + w : w;
        if (font.widthOfTextAtSize(t, size) <= maxW) cur = t;
        else { if (cur) lines.push(cur); cur = w; }
      });
      if (cur) lines.push(cur);
      return lines;
    }
    function paragraph(s, x, size, font, color, maxW, lh) {
      const lines = wrap(s, font, size, maxW);
      lines.forEach(l => {
        ensure(lh);
        text(l, x, y, size, font, color);
        y += lh;
      });
    }
    function rrect(x, yTop, w, h, r, o) {
      const p = `M ${r},0 H ${w - r} A ${r},${r} 0 0 1 ${w},${r} V ${h - r} A ${r},${r} 0 0 1 ${w - r},${h} H ${r} A ${r},${r} 0 0 1 0,${h - r} V ${r} A ${r},${r} 0 0 1 ${r},0 Z`;
      page.drawSvgPath(p, { x, y: py(yTop), ...o });
    }
    function rect(x, yTop, w, h, color) { page.drawRectangle({ x, y: py(yTop + h), width: w, height: h, color }); }
    function hline(yTop, x1, x2, color, th) {
      page.drawLine({ start: { x: x1, y: py(yTop) }, end: { x: x2, y: py(yTop) }, thickness: th || 0.6, color: color || C.line });
    }
    function dot(x, yTop, r, color) { page.drawCircle({ x, y: py(yTop), size: r, color }); }
    function section(title) {
      ensure(100);
      y += 6;
      text(title, M, y, 13, fb, C.text);
      y += 20;
    }

    /* ---------- Página 1: encabezado ---------- */
    newPage();
    rect(0, 0, W, 92, C.blue);
    text('WISC-IV', M, 26, 26, fb, C.white);
    text('Informe de calificación e interpretación', M, 58, 12, f, hex(PDFLib, '#DCEBFF'));
    const now = new Date();
    text('Generado el ' + Wisc.fmtDate(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')),
      W - M, 30, 9.5, f, hex(PDFLib, '#DCEBFF'), { align: 'right' });
    y = 112;

    /* ---------- Datos generales ---------- */
    const ev = state.evaluado || {}, er = state.evaluador || {};
    const colW = (CW - 14) / 2;
    const infoRows = (rows, x, w) => {
      let yy = y + 30;
      rows.forEach(([k, v]) => {
        text(k, x + 12, yy, 8.5, f, C.sub);
        const lines = wrap(v || '—', f, 9.5, w - 24);
        text(lines[0] || '—', x + 12, yy + 11, 9.5, fb, C.text);
        yy += 27;
      });
    };
    const evRows = [
      ['Nombre', ev.nombre], ['Fecha de nacimiento', Wisc.fmtDate(ev.nacimiento)],
      ['Edad cronológica', Wisc.fmtAge(res.age)], ['Sexo', ev.sexo],
      ['Escolaridad / grado', ev.escolaridad], ['Escuela', ev.escuela]
    ].filter(r => r[1] && r[1] !== '—');
    const erRows = [
      ['Evaluador/a', er.nombre], ['Profesión / cédula', er.profesion],
      ['Institución', er.institucion], ['Fecha de aplicación', Wisc.fmtDate(er.fecha)]
    ].filter(r => r[1] && r[1] !== '—');
    const boxH = 30 + Math.max(evRows.length, erRows.length) * 27 + 2;
    rrect(M, y, colW, boxH, 10, { color: C.bg });
    rrect(M + colW + 14, y, colW, boxH, 10, { color: C.bg });
    text('Datos del evaluado', M + 12, y + 12, 10.5, fb, C.blue);
    text('Datos del evaluador', M + colW + 26, y + 12, 10.5, fb, C.blue);
    infoRows(evRows, M, colW);
    infoRows(erRows, M + colW + 14, colW);
    y += boxH + 8;

    if (ev.motivo) {
      ensure(40);
      text('Motivo de evaluación', M, y + 4, 9, fb, C.sub);
      y += 18;
      paragraph(ev.motivo, M, 9.5, f, C.text, CW, 13);
      y += 4;
    }

    /* ---------- Puntuaciones compuestas ---------- */
    section('Puntuaciones compuestas');
    const cols = [M + 22, M + 232, M + 292, M + 352, M + 410]; // x inicio columnas
    ensure(30);
    rect(M, y, CW, 20, C.bg);
    text('Índice', cols[0], y + 6, 8.5, fb, C.sub);
    text('Suma esc.', cols[1], y + 6, 8.5, fb, C.sub);
    text('P. compuesta', cols[2], y + 6, 8.5, fb, C.sub);
    text('Percentil', cols[3], y + 6, 8.5, fb, C.sub);
    text('Clasificación', cols[4], y + 6, 8.5, fb, C.sub);
    y += 20;
    res.indices.forEach(i => {
      ensure(26);
      dot(M + 10, y + 13, 4, hex(PDFLib, i.color));
      text(i.n, cols[0], y + 8, 10, i.k === 'CIT' ? fb : f, C.text);
      text(i.count ? String(i.sum) + (i.complete ? '' : ` (${i.count}/${i.total})`) : '—', cols[1], y + 8, 10, f, C.text);
      text(i.comp !== null ? String(i.comp) : '—', cols[2], y + 8, 11, fb, C.text);
      text(Wisc.fmtPercentile(i.pct), cols[3], y + 8, 10, f, C.text);
      text(i.cls ? i.cls.n : '—', cols[4], y + 8, 10, fb, i.cls ? hex(PDFLib, i.color) : C.sub);
      y += 26;
      hline(y, M, W - M);
    });
    y += 10;

    /* ---------- Gráficas ---------- */
    function drawChart(L, title, x, yTop, labelColors) {
      text(title, x, yTop, 9.5, fb, C.sub);
      const oy = yTop + 14;
      const X = v => x + v, Y = v => oy + v;
      if (L.band) rect(X(L.plot.x0), Y(L.band.y1), L.plot.x1 - L.plot.x0, L.band.y2 - L.band.y1, C.band);
      L.grid.forEach(g => {
        hline(Y(g.y), X(L.plot.x0), X(L.plot.x1), C.line, 0.5);
        text(String(g.v), X(L.plot.x0) - 6, Y(g.y) - 4, 7.5, f, C.sub, { align: 'right' });
      });
      if (L.mid !== null) page.drawLine({ start: { x: X(L.plot.x0), y: py(Y(L.mid)) }, end: { x: X(L.plot.x1), y: py(Y(L.mid)) }, thickness: 0.8, color: hex(PDFLib, '#8E8E93'), dashArray: [3, 3] });
      const pts = L.pts.filter(p => p.y !== null);
      for (let i = 1; i < pts.length; i++) {
        // solo une puntos consecutivos del mismo grupo (o todos si no hay grupo)
        if (pts[i].idx !== undefined && pts[i].idx !== pts[i - 1].idx) continue;
        page.drawLine({
          start: { x: X(pts[i - 1].x), y: py(Y(pts[i - 1].y)) }, end: { x: X(pts[i].x), y: py(Y(pts[i].y)) },
          thickness: 1.6, color: hex(PDFLib, '#8E8E93')
        });
      }
      L.pts.forEach(p => {
        text(p.label, X(p.x), Y(L.plot.y1) + 6, 7.5, fb, labelColors ? hex(PDFLib, p.color) : C.sub, { align: 'center' });
        if (p.y !== null) {
          dot(X(p.x), Y(p.y), 4.2, hex(PDFLib, p.color));
          text(String(p.v), X(p.x), Y(p.y) - 14, 8, fb, C.text, { align: 'center' });
        }
      });
      return oy + L.h;
    }
    const hasComp = res.indices.some(i => i.comp !== null);
    if (hasComp) {
      ensure(180);
      const L = Wisc.compositeChart(res, CW, 150);
      y = drawChart(L, 'Perfil de puntuaciones compuestas (franja: 85 a 115)', M, y, true) + 8;
    }

    /* ---------- Puntuaciones escalares ---------- */
    section('Puntuaciones escalares por subtest');
    ensure(30);
    rect(M, y, CW, 20, C.bg);
    const sc = [M + 22, M + 170, M + 300, M + 366, M + 440];
    ['Subtest', 'Índice', 'P. escalar', 'Desv. (vs 10)', 'Nivel'].forEach((t, i) => text(t, sc[i], y + 6, 8.5, fb, C.sub));
    y += 20;
    Wisc.SUBTESTS.forEach(s => {
      const v = res.sc[s.k];
      if (!s.core && v === null) return;
      ensure(20);
      const ix = Wisc.INDEXES.find(i => i.k === s.idx);
      dot(M + 10, y + 11, 3.6, hex(PDFLib, ix.color));
      text(s.n + (s.core ? '' : ' (opc.)'), sc[0], y + 6, 9.5, f, C.text);
      text(ix.n, sc[1], y + 6, 9, f, C.sub);
      text(v === null ? '—' : String(v), sc[2] + 14, y + 6, 10, fb, C.text);
      if (v !== null) {
        const d = v - 10;
        text(Wisc.fmtDev(d), sc[3] + 14, y + 6, 9.5, fb, d < 0 ? C.red : d > 0 ? C.green : C.sub);
        text(Wisc.classifyScaled(v), sc[4], y + 6, 9, f, C.text);
      }
      y += 20;
      hline(y, M, W - M);
    });
    y += 10;

    ensure(180);
    y = drawChart(Wisc.subtestChart(res, CW, 150), 'Perfil de puntuaciones escalares (franja: 7 a 13)', M, y, true) + 8;

    /* ---------- Unidad de los índices ---------- */
    section('Unidad de los índices (diferencia máxima entre subtests < 5)');
    ensure(30);
    rect(M, y, CW, 20, C.bg);
    const uc = [M + 22, M + 170, M + 300, M + 400, M + 450];
    ['Índice', 'Subtest más alto', 'Subtest más bajo', 'Dif.', 'Conclusión'].forEach((t, i) => text(t, uc[i], y + 6, 8.5, fb, C.sub));
    y += 20;
    res.indices.forEach(i => {
      ensure(24);
      dot(M + 10, y + 11, 3.6, hex(PDFLib, i.color));
      text(i.n, uc[0], y + 6, 9.5, f, C.text);
      text(i.hi ? `${i.hi.s.n} (${i.hi.v})` : '—', uc[1], y + 6, 8.5, f, C.text);
      text(i.lo ? `${i.lo.s.n} (${i.lo.v})` : '—', uc[2], y + 6, 8.5, f, C.text);
      text(i.range === null ? '—' : String(i.range), uc[3] + 6, y + 6, 9.5, fb, C.text);
      text(i.unitary === null ? '—' : i.unitary ? 'Unitario' : 'No unitario', uc[4], y + 6, 9, fb, i.unitary === null ? C.sub : i.unitary ? C.green : C.red);
      y += 22;
      hline(y, M, W - M);
    });
    y += 10;

    /* ---------- Procesos ---------- */
    if (res.process.some(p => p.score !== null)) {
      section('Agrupaciones de procesos (requieren subtests opcionales)');
      ensure(30);
      rect(M, y, CW, 20, C.bg);
      const pc = [M + 12, M + 230, M + 380, M + 450];
      ['Agrupación', 'Fórmula', 'Puntuación', 'Desv. (vs 10)'].forEach((t, i) => text(t, pc[i], y + 6, 8.5, fb, C.sub));
      y += 20;
      res.process.forEach(p => {
        ensure(22);
        text(p.n, pc[0], y + 6, 9.5, f, C.text);
        text(p.f, pc[1], y + 6, 9, f, C.sub);
        text(p.score === null ? '—' : p.score.toFixed(2), pc[2] + 6, y + 6, 10, fb, C.text);
        if (p.dev !== null) text(Wisc.fmtDev(Math.round(p.dev * 100) / 100), pc[3] + 12, y + 6, 9.5, fb, p.dev < 0 ? C.red : p.dev > 0 ? C.green : C.sub);
        y += 22;
        hline(y, M, W - M);
      });
      y += 10;
    }

    /* ---------- Interpretación ---------- */
    const interp = Wisc.interpretation(state, res);
    if (interp.length) {
      section('Interpretación');
      interp.forEach(b => {
        ensure(46);
        text(b.t, M, y, 10, fb, C.blue);
        y += 15;
        paragraph(b.p, M, 9.5, f, C.text, CW, 13.5);
        y += 8;
      });
    }
    if (state.observaciones && state.observaciones.trim()) {
      section('Observaciones del evaluador');
      paragraph(state.observaciones.trim(), M, 9.5, f, C.text, CW, 13.5);
      y += 6;
    }

    /* ---------- Aviso ---------- */
    ensure(70);
    y += 4;
    rrect(M, y, CW, 62, 8, { color: C.bg });
    const note = 'Notas: los puntajes compuestos se capturaron manualmente según las tablas de baremación del manual. ' +
      'Los percentiles se calculan con la curva normal (media 100, DE 15) y son orientativos: verifíquelos con el manual. ' +
      'Solo se suman los subtests obligatorios; no es válido si se sustituyó alguno por un opcional. ' +
      'Este informe es una ayuda de calificación y debe ser interpretado por un profesional cualificado.';
    const nl = wrap(note, f, 8, CW - 24);
    nl.forEach((l, i) => text(l, M + 12, y + 10 + i * 11, 8, f, C.sub));
    y += 70;

    /* ---------- Pie de página ---------- */
    pages.forEach((p, i) => {
      page = p;
      hline(H - 32, M, W - M);
      text('WISC-IV · ' + (ev.nombre || ''), M, H - 26, 8, f, C.sub);
      text(`Página ${i + 1} de ${pages.length}`, W - M, H - 26, 8, f, C.sub, { align: 'right' });
    });

    return doc.save();
  }

  return { build };
});
