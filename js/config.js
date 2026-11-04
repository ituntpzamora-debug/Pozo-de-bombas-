/* ============================================================
   CONFIGURACIÓN — es el único archivo que tenés que tocar.
   ============================================================ */
window.POZOS_CONFIG = {
  // URL del Web App de Google Apps Script (termina en /exec).
  // Si la dejás vacía, los datos se guardan solo en este navegador
  // (podés exportarlos/importarlos como JSON desde el pie de página).
  API_URL: 'https://script.google.com/macros/s/AKfycbzSNAZialUcpR3x7BgVXnwfXh_D-MhEk6RRPvOLBWKj6VTNWZ3Ywbm357rVV9Rwdl40/exec',

  // Clave compartida opcional. Tiene que ser igual a TOKEN en Code.gs.
  TOKEN: '',

  // Planilla de origen (se usa para el enlace del encabezado).
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1ymlgKOs-JUEOzjKK4ti0_oKbY5p7ksIDTOmgyGspupQ/edit',

  // Fecha de la copia fija de pozos.js (se usa sin conexión).
  DATOS_AL: '27/10/2026',

  // Con Apps Script conectado: leer en vivo la hoja maestra "POZOS DE AGUA".
  // Los pozos que agregues o cambies en esa hoja aparecen solos en la web.
  LEER_REGISTRO: true,

  // Pozos que quieras sumar a mano (por ejemplo, el de otra provincia)
  // sin esperar a que estén en la planilla. Ejemplo:
  // {
  //   code: 'XYZ01-F-CR-BP-S-30', agricola: 'XYZ - FINCA',
  //   gms: `24° 47' 10.0" S 65° 24' 30.0" W`,
  //   motor: 'Franklin Electric 30', bomba: 's/d', pot: '30 HP',
  //   caneria: '—', estadoPlanilla: 'Operativo', red: 'Red', obs: ''
  // }
  EXTRA_WELLS: []
};
