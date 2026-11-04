/* Informe PDF — jsPDF + jspdf-autotable, A4 en mm */
window.PozosPDF = (function () {
  'use strict';
  const U = window.PozosUtil;
  const OL = [79, 125, 0], TEAL = [11, 133, 121], OK = [17, 133, 90], BAD = [201, 47, 67], GR = [110, 122, 116], INK = [16, 26, 22], LINE = [218, 225, 221];
  const M = 14, PW = 210, TOP = 40, BOTTOM = 280;

  // Helvetica de jsPDF solo cubre Latin-1: reemplazamos lo que no entra.
  const T = (x) => String(x == null ? '' : x)
    .replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/[↗→]/g, '>').replace(/←/g, '<')
    .replace(/[^\x00-\xFF]/g, '');
  const v = (x, u) => (x == null || x === '' ? '-' : U.fmtN(x) + (u ? ' ' + u : ''));

  async function generar(codes, ctx) {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF no cargó');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    if (typeof doc.autoTable !== 'function') throw new Error('jspdf-autotable no cargó');
    const logo = await U.loadLogo();
    const wells = codes.map((c) => ctx.wells.find((w) => w.code === c)).filter(Boolean);
    const { data, est } = ctx;
    const multi = wells.length > 1;
    const titles = {};
    let cur = { t: '', s: '' };
    let y = TOP;
    const mark = () => { titles[doc.getNumberOfPages()] = Object.assign({}, cur); };
    const newPage = () => { doc.addPage(); mark(); y = TOP; };
    const ensure = (h) => { if (y + h > BOTTOM) newPage(); };

    const h2 = (txt) => {
      ensure(14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...OL);
      doc.text(T(txt).toUpperCase(), M, y + 4);
      y += 7;
    };
    const table = (title, head, body, opts) => {
      if (title) h2(title);
      doc.autoTable(Object.assign({
        startY: y, head: head ? [head] : undefined, body,
        margin: { top: TOP, left: M, right: M, bottom: 297 - BOTTOM },
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 2.1, lineColor: LINE, lineWidth: 0.2, textColor: INK, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: OL, textColor: 255, fontStyle: 'bold', fontSize: 8.4 },
        alternateRowStyles: { fillColor: [247, 249, 247] },
        didDrawPage: () => { if (!titles[doc.getNumberOfPages()]) mark(); },
        didDrawCell: (d) => { const raw = d.cell.raw; if (raw && typeof raw === 'object' && typeof raw.href === 'string' && d.section === 'body') doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url: raw.href }); }
      }, opts || {}));
      y = doc.lastAutoTable.finalY + 7;
    };
    const kvTable = (title, rows) => table(title, null, rows.map(([k, val]) => [{ content: T(k), styles: { fontStyle: 'bold', textColor: GR, cellWidth: 52 } }, typeof val === 'object' && val ? val : T(val)]));
    const linkCell = (txt, url) => ({ content: T(txt), href: url, styles: { textColor: TEAL, fontStyle: 'bold' } });
    const estadoTxt = (w) => { const e = est(w); return e.estado + (e.origen === 'planilla' ? ' (planilla)' : ''); };
    const colorEstado = (d, col) => {
      if (d.section !== 'body' || d.column.index !== col) return;
      const t = String(d.cell.raw);
      if (t.startsWith('Operativo')) { d.cell.styles.textColor = OK; d.cell.styles.fontStyle = 'bold'; }
      if (t.startsWith('Fuera')) { d.cell.styles.textColor = BAD; d.cell.styles.fontStyle = 'bold'; }
    };
    const destinoDe = (w) => { const f = data.funcion[w.code]; return f && f.destino && f.destino.length ? f.destino.join(', ') : '-'; };
    const nivelesDe = (w) => {
      const r = data.relevamiento[w.code];
      if (!r) return '-';
      const p = [];
      if (r.nivelEstatico != null) p.push('NE ' + v(r.nivelEstatico, 'm'));
      if (r.nivelDinamico != null) p.push('ND ' + v(r.nivelDinamico, 'm'));
      if (r.caudal != null) p.push(v(r.caudal, 'm3/h'));
      return p.length ? p.join(' · ') : '-';
    };
    const accionesDe = (codesSet, n) => U.sortAcciones(Object.values(data.bitacora).filter((a) => codesSet.has(a.wellId))).slice(0, n);

    /* ---------- Portada (varios pozos) ---------- */
    if (multi) {
      cur = { t: 'Estado de pozos de agua profunda', s: `Informe al ${U.fmtF(U.hoy())} · ${wells.length} pozos` };
      mark();
      const op = wells.filter((w) => est(w).estado === 'Operativo').length;
      const fs = wells.filter((w) => est(w).estado === 'Fuera de servicio').length;
      const boxes = [['Pozos relevados', wells.length, INK], ['Operativos', op, OK], ['Fuera de servicio', fs, BAD]];
      const bw = (PW - 2 * M - 8) / 3;
      boxes.forEach(([l, n, c], i) => {
        const x = M + i * (bw + 4);
        doc.setDrawColor(...LINE); doc.setFillColor(247, 249, 247); doc.setLineWidth(0.3);
        doc.roundedRect(x, y, bw, 24, 3, 3, 'FD');
        doc.setFillColor(...c); doc.rect(x, y + 4, 1.4, 16, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR);
        doc.text(T(l).toUpperCase(), x + 6, y + 8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...c);
        doc.text(String(n), x + 6, y + 19);
      });
      y += 32;
      table('Situación por pozo', ['Código', 'Agrícola', 'Destino', 'Estado del pozo', 'Relevado', 'Niveles / caudal'],
        wells.map((w) => [T(w.code), T(w.agricola), T(destinoDe(w)), T(estadoTxt(w)), data.relevamiento[w.code] ? U.fmtF(data.relevamiento[w.code].fecha) : '-', T(nivelesDe(w))]),
        { columnStyles: { 0: { cellWidth: 36, font: 'courier', fontSize: 7.8 }, 4: { cellWidth: 19 } }, didParseCell: (d) => colorEstado(d, 3) });
      const acc = accionesDe(new Set(codes), 15);
      if (acc.length) {
        table('Últimas acciones registradas', ['Fecha', 'Pozo', 'Acción', 'Detalle', 'Responsable'],
          acc.map((a) => [U.fmtF(a.fecha), T(U.shortCode(a.wellId)), T(a.tipo), T(a.texto), T(a.resp || '-')]),
          { columnStyles: { 0: { cellWidth: 19 }, 1: { cellWidth: 16 }, 2: { cellWidth: 26 }, 4: { cellWidth: 28 } } });
      }
    }

    /* ---------- Ficha por pozo ---------- */
    wells.forEach((w, i) => {
      cur = { t: 'Pozo ' + w.code, s: w.agricola };
      if (multi || i > 0) newPage(); else mark();
      const e = est(w);
      const r = data.relevamiento[w.code];
      const fn = data.funcion[w.code];
      const pc = U.parseCode(w.code);
      // etiqueta de estado
      const col = e.estado === 'Operativo' ? OK : e.estado === 'Fuera de servicio' ? BAD : GR;
      const lab = 'POZO ' + T(e.estado).toUpperCase();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      const lw = doc.getTextWidth(lab) + 10;
      doc.setFillColor(...col); doc.roundedRect(M, y, lw, 8, 2, 2, 'F');
      doc.setTextColor(255); doc.text(lab, M + 5, y + 5.4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GR);
      doc.text(T(e.origen === 'planilla' ? 'Estado provisorio según hoja POZOS DE AGUA (sin relevamiento cargado)' : 'Estado según relevamiento del ' + U.fmtF(r.fecha)), M + lw + 4, y + 5.3);
      y += 14;

      kvTable('Ubicación', [
        ['Agrícola', w.agricola],
        ['Coordenadas', w.lat != null ? `${w.lat.toFixed(6)}, ${w.lon.toFixed(6)}  (${w.gms})` : 'Sin coordenadas'],
        ['Mapa', w.lat != null ? linkCell('Abrir ubicación en Google Maps', U.mapsUrl(w.lat, w.lon)) : '-']
      ]);
      kvTable('Equipo sumergido en el pozo', [
        ['Código', `${pc.finca} · sector ${pc.sector || '-'} · ${pc.equipo} · instalación ${pc.inst === 'S' ? 'sumergida' : (pc.inst || '-')}`],
        ['Motor', w.motor || 's/d'], ['Bomba', w.bomba || 's/d'], ['Potencia', w.pot || '-'], ['Cañería', w.caneria || '-'],
        ['Alimentación', U.alimentacion(w.red)], ['Observación de planilla', w.obs || '-']
      ]);
      if (r) {
        const ab = r.nivelDinamico != null && r.nivelEstatico != null ? r.nivelDinamico - r.nivelEstatico : null;
        kvTable('Relevamiento del pozo', [
          ['Fecha', U.fmtF(r.fecha)], ['Estado', r.estadoPozo], ['Profundidad', v(r.profundidad, 'm')],
          ['Nivel estático', v(r.nivelEstatico, 'm')], ['Nivel dinámico', v(r.nivelDinamico, 'm')], ['Abatimiento', v(ab, 'm')],
          ['Caudal', v(r.caudal, 'm3/h')], ['Nota', r.nota || '-']
        ]);
      } else {
        kvTable('Relevamiento del pozo', [['Estado', 'Sin relevamiento cargado']]);
      }
      const ms = Object.values(data.mediciones).filter((m) => m.wellId === w.code).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      if (ms.length > 1) {
        table('Historial de mediciones', ['Fecha', 'Nivel estático', 'Nivel dinámico', 'Abatimiento', 'Caudal'],
          ms.map((m) => [U.fmtF(m.fecha), v(m.nivelEstatico, 'm'), v(m.nivelDinamico, 'm'),
            v(m.nivelDinamico != null && m.nivelEstatico != null ? m.nivelDinamico - m.nivelEstatico : null, 'm'), v(m.caudal, 'm3/h')]));
      }
      kvTable('Función y operación', fn ? [
        ['Destino del agua', fn.destino && fn.destino.length ? fn.destino.join(', ') : '-'], ['Función', fn.funcion || '-'],
        ['Cómo opera', fn.operacion || '-'], ['Encargados', fn.encargados || '-'], ['Actualizado', U.fmtF(fn.fecha)]
      ] : [['Función', 'Sin describir']]);
      const acc = accionesDe(new Set([w.code]), 999);
      if (acc.length) {
        table('Trazabilidad', ['Fecha', 'Acción', 'Detalle', 'Responsable'], acc.map((a) => [U.fmtF(a.fecha), T(a.tipo), T(a.texto), T(a.resp || '-')]),
          { columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 30 }, 3: { cellWidth: 32 } } });
      } else kvTable('Trazabilidad', [['Registros', 'Sin acciones registradas']]);
      const adj = Object.values(data.adjuntos).filter((a) => a.wellId === w.code).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      if (adj.length) {
        table('Adjuntos', ['Título', 'Tipo', 'Fecha', 'Enlace'], adj.map((a) => [T(a.titulo), T(a.tipo), U.fmtF(a.fecha), linkCell('Abrir (' + U.origenLink(a.link) + ')', a.link)]),
          { columnStyles: { 1: { cellWidth: 20 }, 2: { cellWidth: 20 }, 3: { cellWidth: 42 } } });
      }
    });

    /* ---------- Encabezado y pie en cada página ---------- */
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      const tt = titles[p] || cur;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...OL);
      doc.text('INGENIERÍA · RIEGO · GRUPO MP', M, 13);
      doc.setFontSize(18); doc.setTextColor(...INK);
      doc.text(T(tt.t), M, 22.5, { maxWidth: PW - 2 * M - 34 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GR);
      doc.text(T(tt.s), M, 29);
      if (logo) {
        const bw = 27, bh = 19.9, r = Math.min(bw / logo.w, bh / logo.h);
        const lw = logo.w * r, lh = logo.h * r;
        try { doc.addImage(logo.url, 'PNG', PW - M - bw + (bw - lw) / 2, 8 + (bh - lh) / 2, lw, lh); } catch (e) { /* imagen inválida */ }
      } else {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...OL);
        doc.text('GRUPO MP', PW - M, 20, { align: 'right' });
      }
      doc.setDrawColor(...OL); doc.setLineWidth(0.9); doc.line(M, 33, PW - M, 33);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR);
      doc.text(`Grupo MP · Pozos de agua profunda · pág. ${p}/${n}`, PW / 2, 290, { align: 'center' });
    }
    doc.save(multi ? `Informe_Pozos_GrupoMP_${U.hoy()}.pdf` : `Pozo_${wells[0].code}.pdf`);
  }
  return { generar };
})();
