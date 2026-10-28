const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  generateOccurrenceDates,
  addMonthsMonthlyBusinessWeekday,
  buildOccurrenceDates,
} = require('../src/services/recurrence');
const {
  madridDateYMDToUtcMidnight,
  utcToMadridYMD,
  addDaysYMD,
  isoWeekdayYMD,
} = require('../src/utils/timezone');

const ymds = (dates) => dates.map((d) => utcToMadridYMD(madridDateYMDToUtcMidnight(
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
)));

test('DAILY salta fines de semana', () => {
  // 2026-10-30 es viernes
  const out = ymds(generateOccurrenceDates({ startYMD: '2026-10-30', pattern: 'DAILY', count: 4 }));
  assert.deepEqual(out, ['2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04']);
});

test('DAILY salta cierres/feriados', () => {
  const out = ymds(generateOccurrenceDates({
    startYMD: '2026-11-02', pattern: 'DAILY', count: 3, closedYMDSet: new Set(['2026-11-03']),
  }));
  assert.deepEqual(out, ['2026-11-02', '2026-11-04', '2026-11-05']);
});

test('DAILY con fecha inicial en sábado arranca el lunes', () => {
  const out = ymds(generateOccurrenceDates({ startYMD: '2026-10-31', pattern: 'DAILY', count: 1 }));
  assert.deepEqual(out, ['2026-11-02']);
});

test('una fecha fin que genera más de 100 reservas se rechaza (no se trunca en silencio)', () => {
  assert.throws(
    () => generateOccurrenceDates({ startYMD: '2026-01-05', pattern: 'DAILY', endDateYMD: '2027-12-31' }),
    /más de 100/
  );
});

test('WEEKLY y count', () => {
  const out = ymds(generateOccurrenceDates({ startYMD: '2026-10-28', pattern: 'WEEKLY', count: 3 }));
  assert.deepEqual(out, ['2026-10-28', '2026-11-04', '2026-11-11']);
});

test('MONTHLY: cae en día hábil y dentro del mes', () => {
  const start = new Date('2026-01-29T00:00:00'); // jueves
  const d = addMonthsMonthlyBusinessWeekday({
    startDate: start, monthsToAdd: 1, anchorDay: 29, anchorIsoWeekday: 4, closedYMDSet: new Set(),
  });
  assert.equal(d.getMonth(), 1);
  assert.notEqual(d.getDay(), 0);
  assert.notEqual(d.getDay(), 6);
});

test('buildOccurrenceDates valida reglas de fin', async () => {
  const db = { officeClosure: { findMany: async () => [] } };
  await assert.rejects(
    buildOccurrenceDates({ date: '2026-11-02', isRecurring: true, pattern: 'DAILY', recurrenceEndDate: '2026-11-10', recurrenceCount: 3, db }),
    { code: 'INVALID_RECURRENCE' }
  );
  await assert.rejects(
    buildOccurrenceDates({ date: '2026-11-02', isRecurring: true, pattern: 'DAILY', recurrenceCount: 101, db }),
    { code: 'INVALID_RECURRENCE' }
  );
});

test('buildOccurrenceDates DAILY excluye cierres guardados como medianoche Madrid (sin depender de la TZ del servidor)', async () => {
  // Cierre el 2026-11-03: se guarda como medianoche Madrid en UTC (23:00Z del día anterior en invierno)
  const closure = { date: madridDateYMDToUtcMidnight('2026-11-03') };
  const db = { officeClosure: { findMany: async () => [closure] } };
  const dates = await buildOccurrenceDates({
    date: '2026-11-02', isRecurring: true, pattern: 'DAILY', recurrenceCount: 3, db,
  });
  assert.deepEqual(ymds(dates), ['2026-11-02', '2026-11-04', '2026-11-05']);
});

test('helpers de calendario Madrid', () => {
  assert.equal(addDaysYMD('2026-10-30', 3), '2026-11-02');
  assert.equal(isoWeekdayYMD('2026-11-01'), 7); // domingo
  assert.equal(isoWeekdayYMD('2026-11-02'), 1); // lunes
  // Medianoche Madrid en verano = 22:00Z del día anterior; el calendario Madrid sigue siendo el mismo día
  assert.equal(utcToMadridYMD(madridDateYMDToUtcMidnight('2026-07-15')), '2026-07-15');
});

test('caché de settings: las claves de un llamador no ocultan las de otro', async () => {
  const prismaPath = path.resolve(__dirname, '../src/prisma.js');
  let calls = 0;
  require.cache[prismaPath] = {
    id: prismaPath, filename: prismaPath, loaded: true,
    exports: {
      setting: {
        findMany: async () => {
          calls += 1;
          return [
            { key: 'AUTO_COMPLETE_HOUR', value: '3', valueType: 'NUMBER' },
            { key: 'OFFICE_OPEN_HOUR', value: '7', valueType: 'NUMBER' },
          ];
        },
      },
    },
  };
  const svc = require('../src/services/settingsService');
  svc.invalidateSettingsCache();

  // El job de autocompletado calcula primero su horario...
  await svc.getActiveSettingsMap(['AUTO_COMPLETE_HOUR']);
  // ...y las reglas de reserva no deben caer a los valores por defecto (9)
  const rules = await svc.getReservationRules();
  assert.equal(rules.openHour, 7);
  assert.equal(calls, 1, 'una sola consulta para ambos llamadores');
});

test('job de autocompletado: la próxima ejecución es a la hora de Madrid, no del servidor', () => {
  const { msUntilNextRun } = require('../src/jobs/autoCompleteReservations');
  const h = 3600_000;
  // Invierno (UTC+1): 22:00Z del 10-ene = 23:00 Madrid -> las 02:00 Madrid son 3 h después
  assert.equal(msUntilNextRun({ hour: 2, minute: 0 }, new Date('2027-01-10T22:00:00Z')), 3 * h);
  // Verano (UTC+2): 22:00Z del 10-jul = 00:00 Madrid -> las 02:00 Madrid son 2 h después
  assert.equal(msUntilNextRun({ hour: 2, minute: 0 }, new Date('2027-07-10T22:00:00Z')), 2 * h);
  // Ya pasó la hora de hoy -> mañana
  assert.equal(msUntilNextRun({ hour: 2, minute: 0 }, new Date('2027-01-10T01:30:00Z')), 23.5 * h);
});
