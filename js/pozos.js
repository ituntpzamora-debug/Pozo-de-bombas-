/* Copia fija de Ingeniería GMP › POZOS DE AGUA — leída el 27/10/2026.
   Se usa cuando la app no está conectada a Google Sheets (o como respaldo si la hoja no responde).
   Con Apps Script conectado, manda la hoja: estos datos solo completan celdas vacías.
   "s/d" = sin dato en la planilla. */
window.POZOS_BASE = [
  { code: 'M01-RF-CR-BP-S-40', agricola: 'MARGESI - RIO FAMAILLA', gms: `26° 59' 36.582" S 65° 26' 43.755" W`,
    motor: 'Franklin Electric 40', bomba: 's/d', pot: '40 HP', caneria: '—', estadoPlanilla: 'Operativo', red: '—', obs: '' },
  { code: 'M04-LM-CR1-BP-S-4', agricola: 'MARGESI - LAS MESADAS', gms: `27° 6' 8.9039" S 65° 34' 23.4419" W`,
    motor: 'RotorPump 4 HP (3 kW)', bomba: 's/d', pot: '4 HP', caneria: '9 caños de 2"', estadoPlanilla: 'Operativo', red: 'Red', obs: 'Bomba con problemas, analizar fallas.' },
  { code: 'TDA02-F-CRV-BP-S-40', agricola: 'TDA - FINCA', gms: `27° 11' 42.666" S 65° 32' 38.292" W`,
    motor: 's/d', bomba: 's/d', pot: '40 HP', caneria: '—', estadoPlanilla: 'Fuera de servicio', red: '—', obs: 'Pozo inutilizado.' },
  { code: 'TDA03-F-CRP-BP-S-20', agricola: 'TDA - FINCA', gms: `27° 11' 51.0745" S 65° 32' 55.1782" W`,
    motor: 'Franklin Electric 20', bomba: 's/d', pot: '20 HP', caneria: '—', estadoPlanilla: 'Operativo', red: '—', obs: '' },
  { code: 'TDA05-E-CR-BP-S-100', agricola: 'TDA - EMPAQUE', gms: `27° 11' 38.8464" S 65° 32' 41.1324" W`,
    motor: 'Franklin Electric 100 HP', bomba: 'Rotorpump RP10S64/3C-R210B', pot: '100 HP', caneria: '6"', estadoPlanilla: 'Operativo', red: '—', obs: '' },
  { code: 'TDA06-R-BP-S-50', agricola: 'TDA - REPRESA', gms: `27° 11' 31.1323" S 65° 32' 57.7777" W`,
    motor: 's/d', bomba: 's/d', pot: '50 HP', caneria: '—', estadoPlanilla: 'Operativo', red: '—', obs: '' },
  { code: 'TDA15-FA-CR-BP-S-50', agricola: 'TDA - FINCA AZUL', gms: `27° 4' 11.2192" S 65° 32' 40.33" W`,
    motor: 'Franklin Electric 50', bomba: 's/d', pot: '50 HP', caneria: '13 caños de 4"', estadoPlanilla: 'Operativo', red: '—',
    obs: 'Motor quemado y bomba con juego en el eje. Baja eficiencia del pozo y pérdida de caudal; se recomienda a futuro una videofilmación.' },
  { code: 'TDB17-R-BP-S-40', agricola: 'TDB - REPRESA', gms: `27° 12' 38.1852" S 65° 32' 58.6392" W`,
    motor: 'Franklin Electric 40 (8")', bomba: 's/d', pot: '40 HP', caneria: '4"', estadoPlanilla: 'Operativo', red: '—', obs: 'La bomba presenta una falla y se apaga: mala puesta a tierra.' },
  { code: 'TDB02-F-CR1-BP-S', agricola: 'TDB - FINCAS', gms: `27° 12' 46.8734" S 65° 33' 2.1164" W`,
    motor: 's/d', bomba: 's/d', pot: '—', caneria: '—', estadoPlanilla: 'Operativo', red: '—', obs: '' },
  { code: 'TDB03-F-TDI-BP-S-50', agricola: 'TDB - FINCAS', gms: `27° 12' 20.5294" S 65° 32' 37.581" W`,
    motor: 's/d', bomba: 's/d', pot: '50 HP', caneria: '—', estadoPlanilla: 'Fuera de servicio', red: '—', obs: '' },
  { code: 'TDB05-F-CRG-BP-S-50', agricola: 'TDB - FINCAS', gms: `27° 12' 48.33" S 65° 33' 7.776" W`,
    motor: 'Motorarg 50 HP', bomba: 'RotorPump P03…-R26P0 (modelo incompleto)', pot: '50 HP', caneria: '7', estadoPlanilla: 'Operativo', red: '—', obs: '' },
  { code: 'SA17-R-BP-S-10', agricola: 'SANTA ANA', gms: `27° 28' 59.124" S 65° 42' 35.0496" W`,
    motor: 's/d', bomba: 's/d', pot: '10 HP', caneria: '7 caños de 4"', estadoPlanilla: 'Fuera de servicio', red: '—', obs: '' }
];
