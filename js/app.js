(function () {
  'use strict';

  const { SUBTESTS, INDEXES } = Wisc;
  const app = document.getElementById('app');
  const KEY = 'wisc.draft.v1';
  const AUTH = 'wisc.auth';
  // SHA-256 de "usuario:contraseña" (no se guarda la contraseña en texto plano)
  const OK_HASH = '74287132139591b65a57fc5bc2ab02cce1250a29f76a9ad9692b83aa4e000050';

  /* ---------- SHA-256 (JS puro, funciona también fuera de HTTPS) ---------- */
  const K = [], H0 = [];
  (function () {
    let n = 2, c = 0;
    while (c < 64) {
      let p = true;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; }
      if (p) {
        if (c < 8) H0[c] = (Math.pow(n, 0.5) % 1) * 4294967296 | 0;
        K[c] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0;
        c++;
      }
      n++;
    }
  })();
  const rr = (v, a) => (v >>> a) | (v << (32 - a));
  function sha256hex(msg) {
    const bytes = new TextEncoder().encode(msg), l = bytes.length;
    const buf = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(buf.length - 8, Math.floor((l * 8) / 4294967296));
    dv.setUint32(buf.length - 4, (l * 8) >>> 0);
    let h = H0.slice();
    const w = new Int32Array(64);
    for (let o = 0; o < buf.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0, (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + g) | 0, (h[7] + hh) | 0];
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /* ---------- Utilidades ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18.5" cy="12" r="2"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  /* ---------- Estado ---------- */
  function blank() {
    return {
      step: 0,
      evaluado: { nombre: '', nacimiento: '', sexo: '', escolaridad: '', escuela: '', motivo: '' },
      evaluador: { nombre: '', profesion: '', institucion: '', fecha: today() },
      scaled: {}, comp: {}, observaciones: ''
    };
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.evaluado && d.evaluador) return Object.assign(blank(), d);
    } catch (e) { /* sin borrador */ }
    return blank();
  }
  let state = load();
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ } }, 250);
  }
  const getPath = p => p.split('.').reduce((o, k) => (o ? o[k] : ''), state);
  function setPath(p, v) {
    const ks = p.split('.'); const last = ks.pop();
    ks.reduce((o, k) => o[k], state)[last] = v;
  }

  /* ---------- Sesión ---------- */
  const isAuth = () => sessionStorage.getItem(AUTH) === '1' || localStorage.getItem(AUTH) === '1';
  function logout() {
    sessionStorage.removeItem(AUTH); localStorage.removeItem(AUTH);
    render();
  }

  /* ---------- Hoja modal ---------- */
  function sheet(o) {
    const root = $('#sheet-root');
    root.innerHTML = `<div class="backdrop"><div class="sheet" role="dialog" aria-modal="true">
      ${o.icon || ''}<h3>${esc(o.title)}</h3>${o.msg ? `<p>${esc(o.msg)}</p>` : ''}
      <div class="btns">${o.actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-i="${i}">${esc(a.t)}</button>`).join('')}</div>
    </div></div>`;
    const close = () => { root.innerHTML = ''; };
    $('.backdrop', root).addEventListener('click', e => {
      if (e.target.classList.contains('backdrop')) close();
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const a = o.actions[+b.dataset.i];
      const r = a.fn ? a.fn() : undefined;
      if (r !== false) close();
    });
    return close;
  }

  /* ---------- Render principal ---------- */
  const STEPS = [
    { t: 'Datos generales', lead: 'Primero registra al evaluado y al evaluador.' },
    { t: 'Puntuaciones escalares', lead: 'Captura la puntuación escalar (1 a 19) de cada subtest.' },
    { t: 'Puntuaciones compuestas', lead: 'Captura las compuestas según las tablas del manual.' },
    { t: 'Resumen', lead: 'Revisa los resultados y finaliza para generar el PDF.' }
  ];

  function render() {
    window.scrollTo(0, 0);
    if (!isAuth()) return renderLogin();
    const s = STEPS[state.step];
    app.innerHTML = `
      <div class="screen">
        <header class="topbar" id="topbar">
          <div class="topbar-row">
            ${state.step > 0 ? `<button class="back-btn" data-act="back" aria-label="Atrás">${ICON.back}Atrás</button>` : '<span class="spacer"></span>'}
            <span class="topbar-title">${s.t}</span>
            <button class="icon-btn" data-act="menu" aria-label="Opciones">${ICON.more}</button>
          </div>
          <div class="steps" aria-label="Paso ${state.step + 1} de 4">${STEPS.map((_, i) => `<i class="${i <= state.step ? 'on' : ''}"></i>`).join('')}</div>
        </header>
        <h1 class="large">${s.t}</h1>
        <p class="lead">${s.lead}</p>
        <main id="step">${[viewDatos, viewEscalares, viewCompuestas, viewResumen][state.step]()}</main>
      </div>
      <nav class="bottom"><div class="bottom-in">
        ${state.step > 0 ? '<button class="btn sec" data-act="back">Atrás</button>' : ''}
        ${state.step < 3
          ? '<button class="btn" data-act="next">Continuar</button>'
          : '<button class="btn green" data-act="finish" id="finish">Finalizar y generar PDF</button>'}
      </div></nav>`;
    if (state.step === 0) liveDatos();
    if (state.step === 1) liveEscalares();
    if (state.step === 2) liveCompuestas();
    onScroll();
  }
  function onScroll() {
    const t = $('#topbar');
    if (t) t.classList.toggle('scrolled', window.scrollY > 52);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Login ---------- */
  function renderLogin() {
    app.innerHTML = `
      <main class="login">
        <img class="logo" src="icons/icon-192.png" alt="" width="84" height="84">
        <h1>WISC-IV</h1>
        <p class="sub">Calificación e interpretación</p>
        <form id="lf" autocomplete="on">
          <div class="group">
            <div class="row"><label for="u">Usuario</label><input id="u" name="username" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Usuario" required></div>
            <div class="row"><label for="p">Contraseña</label><input id="p" name="password" type="password" autocomplete="current-password" placeholder="Contraseña" required></div>
            <div class="row sw"><label for="rm">Mantener sesión</label><input id="rm" class="switch" type="checkbox" role="switch"></div>
          </div>
          <button class="btn" type="submit">Entrar</button>
          <p class="login-err" id="lerr" role="alert"></p>
        </form>
      </main>`;
    $('#lf').addEventListener('submit', e => {
      e.preventDefault();
      const u = $('#u').value.trim().toLowerCase(), p = $('#p').value;
      if (sha256hex(u + ':' + p) === OK_HASH) {
        (($('#rm').checked ? localStorage : sessionStorage)).setItem(AUTH, '1');
        render();
      } else {
        $('#lerr').textContent = 'Usuario o contraseña incorrectos.';
        $('#p').value = ''; $('#p').focus();
      }
    });
  }

  /* ---------- Paso 1: datos generales ---------- */
  const field = (label, path, o) => {
    o = o || {};
    return `<div class="row fld" data-row="${path}"><label for="f-${path}">${label}${o.req ? '' : ''}</label>
      <input id="f-${path}" data-bind="${path}" type="${o.type || 'text'}" value="${esc(getPath(path))}" placeholder="${esc(o.ph || (o.req ? 'Requerido' : 'Opcional'))}" ${o.type === 'date' ? `max="2100-12-31" min="1990-01-01"` : ''} autocomplete="off"></div>`;
  };
  function viewDatos() {
    const sexo = state.evaluado.sexo;
    return `
      <div class="group-title"><b>Evaluado</b></div>
      <div class="group">
        ${field('Nombre completo', 'evaluado.nombre', { req: 1 })}
        ${field('Fecha de nacimiento', 'evaluado.nacimiento', { type: 'date', req: 1 })}
        <div class="row"><span class="lbl">Sexo</span>
          <div class="seg" role="group" aria-label="Sexo">
            ${['Femenino', 'Masculino'].map(v => `<button type="button" data-seg="evaluado.sexo" data-val="${v}" aria-pressed="${sexo === v}">${v}</button>`).join('')}
          </div></div>
        ${field('Escolaridad / grado', 'evaluado.escolaridad')}
        ${field('Escuela', 'evaluado.escuela')}
        <div class="row col"><label for="f-motivo">Motivo de evaluación</label>
          <textarea id="f-motivo" data-bind="evaluado.motivo" placeholder="Opcional" rows="3">${esc(state.evaluado.motivo)}</textarea></div>
      </div>
      <div class="group-title"><b>Evaluador</b></div>
      <div class="group">
        ${field('Nombre del evaluador', 'evaluador.nombre', { req: 1 })}
        ${field('Profesión / cédula', 'evaluador.profesion')}
        ${field('Institución', 'evaluador.institucion')}
        ${field('Fecha de aplicación', 'evaluador.fecha', { type: 'date', req: 1 })}
      </div>
      <div class="group-title"><b>Edad cronológica</b></div>
      <div class="group"><div class="row static"><span class="lbl">A la fecha de aplicación</span><span class="val" id="age">—</span></div></div>
      <p class="hint" id="age-hint"></p>`;
  }
  function liveDatos() {
    const a = Wisc.ageParts(state.evaluado.nacimiento, state.evaluador.fecha);
    $('#age').textContent = a ? `${a.y} años, ${a.m} m, ${a.d} d` : '—';
    const out = a && (a.y < 6 || a.y > 16);
    $('#age-hint').textContent = out ? 'Aviso: el WISC-IV se aplica de 6 años 0 meses a 16 años 11 meses.' : '';
  }
  function validateDatos() {
    const req = ['evaluado.nombre', 'evaluado.nacimiento', 'evaluador.nombre', 'evaluador.fecha'];
    let bad = [];
    req.forEach(p => {
      const empty = !String(getPath(p) || '').trim();
      const row = $(`[data-row="${p}"]`);
      if (row) row.classList.toggle('err', empty);
      if (empty) bad.push(p);
    });
    if (bad.length) { toast('Completa los campos requeridos'); const r = $(`[data-row="${bad[0]}"] input`); if (r) r.focus(); return false; }
    if (!Wisc.ageParts(state.evaluado.nacimiento, state.evaluador.fecha)) {
      $('[data-row="evaluado.nacimiento"]').classList.add('err');
      toast('La fecha de nacimiento debe ser anterior a la de aplicación');
      return false;
    }
    return true;
  }

  /* ---------- Paso 2: escalares ---------- */
  function viewEscalares() {
    const groups = INDEXES.filter(i => i.k !== 'CIT').map(ix => {
      const subs = SUBTESTS.filter(s => s.idx === ix.k).sort((a, b) => b.core - a.core);
      return `
        <div class="group-title"><span class="dotc" style="background:${ix.color}"></span><b>${ix.n}</b><span class="right" id="sum-${ix.k}"></span></div>
        <div class="group">${subs.map(s => `
          <div class="row" data-subrow="${s.k}">
            <label for="s-${s.k}" class="lbl">${s.n}${s.core ? '' : '<span class="opt-tag">Opcional</span>'}<small>${s.k}</small></label>
            <span class="dev" id="dev-${s.k}"></span>
            <input id="s-${s.k}" class="score-in" data-sc="${s.k}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(state.scaled[s.k] == null ? '' : state.scaled[s.k])}" placeholder="–" aria-label="${s.n}, puntuación escalar">
          </div>`).join('')}
        </div>`;
    }).join('');
    return groups + `
      <div class="group-title"><span class="dotc" style="background:${INDEXES[4].color}"></span><b>C.I. Total</b><span class="right" id="sum-CIT"></span></div>
      <div class="group"><div class="row static"><span class="lbl">Suma de los 10 subtests obligatorios<small>Se calcula automáticamente</small></span><span class="val" id="sumbig-CIT" style="font-size:22px;font-weight:700;color:var(--text)">0</span></div></div>
      <p class="hint">Solo se suman los subtests obligatorios. No es válido si sustituiste alguno por un opcional. La desviación indica la distancia respecto a la media (10).</p>`;
  }
  function liveEscalares() {
    const res = Wisc.analyze(state);
    SUBTESTS.forEach(s => {
      const raw = state.scaled[s.k];
      const v = res.sc[s.k];
      const dev = $('#dev-' + s.k), inp = $('#s-' + s.k);
      if (!dev) return;
      const bad = raw !== undefined && raw !== null && raw !== '' && v === null;
      inp.classList.toggle('bad', bad);
      if (v === null) { dev.textContent = ''; dev.className = 'dev'; }
      else { const d = v - 10; dev.textContent = Wisc.fmtDev(d); dev.className = 'dev ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : ''); }
    });
    res.indices.forEach(i => {
      const el = $('#sum-' + i.k);
      if (el) el.textContent = `Suma ${i.sum} · ${i.count}/${i.total}`;
    });
    const big = $('#sumbig-CIT'); if (big) big.textContent = res.byKey.CIT.sum;
  }
  function hasBadScaled() {
    return SUBTESTS.some(s => { const r = state.scaled[s.k]; return r !== undefined && r !== null && r !== '' && Wisc.validScaled(r) === null; });
  }

  /* ---------- Paso 3: compuestas ---------- */
  function viewCompuestas() {
    const res = Wisc.analyze(state);
    return res.indices.map(i => `
      <section class="comp-card" aria-label="${i.n}">
        <div class="comp-head"><span class="dotc" style="background:${i.color}"></span><b>${i.n}</b>
          <span class="sum">Suma ${i.sum}${i.complete ? '' : ` (${i.count}/${i.total})`}</span></div>
        <div class="comp-body">
          <input class="score-in" data-comp="${i.k}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(state.comp[i.k] == null ? '' : state.comp[i.k])}" placeholder="–" aria-label="${i.n}, puntuación compuesta">
          <div class="comp-out" id="out-${i.k}"></div>
        </div>
        <div class="bar" id="bar-${i.k}"></div>
      </section>`).join('') +
      '<p class="hint">Introduce las puntuaciones compuestas (40 a 160) según las tablas de baremación del manual. Los percentiles se calculan con la curva normal (media 100, DE 15) y son orientativos.</p>';
  }
  function liveCompuestas() {
    const res = Wisc.analyze(state);
    res.indices.forEach(i => {
      const out = $('#out-' + i.k), bar = $('#bar-' + i.k), inp = $(`[data-comp="${i.k}"]`);
      const raw = state.comp[i.k];
      const bad = raw !== undefined && raw !== null && raw !== '' && i.comp === null;
      inp.classList.toggle('bad', bad);
      if (i.comp === null) {
        out.innerHTML = `<div class="pct">${bad ? 'Valor fuera de rango (40 a 160)' : 'Sin capturar'}</div>`;
        bar.innerHTML = '';
      } else {
        out.innerHTML = `<span class="chip" style="background:${i.color}">${i.cls.n}</span><div class="pct">Percentil ${Wisc.fmtPercentile(i.pct)}</div>`;
        bar.innerHTML = `<i style="left:${((i.comp - 40) / 120) * 100}%;background:${i.color}"></i>`;
      }
    });
  }
  function hasBadComp() {
    return INDEXES.some(i => { const r = state.comp[i.k]; return r !== undefined && r !== null && r !== '' && Wisc.validComp(r) === null; });
  }

  /* ---------- Paso 4: resumen ---------- */
  function svgChart(L, colorLabels) {
    const { plot: P } = L;
    let s = `<svg viewBox="0 0 ${L.w} ${L.h}" role="img" aria-label="Gráfica de perfil">`;
    if (L.band) s += `<rect x="${P.x0}" y="${L.band.y1}" width="${P.x1 - P.x0}" height="${L.band.y2 - L.band.y1}" fill="var(--band)"/>`;
    L.grid.forEach(g => {
      s += `<line x1="${P.x0}" x2="${P.x1}" y1="${g.y}" y2="${g.y}" stroke="var(--hair)" stroke-width=".6"/>`;
      s += `<text class="t" x="${P.x0 - 5}" y="${g.y + 3.5}" text-anchor="end">${g.v}</text>`;
    });
    if (L.mid !== null) s += `<line x1="${P.x0}" x2="${P.x1}" y1="${L.mid}" y2="${L.mid}" stroke="#8E8E93" stroke-width=".9" stroke-dasharray="3 3"/>`;
    const pts = L.pts.filter(p => p.y !== null);
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].idx !== undefined && pts[i].idx !== pts[i - 1].idx) continue;
      s += `<line x1="${pts[i - 1].x}" y1="${pts[i - 1].y}" x2="${pts[i].x}" y2="${pts[i].y}" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round"/>`;
    }
    L.pts.forEach(p => {
      s += `<text class="t tb" x="${p.x}" y="${P.y1 + 15}" text-anchor="middle" ${colorLabels ? `style="fill:${p.color}"` : ''}>${p.label}</text>`;
      if (p.y !== null) {
        s += `<circle cx="${p.x}" cy="${p.y}" r="4.6" fill="${p.color}" stroke="var(--card)" stroke-width="1.5"/>`;
        s += `<text class="tv" x="${p.x}" y="${p.y - 9}" text-anchor="middle">${p.v}</text>`;
      }
    });
    return s + '</svg>';
  }
  function viewResumen() {
    const res = Wisc.analyze(state);
    const ev = state.evaluado, er = state.evaluador;
    const cards = res.indices.map(i => `
      <div class="res-card ${i.k === 'CIT' ? 'wide' : ''}">
        <div class="k"><i style="background:${i.color}"></i>${i.n}</div>
        <div class="big">${i.comp !== null ? i.comp : '–'}</div>
        <div class="cls" style="color:${i.color}">${i.cls ? i.cls.n : 'Sin compuesta'}</div>
        <div class="pc">${i.pct !== null ? 'Percentil ' + Wisc.fmtPercentile(i.pct) + ' · ' : ''}Suma ${i.sum} (${i.count}/${i.total})</div>
      </div>`).join('');
    const hasComp = res.indices.some(i => i.comp !== null);
    const interp = Wisc.interpretation(state, res);
    const showProc = res.process.some(p => p.score !== null);
    return `
      <div class="card" style="margin-bottom:12px">
        <div style="font-weight:600;font-size:18px">${esc(ev.nombre || '—')}</div>
        <div class="mute" style="font-size:14px;margin-top:2px">${Wisc.fmtAge(res.age)} · Aplicación ${Wisc.fmtDate(er.fecha)}</div>
        <div class="mute" style="font-size:14px">Evaluador/a: ${esc(er.nombre || '—')}</div>
      </div>
      <div class="res-grid">${cards}</div>

      ${hasComp ? `<div class="card" style="margin-top:12px"><p class="chart-title">Perfil de puntuaciones compuestas</p><div class="chart-wrap">${svgChart(Wisc.compositeChart(res, 340, 180), true)}</div></div>` : ''}
      <div class="card" style="margin-top:12px"><p class="chart-title">Perfil de puntuaciones escalares</p><div class="chart-wrap">${svgChart(Wisc.subtestChart(res, 340, 180), true)}</div></div>

      <div class="group-title"><b>Unidad de los índices</b><span class="right">dif. &lt; 5 = unitario</span></div>
      <div class="card"><table class="table"><tbody>
        ${res.indices.map(i => `<tr>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i.color};margin-right:8px"></span>${i.n}
            ${i.hi ? `<div class="mute" style="font-size:12.5px;margin-left:16px">${i.hi.s.n} ${i.hi.v} · ${i.lo.s.n} ${i.lo.v}</div>` : ''}</td>
          <td class="r">${i.range === null ? '–' : i.range}</td>
          <td class="r ${i.unitary === null ? 'mute' : i.unitary ? 'good' : 'badc'}">${i.unitary === null ? '–' : i.unitary ? 'Unitario' : 'No unitario'}</td></tr>`).join('')}
      </tbody></table></div>

      ${showProc ? `<div class="group-title"><b>Agrupaciones de procesos</b></div>
      <div class="card"><table class="table"><thead><tr><th>Agrupación</th><th class="r">Punt.</th><th class="r">Desv.</th></tr></thead><tbody>
        ${res.process.map(p => `<tr><td>${p.n}<div class="mute" style="font-size:12.5px">${p.f}</div></td>
          <td class="r">${p.score === null ? '–' : p.score.toFixed(2)}</td>
          <td class="r ${p.dev === null ? 'mute' : p.dev > 0 ? 'good' : p.dev < 0 ? 'badc' : 'mute'}">${p.dev === null ? '–' : Wisc.fmtDev(Math.round(p.dev * 100) / 100)}</td></tr>`).join('')}
      </tbody></table></div>` : ''}

      ${interp.length ? `<div class="group-title"><b>Interpretación</b></div><div class="card interp">${interp.map(b => `<h4>${esc(b.t)}</h4><p>${esc(b.p)}</p>`).join('')}</div>` : ''}

      <div class="group-title"><b>Observaciones</b></div>
      <div class="group"><div class="row col"><textarea data-bind="observaciones" rows="3" placeholder="Opcional. Se incluirán en el PDF." aria-label="Observaciones">${esc(state.observaciones)}</textarea></div></div>
      <p class="disclaimer">Los percentiles son orientativos; verifícalos con el manual. Este informe apoya la calificación y debe ser interpretado por un profesional cualificado.</p>`;
  }

  /* ---------- Finalizar: PDF ---------- */
  let lastPdf = null;
  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'evaluado';
  }
  function downloadPdf() {
    if (!lastPdf) return;
    const url = URL.createObjectURL(new Blob([lastPdf.bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = lastPdf.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function sharePdf() {
    try {
      const file = new File([lastPdf.bytes], lastPdf.name, { type: 'application/pdf' });
      await navigator.share({ files: [file], title: 'Informe WISC-IV' });
    } catch (e) { /* cancelado */ }
  }
  async function finish() {
    if (!validateDatosSilent()) { toast('Faltan datos generales'); state.step = 0; render(); validateDatos(); return; }
    const res = Wisc.analyze(state);
    if (!res.indices.some(i => i.count > 0)) { toast('Captura al menos una puntuación escalar'); state.step = 1; render(); return; }
    const btn = $('#finish');
    btn.disabled = true; btn.textContent = 'Generando PDF…';
    try {
      const bytes = await WiscReport.build(state, res, window.PDFLib);
      lastPdf = { bytes, name: `WISC-IV_${slug(state.evaluado.nombre)}_${state.evaluador.fecha}.pdf` };
      downloadPdf();
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([bytes], 'a.pdf', { type: 'application/pdf' })] }));
      const actions = [{ t: 'Descargar de nuevo', fn: () => { downloadPdf(); return false; } }];
      if (canShare) actions.push({ t: 'Compartir', cls: 'sec', fn: () => { sharePdf(); return false; } });
      actions.push({ t: 'Nueva evaluación', cls: 'sec', fn: () => { newEval(); } });
      actions.push({ t: 'Cerrar', cls: 'plain' });
      sheet({ icon: `<div class="check">${ICON.check}</div>`, title: 'Informe listo', msg: lastPdf.name, actions });
    } catch (e) {
      console.error(e);
      toast('No se pudo generar el PDF');
    }
    btn.disabled = false; btn.textContent = 'Finalizar y generar PDF';
  }
  function validateDatosSilent() {
    return ['evaluado.nombre', 'evaluado.nacimiento', 'evaluador.nombre', 'evaluador.fecha'].every(p => String(getPath(p) || '').trim()) &&
      !!Wisc.ageParts(state.evaluado.nacimiento, state.evaluador.fecha);
  }
  function newEval() {
    state = blank();
    try { localStorage.removeItem(KEY); } catch (e) { /* ignorar */ }
    render();
  }

  /* ---------- Eventos ---------- */
  app.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.bind) {
      setPath(t.dataset.bind, t.value); save();
      const row = t.closest('.row'); if (row) row.classList.remove('err');
      if (state.step === 0) liveDatos();
    } else if (t.dataset.sc) {
      t.value = t.value.replace(/\D/g, '').slice(0, 2);
      if (t.value) state.scaled[t.dataset.sc] = t.value; else delete state.scaled[t.dataset.sc];
      save(); liveEscalares();
      const n = +t.value;
      if (t.value.length === 2 || (t.value.length === 1 && n >= 2)) focusNext(t, '[data-sc]');
    } else if (t.dataset.comp) {
      t.value = t.value.replace(/\D/g, '').slice(0, 3);
      if (t.value) state.comp[t.dataset.comp] = t.value; else delete state.comp[t.dataset.comp];
      save(); liveCompuestas();
    }
  });
  function focusNext(el, sel) {
    const all = $$(sel);
    const n = all[all.indexOf(el) + 1];
    if (n) { n.focus(); n.select && n.select(); }
  }
  app.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === 'Enter' && (t.dataset.sc || t.dataset.comp)) { e.preventDefault(); focusNext(t, t.dataset.sc ? '[data-sc]' : '[data-comp]'); }
  });
  app.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('score-in')) e.target.select && e.target.select(); });
  app.addEventListener('click', e => {
    const seg = e.target.closest('[data-seg]');
    if (seg) {
      const p = seg.dataset.seg;
      setPath(p, getPath(p) === seg.dataset.val ? '' : seg.dataset.val); save();
      $$(`[data-seg="${p}"]`).forEach(b => b.setAttribute('aria-pressed', String(getPath(p) === b.dataset.val)));
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'back') { state.step = Math.max(0, state.step - 1); save(); render(); }
    else if (act === 'next') {
      if (state.step === 0 && !validateDatos()) return;
      if (state.step === 1 && hasBadScaled()) { toast('Hay puntuaciones fuera de rango (1 a 19)'); return; }
      if (state.step === 2 && hasBadComp()) { toast('Hay puntuaciones compuestas fuera de rango (40 a 160)'); return; }
      state.step = Math.min(3, state.step + 1); save(); render();
    } else if (act === 'finish') finish();
    else if (act === 'menu') {
      sheet({
        title: 'Opciones',
        actions: [
          { t: 'Nueva evaluación', cls: 'sec', fn: () => { sheet({ title: '¿Empezar de nuevo?', msg: 'Se borrarán los datos capturados de la evaluación actual.', actions: [{ t: 'Borrar y empezar', cls: 'danger', fn: newEval }, { t: 'Cancelar', cls: 'plain' }] }); return false; } },
          { t: 'Cerrar sesión', cls: 'sec', fn: logout },
          { t: 'Cancelar', cls: 'plain' }
        ]
      });
    }
  });

  /* ---------- Arranque ---------- */
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
