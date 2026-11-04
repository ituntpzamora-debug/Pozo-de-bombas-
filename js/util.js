/* Utilidades compartidas (app y PDF) */
window.PozosUtil = (function () {
  'use strict';
  const COLS = ['relevamiento', 'mediciones', 'funcion', 'bitacora', 'adjuntos', 'pozos'];
  const NUMS = ['profundidad', 'nivelEstatico', 'nivelDinamico', 'caudal'];
  const pad = (n) => String(n).padStart(2, '0');

  const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmtF = (s) => {
    if (!s) return '—';
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
  };
  const num = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(String(v).trim().replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  };
  const s = (v) => (v == null ? '' : String(v));
  const fmtN = (v, d) => (v == null || v === '' || !isFinite(v)) ? '—' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: d == null ? 2 : d });
  const fmtU = (v, u) => (v == null || v === '' || !isFinite(v)) ? '—' : fmtN(v) + ' ' + u;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function parseGMS(str) {
    if (!str) return null;
    const re = /(\d+(?:[.,]\d+)?)\s*°\s*(\d+(?:[.,]\d+)?)?\s*['’′]?\s*(\d+(?:[.,]\d+)?)?\s*(?:["”″]|'')?\s*([NSns])\s*[,;]?\s*(\d+(?:[.,]\d+)?)\s*°\s*(\d+(?:[.,]\d+)?)?\s*['’′]?\s*(\d+(?:[.,]\d+)?)?\s*(?:["”″]|'')?\s*([EWOewo])/;
    const m = String(str).match(re);
    if (m) {
      const f = (x) => (x ? Number(x.replace(',', '.')) : 0);
      let lat = f(m[1]) + f(m[2]) / 60 + f(m[3]) / 3600;
      let lon = f(m[5]) + f(m[6]) / 60 + f(m[7]) / 3600;
      if (/[Ss]/.test(m[4])) lat = -lat;
      if (/[WwOo]/.test(m[8])) lon = -lon;
      return { lat, lon };
    }
    const d = String(str).match(/(-?\d+\.\d+)\s*[,; ]\s*(-?\d+\.\d+)/); // ya en decimal
    if (d) return { lat: Number(d[1]), lon: Number(d[2]) };
    return null;
  }

  function parseCode(code) {
    const parts = String(code).split('-').filter((p) => p !== '');
    let i = parts.indexOf('BP');
    if (i < 0) i = parts.length;
    const hp = parts[i + 2] && /^\d+([.,]\d+)?$/.test(parts[i + 2]) ? parts[i + 2] : '';
    return { finca: parts[0] || '', sector: parts.slice(1, i).join('-'), equipo: parts[i] || '', inst: parts[i + 1] || '', hp };
  }
  const shortCode = (c) => String(c).split('-')[0];
  const fincaDe = (w) => (String(w.agricola || '').split(' - ')[0].trim() || 'OTRA').toUpperCase();
  const sectorDe = (w) => String(w.agricola || '').split(' - ').slice(1).join(' - ').trim() || '—';
  const mapsUrl = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;
  const normEstado = (e) => {
    const t = String(e || '').toLowerCase();
    if (/fuera|inutil|no oper|parad/.test(t)) return 'Fuera de servicio';
    if (/oper/.test(t)) return 'Operativo';
    return 's/d';
  };
  const alimentacion = (red) => {
    const t = String(red || '').toLowerCase();
    if (!t || t === '—' || t === '-') return 's/d';
    if (t.includes('red') && t.includes('grupo')) return 'Red y grupo electrógeno';
    if (t.includes('red')) return 'Red eléctrica';
    if (t.includes('grupo')) return 'Grupo electrógeno';
    return red;
  };
  const origenLink = (l) => /drive\.google|docs\.google/i.test(l || '') ? 'Google Drive' : /youtu\.?be/i.test(l || '') ? 'YouTube' : 'Enlace';

  function groupBy(arr, fn) {
    const m = new Map();
    arr.forEach((x) => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
    return Array.from(m.entries());
  }
  const sortAcciones = (arr) => arr.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  function normalizeData(raw) {
    const out = {};
    COLS.forEach((c) => {
      out[c] = {};
      const src = raw && raw[c];
      if (!src) return;
      const list = Array.isArray(src) ? src : Object.keys(src).map((k) => Object.assign({ id: k }, src[k]));
      list.forEach((r) => {
        if (!r || !r.id) return;
        const o = Object.assign({}, r);
        NUMS.forEach((k) => { if (k in o) o[k] = num(o[k]); });
        if (c === 'funcion') {
          let d = o.destino;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = d ? d.split(/\s*,\s*/) : []; } }
          o.destino = Array.isArray(d) ? d : [];
        }
        ['fecha'].forEach((k) => { if (o[k] && /^\d{4}-\d{2}-\d{2}T/.test(o[k])) o[k] = o[k].slice(0, 10); });
        out[c][o.id] = o;
      });
    });
    return out;
  }

  function cleanTxt(x) {
    const t = String(x == null ? '' : x).trim();
    return !t || /^\?+$/.test(t) ? '' : t;
  }
  function fromRegistro(r) {
    const mm = String(r.marcaModelo || '');
    const mot = (mm.match(/Motor:\s*([^/]*)/i) || [])[1];
    const bom = (mm.match(/Bomba:\s*([^/]*)/i) || [])[1];
    const pot = cleanTxt(String(r.potencia || '').split('/')[0]).replace(/(\d)\s*HP/i, '$1 HP');
    return {
      code: normCode(r.codigo), agricola: cleanTxt(r.agricola) || 'S/D', gms: cleanTxt(r.ubicacion),
      motor: cleanTxt(mot) || (!/motor|bomba/i.test(mm) && cleanTxt(mm)) || 's/d', bomba: cleanTxt(bom) || 's/d',
      pot: pot || '—', caneria: cleanTxt(r.canos) || '—', estadoPlanilla: normEstado(r.estado), red: cleanTxt(r.red) || '—', obs: cleanTxt(r.obs),
      fuente: 'registro'
    };
  }

  const normCode = (c) => String(c || '').trim().replace(/\s+/g, '').replace(/-+$/, '').toUpperCase();

  const vacio = (v) => v == null || v === '' || v === '—' || v === 's/d' || v === 'S/D';
  const withLL = (w) => {
    const ll = parseGMS(w.gms) || (w.lat != null && w.lon != null && w.lat !== '' ? { lat: Number(w.lat), lon: Number(w.lon) } : null);
    return Object.assign({}, w, { lat: ll ? ll.lat : null, lon: ll ? ll.lon : null });
  };

  /* Arma la lista de pozos.
     - maestra: filas de la hoja "POZOS DE AGUA" (si hay conexión). Manda la hoja: orden, altas y datos.
       Los campos vacíos en la hoja se completan con la copia fija de pozos.js.
     - sin conexión: copia fija de pozos.js + EXTRA_WELLS.
     - locales: pozos dados de alta/editados desde la web (se superponen). */
  function buildWells(base, extra, maestra, locales) {
    const baseIdx = new Map(base.concat(extra).map((w) => [normCode(w.code), w]));
    const list = [];
    const idx = new Map();
    const put = (w) => {
      const c = normCode(w.code);
      if (!c) return;
      const o = withLL(Object.assign({}, w, { code: c }));
      if (idx.has(c)) { const i = list.indexOf(idx.get(c)); list[i] = o; } else list.push(o);
      idx.set(c, o);
    };
    if (Array.isArray(maestra) && maestra.length) {
      maestra.forEach((r) => {
        const s = fromRegistro(r);
        const b = baseIdx.get(s.code);
        if (b) Object.keys(b).forEach((k) => { if (vacio(s[k]) && !vacio(b[k])) s[k] = b[k]; });
        put(s);
      });
      extra.forEach((w) => { if (!idx.has(normCode(w.code))) put(w); });
    } else {
      base.forEach(put);
      extra.forEach(put);
    }
    Object.values(locales || {}).forEach((p) => {
      const c = normCode(p.code || p.id);
      const prev = idx.get(c) || {};
      put(Object.assign({}, prev, p, { code: c }));
    });
    return list;
  }

  let logoPromise = null;
  function loadLogo() {
    if (logoPromise) return logoPromise;
    logoPromise = (async () => {
      try {
        const r = await fetch('assets/logo.png', { cache: 'force-cache' });
        if (!r.ok) return null;
        const b = await r.blob();
        const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        return { url, w: img.naturalWidth, h: img.naturalHeight };
      } catch (e) { return null; }
    })();
    return logoPromise;
  }

  return { COLS, normCode, hoy, fmtF, num, s, fmtN, fmtU, uid, esc, parseGMS, parseCode, shortCode, fincaDe, sectorDe, mapsUrl, normEstado,
    alimentacion, origenLink, groupBy, sortAcciones, normalizeData, buildWells, loadLogo };
})();
