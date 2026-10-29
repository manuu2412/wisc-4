/* WISC-IV · lógica de calificación (replica la plantilla de Excel)
 * - Suma de puntuaciones escalares por índice (solo subtests obligatorios)
 * - Percentil = NORMDIST(compuesta; 100; 15) * 100
 * - Desviación = puntuación escalar - 10
 * - Unidad del índice: diferencia mayor-menor < 5
 * - Puntuaciones de procesos con las mismas fórmulas del Excel
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Wisc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Definiciones ---------- */
  const INDEXES = [
    { k: 'CV',  n: 'Comprensión Verbal',          color: '#007AFF' },
    { k: 'RP',  n: 'Razonamiento Perceptivo',     color: '#34C759' },
    { k: 'MT',  n: 'Memoria de Trabajo',          color: '#FF9500' },
    { k: 'VP',  n: 'Velocidad de Procesamiento',  color: '#AF52DE' },
    { k: 'CIT', n: 'C.I. Total',                  color: '#FF2D55' }
  ];

  // Mismo orden que el Excel (filas 13 a 27)
  const SUBTESTS = [
    { k: 'CC', n: 'Cubos',                 idx: 'RP', core: true  },
    { k: 'S',  n: 'Semejanzas',            idx: 'CV', core: true  },
    { k: 'D',  n: 'Dígitos',               idx: 'MT', core: true  },
    { k: 'Co', n: 'Conceptos',             idx: 'RP', core: true  },
    { k: 'CI', n: 'Claves',                idx: 'VP', core: true  },
    { k: 'V',  n: 'Vocabulario',           idx: 'CV', core: true  },
    { k: 'LN', n: 'Letras y números',      idx: 'MT', core: true  },
    { k: 'M',  n: 'Matrices',              idx: 'RP', core: true  },
    { k: 'C',  n: 'Comprensión',           idx: 'CV', core: true  },
    { k: 'BS', n: 'Búsqueda de símbolos',  idx: 'VP', core: true  },
    { k: 'FI', n: 'Figuras incompletas',   idx: 'RP', core: false },
    { k: 'An', n: 'Animales',              idx: 'VP', core: false },
    { k: 'I',  n: 'Información',           idx: 'CV', core: false },
    { k: 'A',  n: 'Aritmética',            idx: 'MT', core: false },
    { k: 'Ad', n: 'Adivinanzas',           idx: 'CV', core: false }
  ];

  // Fórmulas de la sección inferior del Excel (filas 50-57)
  const PROCESS = [
    { n: 'Razonamiento Fluido',          keys: ['Co', 'M', 'A'],  f: '(Co + M + A) / 3' },
    { n: 'Procesamiento Visual',         keys: ['CC', 'FI'],      f: '(CC + FI) / 2' },
    { n: 'Razonamiento Fl. No Verbal',   keys: ['M', 'Co'],       f: '(M + Co) / 2' },
    { n: 'Razonamiento Fluido Verbal',   keys: ['CC', 'D', 'Co'], f: '(CC + D + Co) / 3' },
    { n: 'Conocimiento Léxico',          keys: ['V', 'Ad'],       f: '(V + Ad) / 2' },
    { n: 'Información General',          keys: ['C', 'I'],        f: '(C + I) / 2' },
    { n: 'Memoria a Largo Plazo',        keys: ['V', 'I'],        f: '(V + I) / 2' },
    { n: 'Memoria a Corto Plazo',        keys: ['D', 'LN'],       f: '(D + LN) / 2' }
  ];

  const SUB_BY_KEY = {};
  SUBTESTS.forEach(s => (SUB_BY_KEY[s.k] = s));

  /* ---------- Utilidades ---------- */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function inRangeInt(v, a, b) {
    const n = num(v);
    return n !== null && Number.isInteger(n) && n >= a && n <= b ? n : null;
  }
  const validScaled = v => inRangeInt(v, 1, 19);
  const validComp = v => inRangeInt(v, 40, 160);

  // Función de distribución normal acumulada (equivale a NORMDIST(x;100;15;VERDADERO))
  function erfc(x) {
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function normCdf(z) { return 0.5 * erfc(-z / Math.SQRT2); }
  function percentile(comp) { return normCdf((comp - 100) / 15) * 100; }

  function fmtPercentile(p) {
    if (p === null || p === undefined) return '—';
    if (p < 0.1) return '<0.1';
    if (p > 99.9) return '>99.9';
    if (p < 1 || p > 99) return p.toFixed(1);
    return String(Math.round(p));
  }

  /* ---------- Clasificaciones ---------- */
  const CLASES = [
    { min: 130, n: 'Muy superior',        d: 'muy por encima de lo esperado para su edad' },
    { min: 120, n: 'Superior',            d: 'por encima de lo esperado para su edad' },
    { min: 110, n: 'Medio alto',          d: 'ligeramente por encima del promedio de su edad' },
    { min: 90,  n: 'Medio',               d: 'dentro del rango promedio para su edad' },
    { min: 80,  n: 'Medio bajo',          d: 'ligeramente por debajo del promedio de su edad' },
    { min: 70,  n: 'Limítrofe',           d: 'por debajo del promedio, en el límite inferior esperado' },
    { min: -Infinity, n: 'Extremadamente bajo', d: 'muy por debajo de lo esperado para su edad' }
  ];
  function classifyComposite(c) {
    for (const x of CLASES) if (c >= x.min) return x;
    return CLASES[CLASES.length - 1];
  }
  function classifyScaled(s) {
    if (s >= 16) return 'Muy alto';
    if (s >= 13) return 'Alto';
    if (s >= 8) return 'Promedio';
    if (s >= 5) return 'Bajo';
    return 'Muy bajo';
  }
  const fmtDev = d => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(Number.isInteger(d) ? 0 : 1);

  /* ---------- Fechas ---------- */
  function parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return { y, m: mo, d };
  }
  function ageParts(birth, applied) {
    const B = parseISO(birth), A = parseISO(applied);
    if (!B || !A) return null;
    let y = A.y - B.y, m = A.m - B.m, d = A.d - B.d;
    if (d < 0) { m--; d += new Date(A.y, A.m - 1, 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    if (y < 0) return null;
    return { y, m, d };
  }
  function fmtAge(a) {
    return a ? `${a.y} años, ${a.m} ${a.m === 1 ? 'mes' : 'meses'}, ${a.d} ${a.d === 1 ? 'día' : 'días'}` : '—';
  }
  function fmtDate(iso) {
    const p = parseISO(iso);
    return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}` : '—';
  }

  /* ---------- Cálculo completo ---------- */
  function analyze(state) {
    const sc = {};
    SUBTESTS.forEach(s => (sc[s.k] = validScaled(state.scaled && state.scaled[s.k])));

    const indices = INDEXES.map(ix => {
      const core = SUBTESTS.filter(s => s.core && (ix.k === 'CIT' || s.idx === ix.k));
      const vals = core.map(s => ({ s, v: sc[s.k] })).filter(o => o.v !== null);
      const sum = vals.reduce((a, o) => a + o.v, 0);
      let hi = null, lo = null;
      vals.forEach(o => {
        if (!hi || o.v > hi.v) hi = o;
        if (!lo || o.v < lo.v) lo = o;
      });
      const range = vals.length >= 2 ? hi.v - lo.v : null;
      const comp = validComp(state.comp && state.comp[ix.k]);
      return {
        k: ix.k, n: ix.n, color: ix.color,
        sum, count: vals.length, total: core.length, complete: vals.length === core.length,
        hi, lo, range, unitary: range === null ? null : range < 5,
        comp,
        pct: comp === null ? null : percentile(comp),
        cls: comp === null ? null : classifyComposite(comp)
      };
    });

    const process = PROCESS.map(p => {
      const vals = p.keys.map(k => sc[k]);
      const ok = vals.every(v => v !== null);
      const score = ok ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { n: p.n, f: p.f, score, dev: score === null ? null : score - 10 };
    });

    const age = ageParts(state.evaluado && state.evaluado.nacimiento, state.evaluador && state.evaluador.fecha);
    return { sc, indices, process, age, byKey: Object.fromEntries(indices.map(i => [i.k, i])) };
  }

  /* ---------- Interpretación en texto ---------- */
  function interpretation(state, res) {
    const out = [];
    const nombre = (state.evaluado && state.evaluado.nombre) || 'El/la evaluado/a';
    const withComp = res.indices.filter(i => i.comp !== null);

    const cit = res.byKey.CIT;
    if (cit.comp !== null) {
      out.push({
        t: 'C.I. Total',
        p: `${nombre} obtuvo un C.I. Total de ${cit.comp} (percentil ${fmtPercentile(cit.pct)}), ubicado en la categoría «${cit.cls.n}». ` +
           `Esto indica un funcionamiento intelectual general ${cit.cls.d}.` +
           (cit.unitary === false ? ` Sin embargo, la diferencia entre el subtest más alto y el más bajo es de ${cit.range} puntos escalares (≥ 5), por lo que el C.I. Total debe interpretarse con cautela y dar mayor peso a los índices.` : '')
      });
    }

    res.indices.filter(i => i.k !== 'CIT').forEach(i => {
      if (i.comp === null && i.count === 0) return;
      let p = '';
      if (i.comp !== null) {
        p += `Puntuación compuesta de ${i.comp} (percentil ${fmtPercentile(i.pct)}), categoría «${i.cls.n}»: desempeño ${i.cls.d}. `;
      } else {
        p += `Suma de puntuaciones escalares: ${i.sum}. Aún no se registró la puntuación compuesta. `;
      }
      if (i.range !== null) {
        p += `Subtest más alto: ${i.hi.s.n} (${i.hi.v}); más bajo: ${i.lo.s.n} (${i.lo.v}); diferencia de ${i.range} ${i.range === 1 ? 'punto' : 'puntos'}. `;
        p += i.unitary
          ? 'La diferencia es menor a 5, por lo que el índice se considera unitario e interpretable.'
          : 'La diferencia es de 5 o más, por lo que el índice no se considera unitario: conviene interpretar los subtests por separado.';
      }
      if (!i.complete) p += ` (Faltan ${i.total - i.count} subtest(s) obligatorio(s); la suma es parcial.)`;
      out.push({ t: i.n, p: p.trim() });
    });

    if (withComp.length >= 2) {
      const idx = withComp.filter(i => i.k !== 'CIT');
      if (idx.length >= 2) {
        const hi = idx.reduce((a, b) => (b.comp > a.comp ? b : a));
        const lo = idx.reduce((a, b) => (b.comp < a.comp ? b : a));
        if (hi.k !== lo.k) {
          out.push({
            t: 'Comparación entre índices',
            p: `El índice más alto fue ${hi.n} (${hi.comp}) y el más bajo ${lo.n} (${lo.comp}); la diferencia es de ${hi.comp - lo.comp} puntos compuestos.`
          });
        }
      }
    }

    const core = SUBTESTS.filter(s => res.sc[s.k] !== null);
    const altos = core.filter(s => res.sc[s.k] >= 13).map(s => `${s.n} (${res.sc[s.k]})`);
    const bajos = core.filter(s => res.sc[s.k] <= 7).map(s => `${s.n} (${res.sc[s.k]})`);
    if (altos.length || bajos.length) {
      let p = '';
      if (altos.length) p += `Puntuaciones escalares altas (13 o más): ${altos.join(', ')}. `;
      if (bajos.length) p += `Puntuaciones escalares bajas (7 o menos): ${bajos.join(', ')}.`;
      out.push({ t: 'Subtests destacados', p: p.trim() });
    }
    return out;
  }

  /* ---------- Geometría de gráficas (compartida por la app y el PDF) ---------- */
  function lineChartLayout(o) {
    const pad = o.pad || { l: 34, r: 12, t: 12, b: 26 };
    const x0 = pad.l, x1 = o.w - pad.r, y0 = pad.t, y1 = o.h - pad.b;
    const yOf = v => y1 - ((v - o.ymin) / (o.ymax - o.ymin)) * (y1 - y0);
    const n = o.points.length;
    const xOf = i => (n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * (i + 0.5)) / n);
    const grid = [];
    for (let v = o.ymin; v <= o.ymax + 1e-9; v += o.step) grid.push({ v, y: yOf(v) });
    return {
      w: o.w, h: o.h, plot: { x0, x1, y0, y1 },
      grid,
      band: o.band ? { y1: yOf(o.band[1]), y2: yOf(o.band[0]) } : null,
      mid: o.mid !== undefined ? yOf(o.mid) : null,
      pts: o.points.map((p, i) => ({ ...p, x: xOf(i), y: p.v === null ? null : yOf(p.v) }))
    };
  }
  function compositeChart(res, w, h) {
    return lineChartLayout({
      w, h, ymin: 40, ymax: 160, step: 15, band: [85, 115], mid: 100,
      points: res.indices.map(i => ({ label: i.k, v: i.comp, color: i.color }))
    });
  }
  function subtestChart(res, w, h) {
    const order = ['CV', 'RP', 'MT', 'VP'];
    const pts = [];
    order.forEach(ix => {
      SUBTESTS.filter(s => s.idx === ix).sort((a, b) => b.core - a.core).forEach(s => {
        const col = INDEXES.find(i => i.k === ix).color;
        if (s.core || res.sc[s.k] !== null) pts.push({ label: s.k, v: res.sc[s.k], color: col, idx: ix });
      });
    });
    return lineChartLayout({
      w, h, ymin: 1, ymax: 19, step: 3, band: [7, 13], mid: 10,
      pad: { l: 28, r: 8, t: 12, b: 26 }, points: pts
    });
  }

  return {
    INDEXES, SUBTESTS, PROCESS, SUB_BY_KEY, CLASES,
    validScaled, validComp, percentile, fmtPercentile, classifyComposite, classifyScaled, fmtDev,
    ageParts, fmtAge, fmtDate, parseISO,
    analyze, interpretation, compositeChart, subtestChart
  };
});
