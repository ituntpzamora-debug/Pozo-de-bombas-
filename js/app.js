/* Dashboard de Pozos de Agua Profunda — Grupo MP
   React 18 + htm (sin compilar) · Recharts · Leaflet · jsPDF */
(function () {
  'use strict';
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const html = htm.bind(React.createElement);
  const RC = window.Recharts || null;
  const CFG = Object.assign({ API_URL: '', TOKEN: '', SHEET_URL: '#', DATOS_AL: '', LEER_REGISTRO: true, EXTRA_WELLS: [] }, window.POZOS_CONFIG || {});
  const U = window.PozosUtil;

  const TABS = [
    { id: 'resumen', n: '01', t: 'Resumen' },
    { id: 'ficha', n: '02', t: 'Ficha de pozos' },
    { id: 'mapa', n: '03', t: 'Mapa' },
    { id: 'informe', n: '04', t: 'Informe' }
  ];
  const DESTINOS = ['Riego', 'Antiheladas', 'Llenado de represa', 'Empaque / proceso', 'Consumo / uso general', 'Respaldo', 'Otro'];
  const TIPOS_ACCION = ['Inspección', 'Medición', 'Videofilmación', 'Limpieza / desarrollo', 'Intervención', 'Observación'];
  const TIPOS_ADJ = ['Video', 'Informe', 'Foto', 'Plano', 'Otro'];
  const PAL = {
    dark: { lime: '#c6f65b', aqua: '#5fe3cf', violet: '#9d8fff', rose: '#ff6f7d', amber: '#f6b862', grid: 'rgba(255,255,255,.06)', axis: '#7d8984', ok: '#5fe3a1', bad: '#ff6f7d', na: '#8d9994' },
    light: { lime: '#76a800', aqua: '#0fa595', violet: '#6c5ce7', rose: '#e0475a', amber: '#d98a14', grid: 'rgba(16,40,30,.08)', axis: '#6d7a74', ok: '#11855a', bad: '#c92f43', na: '#6d7a74' }
  };

  /* ---------- Íconos ---------- */
  const I = {
    sun: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
    moon: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`,
    refresh: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/></svg>`,
    pdf: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15l3 3 3-3"/></svg>`
  };

  /* ---------- Almacenamiento ---------- */
  const LS_DATA = 'pozos-gmp-datos-v1';
  const LS_CACHE = 'pozos-gmp-cache-v1';
  const lsGet = (k) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio o bloqueado */ } };

  function makeStore() {
    if (CFG.API_URL) {
      const post = async (body) => {
        if (CFG.TOKEN) body.token = CFG.TOKEN;
        const r = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'Error del servidor');
        return j;
      };
      return {
        mode: 'sheets',
        async load() {
          const u = new URL(CFG.API_URL);
          u.searchParams.set('action', 'all');
          if (CFG.TOKEN) u.searchParams.set('token', CFG.TOKEN);
          if (!CFG.LEER_REGISTRO) u.searchParams.set('registro', '0');
          const r = await fetch(u.toString());
          const j = await r.json();
          if (!j.ok) throw new Error(j.error || 'Error del servidor');
          const data = U.normalizeData(j.data);
          lsSet(LS_CACHE, { data, registro: j.registro || null, at: Date.now() });
          return { data, registro: j.registro || null };
        },
        bulk: (ops) => post({ action: 'bulk', ops })
      };
    }
    return {
      mode: 'local',
      async load() { return { data: U.normalizeData(lsGet(LS_DATA)), registro: null }; },
      async bulk() { return { ok: true }; }
    };
  }
  const store = makeStore();

  function applyOps(data, ops) {
    const next = Object.assign({}, data);
    ops.forEach(({ op, col, id, data: obj }) => {
      next[col] = Object.assign({}, next[col]);
      if (op === 'put') next[col][id] = Object.assign({ id }, obj);
      else delete next[col][id];
    });
    return next;
  }

  /* ---------- Tema ---------- */
  function useTheme() {
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    const [pref, setPref] = useState(() => { try { return localStorage.getItem('pozos-gmp-tema'); } catch (e) { return null; } });
    const [sys, setSys] = useState(mq && mq.matches ? 'light' : 'dark');
    useEffect(() => {
      if (!mq) return;
      const f = (e) => setSys(e.matches ? 'light' : 'dark');
      mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f);
      return () => { mq.removeEventListener ? mq.removeEventListener('change', f) : mq.removeListener(f); };
    }, []);
    useEffect(() => {
      if (pref) document.documentElement.setAttribute('data-theme', pref);
      else document.documentElement.removeAttribute('data-theme');
    }, [pref]);
    const set = (t) => { setPref(t); try { localStorage.setItem('pozos-gmp-tema', t); } catch (e) { } };
    return [pref || sys, set];
  }

  /* ---------- Piezas chicas ---------- */
  const cls = (e) => e === 'Operativo' ? 'ok' : e === 'Fuera de servicio' ? 'bad' : 'na';
  function Chip({ e, compact }) {
    return html`<span class=${'chip ' + cls(e.estado)}><i></i>${e.estado}${!compact && e.origen === 'planilla' ? html`<em> · planilla</em>` : null}</span>`;
  }
  function Inset({ l, v, children, style }) {
    return html`<div class="inset" style=${style}><div class="lbl">${l}</div>${v !== undefined ? html`<div class="v">${v}</div>` : null}${children}</div>`;
  }
  function Tile({ c, title, right, glow, children, cn }) {
    return html`<section class=${'tile ' + (c || 's12') + (cn ? ' ' + cn : '')}>
      ${glow ? html`<div class="glow" style=${{ '--gc': glow }}></div>` : null}
      ${title || right ? html`<div class="th"><h3>${title}</h3>${right}</div>` : null}
      ${children}
    </section>`;
  }
  function Fld({ l, children, full }) {
    return html`<label class=${'fld' + (full ? ' full' : '')}><span>${l}</span>${children}</label>`;
  }
  function ConfirmDel({ onYes }) {
    const [ask, setAsk] = useState(false);
    if (!ask) return html`<button class="btn btn-sm btn-ghost" title="Eliminar" onClick=${() => setAsk(true)}>✕</button>`;
    return html`<span class="confirm">¿Eliminar?
      <button class="btn btn-sm btn-danger" onClick=${() => { setAsk(false); onYes(); }}>Sí</button>
      <button class="btn btn-sm" onClick=${() => setAsk(false)}>No</button></span>`;
  }
  const glowOf = (e) => e.estado === 'Operativo' ? 'var(--ok)' : e.estado === 'Fuera de servicio' ? 'var(--bad)' : 'var(--aqua)';
  const tooltipStyle = { background: 'var(--glass2)', border: '1px solid var(--stroke2)', borderRadius: 12, backdropFilter: 'blur(12px)', color: 'var(--fg)', fontSize: 12, boxShadow: 'var(--shadow)' };

  /* =========================================================
     01 · RESUMEN
     ========================================================= */
  function Resumen({ wells, data, est, openWell, pal }) {
    const total = wells.length;
    const ests = wells.map((w) => [w, est(w)]);
    const op = ests.filter(([, e]) => e.estado === 'Operativo').length;
    const fs = ests.filter(([, e]) => e.estado === 'Fuera de servicio').length;
    const cargados = wells.filter((w) => data.relevamiento[w.code] && data.relevamiento[w.code].estadoPozo).length;
    const fincas = U.groupBy(wells, U.fincaDe);
    const barData = fincas.map(([f, ws]) => ({ finca: f, op: ws.filter((w) => est(w).estado === 'Operativo').length, fs: ws.filter((w) => est(w).estado === 'Fuera de servicio').length }));
    const conFn = wells.filter((w) => { const f = data.funcion[w.code]; return f && (f.funcion || f.operacion || (f.destino && f.destino.length)); }).length;
    const acciones = U.sortAcciones(Object.values(data.bitacora)).slice(0, 5);
    const pct = total ? Math.round((op / total) * 100) : 0;
    const pieData = [{ name: 'Operativos', value: op, fill: 'url(#gOp)' }, { name: 'Fuera de servicio', value: fs, fill: 'url(#gFs)' }];
    if (total - op - fs > 0) pieData.push({ name: 'Sin dato', value: total - op - fs, fill: pal.na });

    return html`<div class="bento sec">
      <${Tile} c="s5 r2" title="Pozos relevados" glow="var(--aqua)" right=${html`<span class="chip plain mono">${cargados}/${total} con estado cargado</span>`}>
        <div class="donut">
          ${RC ? html`<${RC.ResponsiveContainer} width="100%" height="100%">
            <${RC.PieChart}>
              <defs>
                <linearGradient id="gOp" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color=${pal.lime}/><stop offset="100%" stop-color=${pal.aqua}/></linearGradient>
                <linearGradient id="gFs" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color=${pal.rose}/><stop offset="100%" stop-color=${pal.amber}/></linearGradient>
              </defs>
              <${RC.Pie} data=${pieData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle=${4} cornerRadius=${10} stroke="none" startAngle=${90} endAngle=${-270} isAnimationActive=${true}>
                ${pieData.map((d) => html`<${RC.Cell} key=${d.name} fill=${d.fill}/>`)}
              <//>
              <${RC.Tooltip} contentStyle=${tooltipStyle} itemStyle=${{ color: 'var(--fg)' }}/>
            <//>
          <//>` : null}
          <div class="center"><div><div class="big">${total}</div><div class="lbl">pozos</div></div></div>
        </div>
        <div class="kv" style=${{ gridTemplateColumns: '1fr 1fr' }}>
          <${Inset} l="Operativos"><div class="disp" style=${{ fontSize: 28, fontWeight: 600, color: 'var(--ok)' }}>${op}</div><//>
          <${Inset} l="Fuera de servicio"><div class="disp" style=${{ fontSize: 28, fontWeight: 600, color: 'var(--bad)' }}>${fs}</div><//>
        </div>
        <p class="note" style=${{ marginBottom: 0 }}>Mientras un pozo no tenga relevamiento cargado, su estado es provisorio y se toma de la planilla (marca “planilla”). Cargá el estado en la Ficha para reemplazarlo.</p>
      <//>

      <${Tile} c="s4" title="Operativos" glow="var(--ok)">
        <div class="row" style=${{ alignItems: 'baseline' }}><span class="big">${op}</span><span class="muted">de ${total}</span></div>
        <div class="bar" style=${{ marginTop: 16 }}><i style=${{ width: pct + '%' }}></i></div>
        <div class="row between" style=${{ marginTop: 8 }}><span class="lbl">Disponibilidad</span><span class="mono">${pct}%</span></div>
      <//>

      <${Tile} c="s3" title="Fuera de servicio" glow="var(--bad)">
        <div class="big" style=${{ color: 'var(--bad)' }}>${fs}</div>
        <div class="row" style=${{ marginTop: 14, gap: 6 }}>
          ${ests.filter(([, e]) => e.estado === 'Fuera de servicio').map(([w]) => html`<button key=${w.code} class="chip bad click" onClick=${() => openWell(w.code)}>${U.shortCode(w.code)}</button>`)}
          ${fs === 0 ? html`<span class="note">Ninguno 🎉</span>` : null}
        </div>
      <//>

      <${Tile} c="s7" title="Pozos por agrícola">
        <div style=${{ height: 220 }}>
          ${RC ? html`<${RC.ResponsiveContainer} width="100%" height="100%">
            <${RC.BarChart} data=${barData} margin=${{ top: 6, right: 6, left: -22, bottom: 0 }} barCategoryGap="28%">
              <defs>
                <linearGradient id="bOp" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color=${pal.aqua}/><stop offset="100%" stop-color=${pal.lime}/></linearGradient>
                <linearGradient id="bFs" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color=${pal.amber}/><stop offset="100%" stop-color=${pal.rose}/></linearGradient>
              </defs>
              <${RC.CartesianGrid} stroke=${pal.grid} vertical=${false}/>
              <${RC.XAxis} dataKey="finca" tick=${{ fill: pal.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} axisLine=${false} tickLine=${false}/>
              <${RC.YAxis} allowDecimals=${false} tick=${{ fill: pal.axis, fontSize: 11 }} axisLine=${false} tickLine=${false}/>
              <${RC.Tooltip} cursor=${{ fill: pal.grid }} contentStyle=${tooltipStyle}/>
              <${RC.Legend} iconType="circle" wrapperStyle=${{ fontSize: 12 }}/>
              <${RC.Bar} dataKey="op" name="Operativos" stackId="a" fill="url(#bOp)" radius=${[0, 0, 8, 8]}/>
              <${RC.Bar} dataKey="fs" name="Fuera de servicio" stackId="a" fill="url(#bFs)" radius=${[8, 8, 0, 0]}/>
            <//>
          <//>` : null}
        </div>
      <//>

      <${Tile} c="s8" title="Pozos por sector" right=${html`<span class="chip plain mono">${conFn}/${total} con función descripta</span>`}>
        <div class="groups">
          ${fincas.map(([f, ws]) => html`<div class="inset" key=${f}>
            <div class="row between" style=${{ marginBottom: 6 }}><span class="lbl">${f}</span><span class="lbl">${ws.length}</span></div>
            ${ws.map((w) => html`<button key=${w.code} class="grp-row" onClick=${() => openWell(w.code)}>
              <span style=${{ minWidth: 0 }}><span class="mono" style=${{ fontSize: 12.5 }}>${w.code}</span><br/><span class="faint" style=${{ fontSize: 11.5 }}>${U.sectorDe(w)}</span></span>
              <${Chip} e=${est(w)} compact/>
            </button>`)}
          </div>`)}
        </div>
      <//>

      <${Tile} c="s4" title="Últimas acciones">
        ${acciones.length ? html`<div class="col">
          ${acciones.map((a) => html`<div class="log" key=${a.id}>
            <div class="lbl">${U.fmtF(a.fecha)} · ${U.shortCode(a.wellId || '')} · ${a.tipo}</div>
            <div class="t">${a.texto}</div>
          </div>`)}
        </div>` : html`<div class="empty">Todavía no hay acciones. Entrá a <b>02 Ficha</b>, elegí un pozo y usá <b>Trazabilidad › Registrar acción</b> para cargar la primera.</div>`}
      <//>
    </div>`;
  }

  /* =========================================================
     02 · FICHA
     ========================================================= */
  function WellList({ wells, sel, setSel, est, showFilters }) {
    const [q, setQ] = useState('');
    const [ff, setFf] = useState('');
    const [fe, setFe] = useState('');
    const fincas = U.groupBy(wells, U.fincaDe).map(([f]) => f);
    const list = wells.filter((w) => {
      const s = (w.code + ' ' + w.agricola + ' ' + w.motor).toLowerCase();
      if (q && !s.includes(q.toLowerCase())) return false;
      if (ff && U.fincaDe(w) !== ff) return false;
      if (fe && est(w).estado !== fe) return false;
      return true;
    });
    return html`<div class="col">
      ${showFilters ? html`
        <input class="inp" placeholder="Buscar código, agrícola o motor…" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Buscar pozo"/>
        <div class="fgrid">
          <select class="inp" value=${ff} onChange=${(e) => setFf(e.target.value)} aria-label="Agrícola"><option value="">Todas</option>${fincas.map((f) => html`<option key=${f}>${f}</option>`)}</select>
          <select class="inp" value=${fe} onChange=${(e) => setFe(e.target.value)} aria-label="Estado"><option value="">Estado</option><option>Operativo</option><option>Fuera de servicio</option></select>
        </div>` : null}
      <div class="only-m">
        <select class="inp" value=${sel} onChange=${(e) => setSel(e.target.value)} aria-label="Pozo">
          ${(list.length ? list : wells).map((w) => html`<option key=${w.code} value=${w.code}>${w.code} · ${est(w).estado}</option>`)}
        </select>
      </div>
      <div class="list only-d">
        ${list.map((w) => { const e = est(w); return html`<button key=${w.code} class=${'well-row' + (w.code === sel ? ' sel' : '')} onClick=${() => setSel(w.code)}>
          <span class=${'dot ' + cls(e.estado)}></span>
          <span class="grow"><span class="c">${w.code}</span><br/><span class="a">${w.agricola} · ${e.estado}</span></span>
        </button>`; })}
        ${list.length === 0 ? html`<div class="empty">Sin resultados.</div>` : null}
      </div>
    </div>`;
  }

  function Ficha({ wells, sel, setSel, data, est, mutate, pal, onPdf, toast }) {
    const w = wells.find((x) => x.code === sel) || wells[0];
    const idx = wells.indexOf(w);
    const e = est(w);
    const pc = U.parseCode(w.code);
    const go = (d) => setSel(wells[(idx + d + wells.length) % wells.length].code);
    const [form, setForm] = useState(null); // null | 'nuevo' | 'editar'
    useEffect(() => { if (form === 'editar') setForm(null); }, [w.code]);
    return html`<div class="split sec">
      <aside class="tile static side">
        <div class="th"><h3>Pozos</h3><div class="row" style=${{ gap: 8 }}><span class="lbl">${wells.length}</span>
          <button class="btn btn-sm btn-acc" onClick=${() => { setForm('nuevo'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>+ Nuevo pozo</button></div></div>
        <${WellList} wells=${wells} sel=${w.code} setSel=${setSel} est=${est} showFilters/>
      </aside>
      <div class="bento">
        ${form ? html`<${PozoForm} key=${form + (form === 'editar' ? w.code : '')} modo=${form} w=${form === 'editar' ? w : null} wells=${wells}
          mutate=${mutate} toast=${toast} onClose=${(code) => { setForm(null); if (code) setSel(code); }}/>` : null}
        <${Tile} c="s12" glow=${glowOf(e)}>
          <div class="row between" style=${{ alignItems: 'flex-start' }}>
            <div style=${{ minWidth: 0 }}>
              <div class="lbl">${w.agricola}</div>
              <h2 class="code-title">${w.code}</h2>
              <div style=${{ marginTop: 8 }}><${Chip} e=${e}/></div>
            </div>
            <div class="row">
              <div class="navbtns"><button class="btn" onClick=${() => go(-1)} aria-label="Pozo anterior">←</button>
              <span class="btn mono" style=${{ cursor: 'default' }}>${idx + 1} / ${wells.length}</span>
              <button class="btn" onClick=${() => go(1)} aria-label="Pozo siguiente">→</button></div>
              <button class="btn btn-acc" onClick=${() => onPdf([w.code])}>${I.pdf} PDF del pozo</button>
            </div>
          </div>
          <div class="kv5" style=${{ marginTop: 16 }}>
            <${Inset} l="Finca" v=${pc.finca}/>
            <${Inset} l="Sector" v=${pc.sector || '—'}/>
            <${Inset} l="Equipo" v=${pc.equipo === 'BP' ? 'BP · bomba de pozo' : pc.equipo}/>
            <${Inset} l="Instalación" v=${pc.inst === 'S' ? 'S · sumergida' : (pc.inst || '—')}/>
            <${Inset} l="Potencia" v=${pc.hp ? pc.hp + ' HP' : '—'}/>
          </div>
        <//>

        <${Tile} c="s7" title="Equipo sumergido en el pozo" right=${html`<button class="btn btn-sm" onClick=${() => { setForm('editar'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar datos</button>`}>
          <div class="kv">
            <${Inset} l="Motor" v=${w.motor || 's/d'}/>
            <${Inset} l="Bomba" v=${w.bomba || 's/d'}/>
            <${Inset} l="Potencia" v=${w.pot || '—'}/>
            <${Inset} l="Cañería" v=${w.caneria || '—'}/>
            <${Inset} l="Alimentación" v=${U.alimentacion(w.red)}/>
            <${Inset} l="Instalación" v=${pc.inst === 'S' ? 'Sumergida' : (pc.inst || '—')}/>
          </div>
          ${w.obs ? html`<div class="inset" style=${{ marginTop: 10, borderColor: 'color-mix(in srgb, var(--amber) 35%, transparent)' }}>
            <div class="lbl" style=${{ color: 'var(--amber)' }}>Observación de planilla</div><div style=${{ marginTop: 4 }}>${w.obs}</div></div>` : null}
        <//>

        <${Tile} c="s5" title="Ubicación">
          ${w.lat != null ? html`<div class="col">
            <div class="kv" style=${{ gridTemplateColumns: '1fr 1fr' }}>
              <${Inset} l="Latitud" v=${w.lat.toFixed(6)}/>
              <${Inset} l="Longitud" v=${w.lon.toFixed(6)}/>
            </div>
            <${Inset} l="Ubicación (GMS)" v=${w.gms}/>
            <a class="btn btn-acc" href=${U.mapsUrl(w.lat, w.lon)} target="_blank" rel="noopener">Abrir en Google Maps ↗</a>
          </div>` : html`<div class="empty">Este pozo no tiene coordenadas en la planilla.</div>`}
        <//>

        <${EstadoTile} w=${w} data=${data} e=${e} mutate=${mutate} toast=${toast}/>
        <${NivelesTile} w=${w} data=${data} pal=${pal}/>
        <${FuncionTile} w=${w} data=${data} mutate=${mutate} toast=${toast}/>
        <${TrazTile} w=${w} data=${data} mutate=${mutate} toast=${toast}/>
        <${AdjTile} w=${w} data=${data} mutate=${mutate} toast=${toast}/>
      </div>
    </div>`;
  }

  const ESTADOS_HOJA = ['Operativo', 'Fuera de servicio'];
  function PozoForm({ modo, w, wells, mutate, toast, onClose }) {
    const nuevo = modo === 'nuevo';
    const lim = (v) => (v == null || v === '—' || v === 's/d') ? '' : String(v);
    const [f, setF] = useState(() => ({
      code: nuevo ? '' : w.code, agricola: nuevo ? '' : lim(w.agricola), gms: nuevo ? '' : lim(w.gms),
      motor: nuevo ? '' : lim(w.motor), bomba: nuevo ? '' : lim(w.bomba), pot: nuevo ? '' : lim(w.pot),
      caneria: nuevo ? '' : lim(w.caneria), estadoPlanilla: nuevo ? 'Operativo' : (U.normEstado(w.estadoPlanilla) === 's/d' ? 'Operativo' : U.normEstado(w.estadoPlanilla)),
      obs: nuevo ? '' : lim(w.obs)
    }));
    const [busy, setBusy] = useState(false);
    const set = (k) => (ev) => setF(Object.assign({}, f, { [k]: ev.target.value }));
    const code = U.normCode(f.code);
    const ll = U.parseGMS(f.gms);
    const dup = nuevo && code && wells.some((x) => x.code === code);
    const pc = U.parseCode(code);
    const save = async () => {
      if (!code) return toast('Poné el código del pozo.', 'bad');
      if (dup) return toast('Ya existe un pozo con ese código.', 'bad');
      if (!f.agricola.trim()) return toast('Poné la agrícola.', 'bad');
      if (f.gms.trim() && !ll) return toast('No entiendo la ubicación. Usá 27° 6\' 8.9" S 65° 34\' 23.4" W', 'bad');
      setBusy(true);
      const d = { code, agricola: f.agricola.trim().toUpperCase(), gms: f.gms.trim(), motor: f.motor.trim() || 's/d', bomba: f.bomba.trim() || 's/d',
        pot: f.pot.trim() || '—', caneria: f.caneria.trim() || '—', estadoPlanilla: f.estadoPlanilla, obs: f.obs.trim(), updatedAt: new Date().toISOString() };
      const ok = await mutate([{ op: 'put', col: 'pozos', id: code, data: d }]);
      setBusy(false);
      if (ok) { toast(nuevo ? 'Pozo agregado a la hoja.' : 'Datos del pozo guardados.'); onClose(code); }
    };
    return html`<${Tile} c="s12" cn="static" glow="var(--lime)" title=${nuevo ? 'Nuevo pozo' : 'Editar datos del pozo'}
      right=${html`<span class="lbl">Se guarda en Ingeniería GMP › POZOS DE AGUA</span>`}>
      <div class="fgrid" style=${{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <${Fld} l="Código de equipo *"><input class="inp mono" value=${f.code} disabled=${!nuevo} onInput=${set('code')} placeholder="FINCA-SECTOR-BP-S-HP"/><//>
        <${Fld} l="Agrícola *"><input class="inp" value=${f.agricola} onInput=${set('agricola')} placeholder="TDA - FINCA"/><//>
        <${Fld} l="Estado actual"><select class="inp" value=${f.estadoPlanilla} onChange=${set('estadoPlanilla')}>${ESTADOS_HOJA.map((x) => html`<option key=${x}>${x}</option>`)}</select><//>
        <${Fld} l="Ubicación (grados, minutos, segundos)"><input class="inp mono" value=${f.gms} onInput=${set('gms')} placeholder=${'27° 6\' 8.9" S 65° 34\' 23.4" W'}/><//>
        <${Fld} l="Motor"><input class="inp" value=${f.motor} onInput=${set('motor')} placeholder="Franklin Electric 40"/><//>
        <${Fld} l="Bomba"><input class="inp" value=${f.bomba} onInput=${set('bomba')}/><//>
        <${Fld} l="Potencia"><input class="inp" value=${f.pot} onInput=${set('pot')} placeholder="40 HP"/><//>
        <${Fld} l="Cant. caños y diámetro"><input class="inp" value=${f.caneria} onInput=${set('caneria')} placeholder='9 caños de 2"'/><//>
        <${Fld} l="Observaciones"><input class="inp" value=${f.obs} onInput=${set('obs')}/><//>
      </div>
      <div class="row between" style=${{ marginTop: 12 }}>
        <div class="note">
          ${code ? html`<span class="mono">${pc.finca}</span> · sector <span class="mono">${pc.sector || '—'}</span> · ${pc.equipo || '—'}${pc.hp ? ' · ' + pc.hp + ' HP' : ''}` : 'Formato: FINCA-SECTOR-BP-INSTALACIÓN-HP'}
          ${f.gms ? (ll ? html` · <span class="mono">${ll.lat.toFixed(5)}, ${ll.lon.toFixed(5)}</span> ✓` : html` · <span class="warn">ubicación no reconocida</span>`) : null}
          ${dup ? html` · <span class="warn">el código ya existe</span>` : null}
        </div>
        <div class="row">
          <button class="btn" onClick=${() => onClose(null)}>Cancelar</button>
          <button class="btn btn-acc" disabled=${busy} onClick=${save}>${busy ? 'Guardando…' : (nuevo ? 'Agregar pozo' : 'Guardar cambios')}</button>
        </div>
      </div>
      ${!nuevo ? html`<p class="note" style=${{ marginBottom: 0 }}>Para dar de baja un pozo, borrá su fila en la hoja POZOS DE AGUA.</p>` : null}
    <//>`;
  }

  function EstadoTile({ w, data, e, mutate, toast }) {
    const r = data.relevamiento[w.code];
    const [edit, setEdit] = useState(false);
    const [f, setF] = useState({});
    const [busy, setBusy] = useState(false);
    useEffect(() => setEdit(false), [w.code]);
    const open = () => {
      setF({ fecha: U.hoy(), estadoPozo: (r && r.estadoPozo) || '', profundidad: U.s(r && r.profundidad), caudal: U.s(r && r.caudal),
        nivelEstatico: U.s(r && r.nivelEstatico), nivelDinamico: U.s(r && r.nivelDinamico), nota: (r && r.nota) || '' });
      setEdit(true);
    };
    const set = (k) => (ev) => setF(Object.assign({}, f, { [k]: ev.target.value }));
    const save = async () => {
      if (!f.estadoPozo) return toast('Elegí el estado del pozo.', 'bad');
      if (!f.fecha) return toast('Cargá la fecha.', 'bad');
      const rec = { fecha: f.fecha, estadoPozo: f.estadoPozo, profundidad: U.num(f.profundidad), nivelEstatico: U.num(f.nivelEstatico),
        nivelDinamico: U.num(f.nivelDinamico), caudal: U.num(f.caudal), nota: f.nota.trim(), updatedAt: new Date().toISOString() };
      const ops = [{ op: 'put', col: 'relevamiento', id: w.code, data: rec }];
      if (rec.nivelEstatico != null || rec.nivelDinamico != null || rec.caudal != null) {
        ops.push({ op: 'put', col: 'mediciones', id: w.code + '_' + rec.fecha, data: { wellId: w.code, fecha: rec.fecha, nivelEstatico: rec.nivelEstatico,
          nivelDinamico: rec.nivelDinamico, caudal: rec.caudal, profundidad: rec.profundidad, updatedAt: rec.updatedAt } });
      }
      setBusy(true);
      const ok = await mutate(ops);
      setBusy(false);
      if (ok) { setEdit(false); toast('Estado guardado.'); }
    };
    const ab = r && r.nivelDinamico != null && r.nivelEstatico != null ? r.nivelDinamico - r.nivelEstatico : null;
    return html`<${Tile} c="s5" title="Estado actual" glow=${glowOf(e)} right=${!edit ? html`<button class="btn btn-sm btn-acc" onClick=${open}>${r ? 'Actualizar' : 'Cargar estado'}</button>` : null}>
      ${edit ? html`<div class="fgrid">
        <${Fld} l="Fecha"><input type="date" class="inp" value=${f.fecha} onInput=${set('fecha')}/><//>
        <div class="fld"><span>Estado del pozo *</span>
          <div class="seg2">
            <button class=${'ok' + (f.estadoPozo === 'Operativo' ? ' on' : '')} onClick=${() => setF(Object.assign({}, f, { estadoPozo: 'Operativo' }))}>Operativo</button>
            <button class=${'bad' + (f.estadoPozo === 'Fuera de servicio' ? ' on' : '')} onClick=${() => setF(Object.assign({}, f, { estadoPozo: 'Fuera de servicio' }))}>Fuera de serv.</button>
          </div></div>
        <${Fld} l="Profundidad (m)"><input class="inp" inputmode="decimal" value=${f.profundidad} onInput=${set('profundidad')}/><//>
        <${Fld} l="Caudal (m³/h)"><input class="inp" inputmode="decimal" value=${f.caudal} onInput=${set('caudal')}/><//>
        <${Fld} l="Nivel estático (m)"><input class="inp" inputmode="decimal" value=${f.nivelEstatico} onInput=${set('nivelEstatico')}/><//>
        <${Fld} l="Nivel dinámico (m)"><input class="inp" inputmode="decimal" value=${f.nivelDinamico} onInput=${set('nivelDinamico')}/><//>
        <${Fld} l="Nota" full><textarea class="inp" value=${f.nota} onInput=${set('nota')} placeholder="Qué se observó, quién relevó…"></textarea><//>
        <div class="row full" style=${{ justifyContent: 'flex-end' }}>
          <button class="btn" onClick=${() => setEdit(false)}>Cancelar</button>
          <button class="btn btn-acc" disabled=${busy} onClick=${save}>${busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>` : html`<div class="col">
        <div>
          <div class="disp" style=${{ fontSize: 26, fontWeight: 600, color: `var(--${cls(e.estado) === 'na' ? 'na' : cls(e.estado)})` }}>${e.estado}</div>
          <div class="note">${r ? 'Relevado el ' + U.fmtF(r.fecha) : 'Provisorio · según hoja POZOS DE AGUA'}</div>
        </div>
        ${r ? html`<div class="kv" style=${{ gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))' }}>
          <${Inset} l="Profundidad" v=${U.fmtU(r.profundidad, 'm')}/>
          <${Inset} l="Nivel estático" v=${U.fmtU(r.nivelEstatico, 'm')}/>
          <${Inset} l="Nivel dinámico" v=${U.fmtU(r.nivelDinamico, 'm')}/>
          <${Inset} l="Abatimiento" v=${U.fmtU(ab, 'm')}/>
          <${Inset} l="Caudal" v=${U.fmtU(r.caudal, 'm³/h')}/>
        </div>` : html`<div class="empty">Sin relevamiento. Tocá <b>Cargar estado</b> para registrar el estado real del pozo, niveles y caudal.</div>`}
        ${r && r.nota ? html`<div class="inset"><div class="lbl">Nota</div><div style=${{ whiteSpace: 'pre-wrap' }}>${r.nota}</div></div>` : null}
      </div>`}
    <//>`;
  }

  function NivelesTile({ w, data, pal }) {
    const ms = Object.values(data.mediciones).filter((m) => m.wellId === w.code).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const rows = ms.map((m) => ({ f: U.fmtF(m.fecha).slice(0, 5) + '/' + String(m.fecha).slice(2, 4), ne: m.nivelEstatico, nd: m.nivelDinamico, q: m.caudal }));
    const maxM = Math.max(1, ...rows.map((r) => Math.max(r.ne || 0, r.nd || 0)));
    return html`<${Tile} c="s7" title="Niveles y caudal" right=${html`<span class="chip plain mono">${ms.length} ${ms.length === 1 ? 'medición' : 'mediciones'}</span>`}>
      ${rows.length && RC ? html`<div style=${{ height: 260 }}>
        <${RC.ResponsiveContainer} width="100%" height="100%">
          <${RC.ComposedChart} data=${rows} margin=${{ top: 6, right: 0, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="aNe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color=${pal.aqua} stop-opacity=".5"/><stop offset="100%" stop-color=${pal.aqua} stop-opacity=".04"/></linearGradient>
              <linearGradient id="aNd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color=${pal.violet} stop-opacity=".45"/><stop offset="100%" stop-color=${pal.violet} stop-opacity=".04"/></linearGradient>
            </defs>
            <${RC.CartesianGrid} stroke=${pal.grid} vertical=${false}/>
            <${RC.XAxis} dataKey="f" tick=${{ fill: pal.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} axisLine=${false} tickLine=${false}/>
            <${RC.YAxis} yAxisId="m" reversed domain=${[0, Math.ceil(maxM * 1.15)]} tick=${{ fill: pal.axis, fontSize: 11 }} axisLine=${false} tickLine=${false} unit=" m"/>
            <${RC.YAxis} yAxisId="q" orientation="right" tick=${{ fill: pal.axis, fontSize: 11 }} axisLine=${false} tickLine=${false} width=${44}/>
            <${RC.Tooltip} contentStyle=${tooltipStyle}/>
            <${RC.Legend} iconType="circle" wrapperStyle=${{ fontSize: 12 }}/>
            <${RC.Area} yAxisId="m" type="monotone" dataKey="ne" name="Nivel estático (m)" stroke=${pal.aqua} strokeWidth=${2} fill="url(#aNe)" baseValue="dataMax" connectNulls dot=${{ r: 3 }}/>
            <${RC.Area} yAxisId="m" type="monotone" dataKey="nd" name="Nivel dinámico (m)" stroke=${pal.violet} strokeWidth=${2} fill="url(#aNd)" baseValue="dataMax" connectNulls dot=${{ r: 3 }}/>
            <${RC.Line} yAxisId="q" type="monotone" dataKey="q" name="Caudal (m³/h)" stroke=${pal.lime} strokeWidth=${2} strokeDasharray="5 4" connectNulls dot=${{ r: 3 }}/>
          <//>
        <//>
      </div>` : html`<div class="empty">Todavía no hay mediciones. Cada vez que guardás un estado con niveles o caudal se agrega un punto a este gráfico (uno por fecha).</div>`}
    <//>`;
  }

  function FuncionTile({ w, data, mutate, toast }) {
    const fn = data.funcion[w.code];
    const [edit, setEdit] = useState(false);
    const [f, setF] = useState({});
    const [busy, setBusy] = useState(false);
    useEffect(() => setEdit(false), [w.code]);
    const open = () => { setF({ destino: (fn && fn.destino) || [], funcion: (fn && fn.funcion) || '', operacion: (fn && fn.operacion) || '', encargados: (fn && fn.encargados) || '', fecha: U.hoy() }); setEdit(true); };
    const set = (k) => (ev) => setF(Object.assign({}, f, { [k]: ev.target.value }));
    const toggle = (d) => setF(Object.assign({}, f, { destino: f.destino.includes(d) ? f.destino.filter((x) => x !== d) : f.destino.concat(d) }));
    const save = async () => {
      setBusy(true);
      const ok = await mutate([{ op: 'put', col: 'funcion', id: w.code, data: { destino: f.destino, funcion: f.funcion.trim(), operacion: f.operacion.trim(), encargados: f.encargados.trim(), fecha: f.fecha, updatedAt: new Date().toISOString() } }]);
      setBusy(false);
      if (ok) { setEdit(false); toast('Función guardada.'); }
    };
    return html`<${Tile} c="s12" title="Función y operación del pozo" right=${!edit ? html`<div class="row">${fn ? html`<span class="lbl">Actualizado ${U.fmtF(fn.fecha)}</span>` : null}<button class="btn btn-sm btn-acc" onClick=${open}>${fn ? 'Editar' : 'Describir función'}</button></div>` : null}>
      ${edit ? html`<div class="fgrid">
        <div class="fld full"><span>Destino del agua</span><div class="toggles">${DESTINOS.map((d) => html`<button key=${d} class=${'tg' + (f.destino.includes(d) ? ' on' : '')} onClick=${() => toggle(d)}>${d}</button>`)}</div></div>
        <${Fld} l="Función (para qué se usa)"><textarea class="inp" value=${f.funcion} onInput=${set('funcion')}></textarea><//>
        <${Fld} l="Cómo opera (según los encargados)"><textarea class="inp" value=${f.operacion} onInput=${set('operacion')} placeholder="Horarios, arranque, a qué represa/red descarga…"></textarea><//>
        <${Fld} l="Encargados / quién lo opera"><input class="inp" value=${f.encargados} onInput=${set('encargados')}/><//>
        <${Fld} l="Fecha"><input type="date" class="inp" value=${f.fecha} onInput=${set('fecha')}/><//>
        <div class="row full" style=${{ justifyContent: 'flex-end' }}>
          <button class="btn" onClick=${() => setEdit(false)}>Cancelar</button>
          <button class="btn btn-acc" disabled=${busy} onClick=${save}>${busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>` : fn ? html`<div class="kv" style=${{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <${Inset} l="Destino">
          <div class="toggles" style=${{ marginTop: 6 }}>${(fn.destino || []).length ? fn.destino.map((d) => html`<span key=${d} class="tg on" style=${{ cursor: 'default' }}>${d}</span>`) : html`<span class="muted">—</span>`}</div>
          <div class="lbl" style=${{ marginTop: 12 }}>Encargados</div><div>${fn.encargados || '—'}</div>
        <//>
        <${Inset} l="Función"><div style=${{ whiteSpace: 'pre-wrap', marginTop: 4 }}>${fn.funcion || '—'}</div><//>
        <${Inset} l="Cómo opera"><div style=${{ whiteSpace: 'pre-wrap', marginTop: 4 }}>${fn.operacion || '—'}</div><//>
      </div>` : html`<div class="empty">Sin describir. Tocá <b>Describir función</b> para registrar el destino del agua, para qué se usa y cómo lo operan.</div>`}
    <//>`;
  }

  function TrazTile({ w, data, mutate, toast }) {
    const items = U.sortAcciones(Object.values(data.bitacora).filter((b) => b.wellId === w.code));
    const blank = () => ({ fecha: U.hoy(), tipo: 'Inspección', resp: '', texto: '' });
    const [f, setF] = useState(blank);
    const [busy, setBusy] = useState(false);
    const set = (k) => (ev) => setF(Object.assign({}, f, { [k]: ev.target.value }));
    const add = async () => {
      if (!f.texto.trim()) return toast('Escribí una descripción.', 'bad');
      setBusy(true);
      const ok = await mutate([{ op: 'put', col: 'bitacora', id: U.uid(), data: { wellId: w.code, fecha: f.fecha, tipo: f.tipo, texto: f.texto.trim(), resp: f.resp.trim(), createdAt: new Date().toISOString() } }]);
      setBusy(false);
      if (ok) { setF(Object.assign(blank(), { resp: f.resp })); toast('Acción registrada.'); }
    };
    return html`<${Tile} c="s6" title="Trazabilidad" right=${html`<span class="chip plain mono">${items.length} registro${items.length === 1 ? '' : 's'}</span>`}>
      <div class="fgrid">
        <${Fld} l="Fecha"><input type="date" class="inp" value=${f.fecha} onInput=${set('fecha')}/><//>
        <${Fld} l="Tipo de acción"><select class="inp" value=${f.tipo} onChange=${set('tipo')}>${TIPOS_ACCION.map((t) => html`<option key=${t}>${t}</option>`)}</select><//>
        <${Fld} l="Responsable" full><input class="inp" value=${f.resp} onInput=${set('resp')}/><//>
        <${Fld} l="Descripción" full><textarea class="inp" value=${f.texto} onInput=${set('texto')}></textarea><//>
        <div class="row full" style=${{ justifyContent: 'flex-end' }}><button class="btn btn-acc" disabled=${busy} onClick=${add}>${busy ? 'Guardando…' : 'Registrar acción'}</button></div>
      </div>
      <div style=${{ marginTop: 16 }}>
        ${items.length ? html`<div class="tl">${items.map((a) => html`<div class="tl-i" key=${a.id}>
          <div class="row between"><span class="lbl">${U.fmtF(a.fecha)} · ${a.tipo}</span><${ConfirmDel} onYes=${() => mutate([{ op: 'del', col: 'bitacora', id: a.id }])}/></div>
          <div class="t">${a.texto}</div>
          ${a.resp ? html`<div class="faint" style=${{ fontSize: 12 }}>Resp.: ${a.resp}</div>` : null}
        </div>`)}</div>` : html`<div class="empty">Sin acciones registradas para este pozo.</div>`}
      </div>
    <//>`;
  }

  function AdjTile({ w, data, mutate, toast }) {
    const items = Object.values(data.adjuntos).filter((a) => a.wellId === w.code).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const blank = () => ({ fecha: U.hoy(), tipo: 'Video', titulo: '', link: '' });
    const [f, setF] = useState(blank);
    const [busy, setBusy] = useState(false);
    const set = (k) => (ev) => setF(Object.assign({}, f, { [k]: ev.target.value }));
    const linkOk = /^https:\/\/\S+$/i.test(f.link.trim());
    const add = async () => {
      if (!f.titulo.trim()) return toast('Poné un título.', 'bad');
      setBusy(true);
      const ok = await mutate([{ op: 'put', col: 'adjuntos', id: U.uid(), data: { wellId: w.code, fecha: f.fecha, tipo: f.tipo, titulo: f.titulo.trim(), link: f.link.trim(), createdAt: new Date().toISOString() } }]);
      setBusy(false);
      if (ok) { setF(blank()); toast('Adjunto agregado.'); }
    };
    return html`<${Tile} c="s6" title="Adjuntos" right=${html`<span class="chip plain mono">${items.length}</span>`}>
      <div class="fgrid">
        <${Fld} l="Fecha"><input type="date" class="inp" value=${f.fecha} onInput=${set('fecha')}/><//>
        <${Fld} l="Tipo"><select class="inp" value=${f.tipo} onChange=${set('tipo')}>${TIPOS_ADJ.map((t) => html`<option key=${t}>${t}</option>`)}</select><//>
        <${Fld} l="Título" full><input class="inp" value=${f.titulo} onInput=${set('titulo')} placeholder="Ej.: Videofilmación del pozo 2025"/><//>
        <${Fld} l="Enlace de Google Drive" full><input class="inp" value=${f.link} onInput=${set('link')} placeholder="https://drive.google.com/…"/><//>
        <div class="full">
          ${f.link && !linkOk ? html`<div class="warn">El enlace tiene que empezar con https://</div>` : null}
          <div class="note">En Drive: Compartir › Copiar vínculo. Revisá que tenga acceso para quien vaya a abrirlo.</div>
        </div>
        <div class="row full" style=${{ justifyContent: 'flex-end' }}><button class="btn btn-acc" disabled=${!linkOk || busy} onClick=${add}>${busy ? 'Guardando…' : 'Agregar enlace'}</button></div>
      </div>
      <div class="col" style=${{ marginTop: 16 }}>
        ${items.length ? items.map((a) => html`<div class="att" key=${a.id}>
          <div class="ico">${String(a.tipo || '').slice(0, 3)}</div>
          <div style=${{ flex: 1, minWidth: 0 }}>
            <div class="tt">${a.titulo}</div>
            <div class="lbl">${U.fmtF(a.fecha)} · ${a.tipo} · ${U.origenLink(a.link)}</div>
          </div>
          <a class="btn btn-sm" href=${a.link} target="_blank" rel="noopener">Abrir ↗</a>
          <${ConfirmDel} onYes=${() => mutate([{ op: 'del', col: 'adjuntos', id: a.id }])}/>
        </div>`) : html`<div class="empty">Sin adjuntos. Pegá el enlace de un video, informe, foto o plano guardado en Drive.</div>`}
      </div>
    <//>`;
  }

  /* =========================================================
     03 · MAPA
     ========================================================= */
  function SatMap({ w, e, pal }) {
    const el = useRef(null);
    const mapRef = useRef(null);
    const mkRef = useRef(null);
    const color = e.estado === 'Operativo' ? pal.ok : e.estado === 'Fuera de servicio' ? pal.bad : pal.na;
    useEffect(() => {
      if (!window.L || !el.current) return;
      const map = L.map(el.current, { zoomControl: false, attributionControl: false, maxZoom: 19, minZoom: 3, zoomSnap: 0.5 });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18 }).addTo(map);
      mapRef.current = map;
      const t = setTimeout(() => map.invalidateSize(), 120);
      return () => { clearTimeout(t); map.remove(); mapRef.current = null; mkRef.current = null; };
    }, []);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || w.lat == null) return;
      const icon = L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="pin" style="--c:${color}"><div class="p"></div><b>${U.esc(U.shortCode(w.code))}</b></div>` });
      if (mkRef.current) mkRef.current.setLatLng([w.lat, w.lon]).setIcon(icon);
      else mkRef.current = L.marker([w.lat, w.lon], { icon, keyboard: false }).addTo(map);
      map.setView([w.lat, w.lon], 17, { animate: false });
    }, [w.code, color]);
    if (!window.L) return html`<div class="mapbox"><div class="map-msg">No se pudo cargar el mapa (Leaflet). Revisá la conexión a internet.</div></div>`;
    const zoom = (d) => mapRef.current && mapRef.current.setZoom(mapRef.current.getZoom() + d);
    const center = () => mapRef.current && w.lat != null && mapRef.current.setView([w.lat, w.lon], 17);
    return html`<div class="mapbox">
      <div ref=${el} style=${{ position: 'absolute', inset: 0 }}></div>
      ${w.lat == null ? html`<div class="map-msg" style=${{ zIndex: 460, background: 'rgba(5,7,10,.7)' }}>Este pozo todavía no tiene coordenadas cargadas en la planilla.</div>` : null}
      <div class="map-ctl">
        <button onClick=${() => zoom(1)} aria-label="Acercar">+</button>
        <button onClick=${() => zoom(-1)} aria-label="Alejar">−</button>
        <button class="w" onClick=${center}>Centrar</button>
      </div>
      <div class="map-credit">Imagen satelital: Esri, Maxar, Earthstar Geographics</div>
    </div>`;
  }

  function Mapa({ wells, sel, setSel, est, goFicha, pal }) {
    const w = wells.find((x) => x.code === sel) || wells[0];
    const idx = wells.indexOf(w);
    const e = est(w);
    const go = (d) => setSel(wells[(idx + d + wells.length) % wells.length].code);
    return html`<div class="bento sec">
      <${Tile} c="s4" title="Pozos por finca" cn="static">
        <div class="only-m"><select class="inp" value=${w.code} onChange=${(ev) => setSel(ev.target.value)}>${wells.map((x) => html`<option key=${x.code} value=${x.code}>${x.code}</option>`)}</select></div>
        <div class="only-d"><div class="col" style=${{ gap: 14 }}>
          ${U.groupBy(wells, U.fincaDe).map(([f, ws]) => html`<div key=${f}>
            <div class="lbl" style=${{ marginBottom: 4 }}>${f}</div>
            ${ws.map((x) => html`<button key=${x.code} class=${'well-row' + (x.code === w.code ? ' sel' : '')} onClick=${() => setSel(x.code)}>
              <span class=${'dot ' + cls(est(x).estado)}></span>
              <span class="grow"><span class="c">${x.code}</span><br/><span class="a">${U.sectorDe(x)}</span></span>
            </button>`)}
          </div>`)}
        </div></div>
      <//>
      <${Tile} c="s8" cn="static">
        <div class="row between" style=${{ marginBottom: 14, alignItems: 'flex-start' }}>
          <div style=${{ minWidth: 0 }}><div class="lbl">${w.agricola}</div><h2 class="code-title">${w.code}</h2><div style=${{ marginTop: 8 }}><${Chip} e=${e}/></div></div>
          <div class="navbtns"><button class="btn" onClick=${() => go(-1)}>←</button><span class="btn mono" style=${{ cursor: 'default' }}>${idx + 1} / ${wells.length}</span><button class="btn" onClick=${() => go(1)}>→</button></div>
        </div>
        <${SatMap} w=${w} e=${e} pal=${pal}/>
        <div class="kv" style=${{ marginTop: 12 }}>
          <${Inset} l="Lat" v=${w.lat != null ? w.lat.toFixed(6) : '—'}/>
          <${Inset} l="Lon" v=${w.lon != null ? w.lon.toFixed(6) : '—'}/>
          <${Inset} l="GMS" v=${w.gms || '—'} style=${{ gridColumn: 'span 2' }}/>
        </div>
        <div class="row" style=${{ marginTop: 12, justifyContent: 'flex-end' }}>
          <button class="btn" onClick=${() => goFicha(w.code)}>Ver ficha</button>
          ${w.lat != null ? html`<a class="btn btn-acc" href=${U.mapsUrl(w.lat, w.lon)} target="_blank" rel="noopener">Abrir en Google Maps ↗</a>` : null}
        </div>
      <//>
    </div>`;
  }

  /* =========================================================
     04 · INFORME
     ========================================================= */
  function Informe({ wells, data, est, openWell, onPdf, logoUrl }) {
    const [selSet, setSelSet] = useState(() => new Set(wells.map((w) => w.code)));
    const known = useRef(new Set(wells.map((w) => w.code)));
    useEffect(() => {
      const nuevos = wells.filter((w) => !known.current.has(w.code)).map((w) => w.code);
      if (!nuevos.length) return;
      nuevos.forEach((c) => known.current.add(c));
      setSelSet((s) => new Set([...s, ...nuevos]));
    }, [wells]);
    const chosen = wells.filter((w) => selSet.has(w.code));
    const op = chosen.filter((w) => est(w).estado === 'Operativo').length;
    const fs = chosen.filter((w) => est(w).estado === 'Fuera de servicio').length;
    const nAgr = new Set(chosen.map(U.fincaDe)).size;
    const toggle = (c) => { const n = new Set(selSet); n.has(c) ? n.delete(c) : n.add(c); setSelSet(n); };
    const acciones = U.sortAcciones(Object.values(data.bitacora)).slice(0, 8);
    const [busy, setBusy] = useState(false);
    const gen = async () => { setBusy(true); try { await onPdf(chosen.map((w) => w.code)); } finally { setBusy(false); } };
    return html`<div class="bento sec">
      <${Tile} c="s12" glow="var(--lime)">
        <div class="row between" style=${{ alignItems: 'flex-start' }}>
          <div>
            <div class="lbl">Informe · ${U.fmtF(U.hoy())}</div>
            <h2 class="h1" style=${{ fontSize: 'clamp(22px,3.4vw,34px)' }}>Estado de pozos de <span class="grad">agua profunda</span></h2>
            <p class="muted" style=${{ margin: 0 }}>${chosen.length} pozo${chosen.length === 1 ? '' : 's'} de ${nAgr} agrícola${nAgr === 1 ? '' : 's'}: ${op} operativo${op === 1 ? '' : 's'} y ${fs} fuera de servicio.</p>
          </div>
          <div class="plate" style=${{ width: 96, height: 70 }}>${logoUrl ? html`<img src=${logoUrl} alt="Grupo MP"/>` : html`<b>GRUPO MP</b>`}</div>
        </div>
      <//>
      <${Tile} c="s4" title="Pozos incluidos"><div class="big">${chosen.length}</div><//>
      <${Tile} c="s4" title="Operativos" glow="var(--ok)"><div class="big" style=${{ color: 'var(--ok)' }}>${op}</div><//>
      <${Tile} c="s4" title="Fuera de servicio" glow="var(--bad)"><div class="big" style=${{ color: 'var(--bad)' }}>${fs}</div><//>

      <${Tile} c="s4" title="Paso 1 · Elegí los pozos" cn="static">
        <div class="row" style=${{ gap: 6, marginBottom: 10 }}>
          <button class="btn btn-sm" onClick=${() => setSelSet(new Set(wells.map((w) => w.code)))}>Todos</button>
          <button class="btn btn-sm" onClick=${() => setSelSet(new Set(wells.filter((w) => est(w).estado === 'Fuera de servicio').map((w) => w.code)))}>Fuera de servicio</button>
          <button class="btn btn-sm" onClick=${() => setSelSet(new Set())}>Ninguno</button>
        </div>
        <div class="checks">
          ${wells.map((w) => html`<label class="ck" key=${w.code}>
            <input type="checkbox" checked=${selSet.has(w.code)} onChange=${() => toggle(w.code)}/>
            <span class=${'dot ' + cls(est(w).estado)}></span>
            <span class="mono" style=${{ fontSize: 12.5, overflowWrap: 'anywhere' }}>${w.code}</span>
          </label>`)}
        </div>
        <button class="btn btn-acc" style=${{ width: '100%', marginTop: 12 }} disabled=${!chosen.length || busy} onClick=${gen}>${I.pdf} ${busy ? 'Generando…' : `Generar PDF (${chosen.length} pozo${chosen.length === 1 ? '' : 's'})`}</button>
      <//>

      <${Tile} c="s8" title="Paso 2 · Vista previa — Situación por pozo" cn="static">
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Código</th><th>Agrícola</th><th>Destino</th><th>Estado del pozo</th><th>Relevado</th><th>Caudal</th></tr></thead>
          <tbody>${chosen.map((w) => { const r = data.relevamiento[w.code]; const fn = data.funcion[w.code]; return html`<tr key=${w.code} class="click" onClick=${() => openWell(w.code)}>
            <td class="mono" style=${{ fontSize: 12 }}>${w.code}</td><td>${w.agricola}</td>
            <td>${fn && fn.destino && fn.destino.length ? fn.destino.join(', ') : html`<span class="faint">—</span>`}</td>
            <td><${Chip} e=${est(w)}/></td><td class="mono">${r ? U.fmtF(r.fecha) : '—'}</td><td class="mono">${r ? U.fmtU(r.caudal, 'm³/h') : '—'}</td>
          </tr>`; })}</tbody>
        </table></div>
        ${!chosen.length ? html`<div class="empty" style=${{ marginTop: 10 }}>Elegí al menos un pozo.</div>` : null}
        <p class="note">“· planilla” = el pozo todavía no tiene relevamiento; el estado es el de la hoja POZOS DE AGUA. Tocá una fila para abrir la ficha.</p>
      <//>

      <${Tile} c="s12" title="Últimas acciones registradas">
        ${acciones.length ? html`<div class="groups">${acciones.map((a) => html`<div class="log" key=${a.id}>
          <div class="lbl">${U.fmtF(a.fecha)} · ${U.shortCode(a.wellId || '')} · ${a.tipo}${a.resp ? ' · ' + a.resp : ''}</div><div class="t">${a.texto}</div></div>`)}</div>`
          : html`<div class="empty">Sin acciones registradas todavía.</div>`}
      <//>
    </div>`;
  }

  /* =========================================================
     APP
     ========================================================= */
  function App() {
    const [theme, setTheme] = useTheme();
    const pal = PAL[theme];
    const [tab, setTab] = useState(() => { const h = location.hash.slice(1); return TABS.some((t) => t.id === h) ? h : 'resumen'; });
    const [data, setData] = useState(U.normalizeData(null));
    const [registro, setRegistro] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [srcState, setSrcState] = useState(store.mode === 'sheets' ? 'cargando' : 'local');
    const [toastMsg, setToastMsg] = useState(null);
    const [logoUrl, setLogoUrl] = useState(null);
    const dataRef = useRef(data);
    dataRef.current = data;

    const toast = useCallback((m, k) => { setToastMsg({ m, k: k || 'ok', t: Date.now() }); }, []);
    useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 3200); return () => clearTimeout(t); }, [toastMsg]);

    const wells = useMemo(() => U.buildWells(window.POZOS_BASE || [], CFG.EXTRA_WELLS || [], registro, data.pozos), [registro, data.pozos]);
    const [sel, setSel] = useState(() => (wells[0] || {}).code);

    const est = useCallback((w) => {
      const r = data.relevamiento[w.code];
      if (r && r.estadoPozo) return { estado: r.estadoPozo, origen: 'relevamiento', fecha: r.fecha };
      return { estado: U.normEstado(w.estadoPlanilla), origen: 'planilla' };
    }, [data]);

    const load = useCallback(async () => {
      setSrcState(store.mode === 'sheets' ? 'cargando' : 'local');
      try {
        const r = await store.load();
        setData(r.data);
        if (r.registro) setRegistro(r.registro);
        setSrcState(store.mode === 'sheets' ? 'ok' : 'local');
      } catch (err) {
        console.error(err);
        const c = lsGet(LS_CACHE);
        if (c) { setData(U.normalizeData(c.data)); if (c.registro) setRegistro(c.registro); }
        setSrcState('error');
        toast('No se pudo leer Google Sheets' + (c ? '; se muestra la última copia guardada.' : '.'), 'bad');
      }
      setLoaded(true);
    }, []);
    useEffect(() => { load(); }, []);
    useEffect(() => { if (loaded && store.mode === 'local') lsSet(LS_DATA, data); }, [data, loaded]);
    useEffect(() => { U.loadLogo().then((l) => l && setLogoUrl(l.url)); }, []);
    useEffect(() => { history.replaceState(null, '', '#' + tab); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [tab]);

    const mutate = useCallback(async (ops) => {
      const prev = dataRef.current;
      setData(applyOps(prev, ops));
      try { await store.bulk(ops); return true; } catch (err) {
        console.error(err);
        setData(prev);
        toast('No se pudo guardar: ' + err.message, 'bad');
        return false;
      }
    }, []);

    const ti = TABS.findIndex((t) => t.id === tab);
    const step = (d) => setTab(TABS[(ti + d + TABS.length) % TABS.length].id);
    useEffect(() => {
      const f = (ev) => {
        const tg = ev.target;
        if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
        if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
        if (ev.key === 'ArrowRight') step(1);
        if (ev.key === 'ArrowLeft') step(-1);
      };
      window.addEventListener('keydown', f);
      return () => window.removeEventListener('keydown', f);
    });

    const openWell = (code) => { setSel(code); setTab('ficha'); };
    const onPdf = async (codes) => {
      try { await window.PozosPDF.generar(codes, { wells, data: dataRef.current, est }); }
      catch (err) { console.error(err); toast('No se pudo generar el PDF: ' + err.message, 'bad'); }
    };

    const exportJSON = () => {
      const blob = new Blob([JSON.stringify({ exportado: new Date().toISOString(), data: dataRef.current }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pozos-gmp-datos-' + U.hoy() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    const fileRef = useRef(null);
    const importJSON = async (ev) => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const j = JSON.parse(await file.text());
        const inc = U.normalizeData(j.data || j);
        const ops = [];
        Object.keys(inc).forEach((col) => Object.keys(inc[col]).forEach((id) => ops.push({ op: 'put', col, id, data: inc[col][id] })));
        if (!ops.length) return toast('El archivo no tiene datos.', 'bad');
        const ok = await mutate(ops);
        if (ok) toast(`Importados ${ops.length} registros.`);
      } catch (err) { toast('Archivo inválido: ' + err.message, 'bad'); }
    };

    if (!wells.length) return html`<div class="boot">No hay pozos cargados.</div>`;
    const selW = wells.some((w) => w.code === sel) ? sel : wells[0].code;

    const srcLabel = { local: 'Datos: este navegador', cargando: 'Datos: conectando…', ok: 'Datos: Google Sheets', error: 'Datos: sin conexión' }[srcState];
    const srcDot = { local: 'na', cargando: 'na', ok: 'ok', error: 'bad' }[srcState];

    return html`<div class="wrap">
      <header class="hdr">
        <div class="brand">
          <div class="plate">${logoUrl ? html`<img src=${logoUrl} alt="Grupo MP"/>` : html`<b>GMP</b>`}</div>
          <div style=${{ minWidth: 0 }}>
            <div class="eyebrow">Ingeniería · Riego · Grupo MP</div>
            <h1 class="h1">Pozos de agua <span class="grad">profunda</span></h1>
            <div class="sub">${wells.length} pozos de <a href=${CFG.SHEET_URL} target="_blank" rel="noopener">Ingeniería GMP › POZOS DE AGUA</a>${srcState === 'ok' ? ' · en vivo' : (CFG.DATOS_AL ? ' · copia al ' + CFG.DATOS_AL : '')}</div>
          </div>
        </div>
        <div class="hdr-r">
          <div class="seg" role="group" aria-label="Tema">
            <button class=${theme === 'light' ? 'on' : ''} onClick=${() => setTheme('light')}>${I.sun} Claro</button>
            <button class=${theme === 'dark' ? 'on' : ''} onClick=${() => setTheme('dark')}>${I.moon} Oscuro</button>
          </div>
          <div class="navbtns"><button class="btn" onClick=${() => step(-1)}>← Anterior</button><button class="btn" onClick=${() => step(1)}>Siguiente →</button></div>
        </div>
      </header>

      <nav class="tabs" role="tablist">
        ${TABS.map((t) => html`<button key=${t.id} role="tab" aria-selected=${t.id === tab} class=${'tab' + (t.id === tab ? ' on' : '')} onClick=${() => setTab(t.id)}><span class="n">${t.n}</span>${t.t}</button>`)}
      </nav>

      <main key=${tab}>
        ${tab === 'resumen' ? html`<${Resumen} wells=${wells} data=${data} est=${est} openWell=${openWell} pal=${pal}/>` : null}
        ${tab === 'ficha' ? html`<${Ficha} wells=${wells} sel=${selW} setSel=${setSel} data=${data} est=${est} mutate=${mutate} pal=${pal} onPdf=${onPdf} toast=${toast}/>` : null}
        ${tab === 'mapa' ? html`<${Mapa} wells=${wells} sel=${selW} setSel=${setSel} est=${est} goFicha=${openWell} pal=${pal}/>` : null}
        ${tab === 'informe' ? html`<${Informe} wells=${wells} data=${data} est=${est} openWell=${openWell} onPdf=${onPdf} logoUrl=${logoUrl}/>` : null}
      </main>

      <footer class="ftr">
        <span><kbd>←</kbd> <kbd>→</kbd> para avanzar entre secciones</span>
        <span>FINCA-SECTOR-BP-INSTALACIÓN-HP · BP = bomba de pozo · S = sumergida</span>
        <span class="tools">
          <span class="badge-src"><span class=${'dot ' + srcDot}></span>${srcLabel}</span>
          ${store.mode === 'sheets' ? html`<button class="btn btn-sm" onClick=${load} title="Volver a leer la planilla">${I.refresh} Recargar</button>` : null}
          <button class="btn btn-sm" onClick=${exportJSON}>Exportar JSON</button>
          <button class="btn btn-sm" onClick=${() => fileRef.current && fileRef.current.click()}>Importar JSON</button>
          <input ref=${fileRef} type="file" accept="application/json,.json" class="sr" onChange=${importJSON}/>
        </span>
      </footer>
      ${toastMsg ? html`<div class=${'toast ' + toastMsg.k} role="status" key=${toastMsg.t}>${toastMsg.m}</div>` : null}
    </div>`;
  }

  /* ---------- Arranque ---------- */
  const root = document.getElementById('root');
  if (!window.React || !window.ReactDOM || !window.htm) {
    root.innerHTML = '<div class="boot">No se pudieron cargar las librerías. Revisá la conexión a internet y recargá.</div>';
    return;
  }
  ReactDOM.createRoot(root).render(html`<${App}/>`);
})();
