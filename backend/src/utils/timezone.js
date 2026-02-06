// backend/src/utils/timezone.js
// Convierte un "YYYY-MM-DD" + "HH:MM" interpretado en Europe/Madrid a un Date UTC (instant real).
// Sin dependencias externas (maneja DST usando Intl).

const TZ = 'Europe/Madrid';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getPartsInTZ(date, timeZone = TZ) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

// Construye Date UTC tal que, al formatearlo en Europe/Madrid, sea exactamente y-m-d hh:mm
function madridDateTimeToUtc(dateYMD, hhmm) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateYMD || '').trim());
  const t = /^(\d{2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m || !t) return new Date(NaN);

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(t[1]);
  const minute = Number(t[2]);

  // Primer guess: interpretarlo como si fuese UTC
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Ajustar por diferencia entre "lo que da en Madrid" vs "lo que queremos en Madrid"
  // 3 iteraciones suelen ser suficientes incluso en cambios DST.
  for (let i = 0; i < 3; i++) {
    const p = getPartsInTZ(guess, TZ);

    const desiredAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const actualAsUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);

    const diffMs = actualAsUTC - desiredAsUTC;
    if (diffMs === 0) break;
    guess = new Date(guess.getTime() - diffMs);
  }

  return guess;
}

// Date UTC que representa "medianoche Madrid" del YYYY-MM-DD
function madridDateYMDToUtcMidnight(dateYMD) {
  return madridDateTimeToUtc(dateYMD, '00:00');
}

module.exports = {
  TZ,
  madridDateTimeToUtc,
  madridDateYMDToUtcMidnight,
  getPartsInTZ,
};
