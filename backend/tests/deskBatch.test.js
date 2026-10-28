const test = require('node:test');
const assert = require('node:assert/strict');
const { allocateDeskBatch, DeskError } = require('../src/services/deskAllocation');

const at = (iso) => new Date(iso);
const space = { id: 1 };

// tx falso: 3 mesas; `blocking` = ocupaciones ya existentes; `previous` = mesas actuales de las filas a reprogramar
function fakeTx({ blocking = [], previous = [], fixed = {} } = {}) {
  const queries = [];
  return {
    queries,
    desk: {
      findMany: async () => {
        queries.push('desk');
        return [1, 2, 3].map((n) => ({ id: n, number: n, fixedAssignments: fixed[n] || [] }));
      },
    },
    reservationDesk: {
      findMany: async (args) => {
        if (args.where.reservationId) {
          queries.push('previous');
          return previous;
        }
        queries.push('blocking');
        return blocking;
      },
    },
  };
}

const row = (id, start, end, attendees = 1) => ({ id, startTime: at(start), endTime: at(end), attendees });

test('allocateDeskBatch: número fijo de consultas sin importar cuántas filas', async () => {
  const tx = fakeTx();
  const day = (i, h) => new Date(Date.UTC(2030, 0, 1 + i, h)).toISOString();
  const rows = Array.from({ length: 100 }, (_, i) => row(null, day(i, 9), day(i, 10)));
  await allocateDeskBatch(tx, space, rows);
  assert.ok(tx.queries.length <= 3, `consultas: ${tx.queries.join(',')}`);
});

test('allocateDeskBatch: filas en distintos días reutilizan la misma mesa; en el mismo horario no', async () => {
  const tx = fakeTx();
  const r = await allocateDeskBatch(tx, space, [
    row(null, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z'),
    row(null, '2030-01-02T09:00:00Z', '2030-01-02T10:00:00Z'),
    row(null, '2030-01-02T09:30:00Z', '2030-01-02T10:30:00Z'), // solapa con la anterior
  ]);
  assert.deepEqual(r, [[1], [1], [2]]);
});

test('allocateDeskBatch: respeta mesas ocupadas por otras reservas y mesas fijas', async () => {
  const tx = fakeTx({
    blocking: [{ deskId: 1, reservationId: 50, reservation: { startTime: at('2030-01-01T09:00:00Z'), endTime: at('2030-01-01T10:00:00Z') } }],
    fixed: { 2: [{ startTime: at('2029-01-01T00:00:00Z'), endTime: null }] },
  });
  const r = await allocateDeskBatch(tx, space, [row(null, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z')]);
  assert.deepEqual(r, [[3]]);
});

test('allocateDeskBatch: al reprogramar ignora su propia ocupación y prefiere sus mesas actuales', async () => {
  const tx = fakeTx({
    blocking: [{ deskId: 2, reservationId: 7, reservation: { startTime: at('2030-01-01T09:00:00Z'), endTime: at('2030-01-01T10:00:00Z') } }],
    previous: [{ reservationId: 7, deskId: 2 }],
  });
  const r = await allocateDeskBatch(tx, space, [row(7, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z')]);
  assert.deepEqual(r, [[2]]);
});

test('allocateDeskBatch: sin mesas libres o admin sin elegir mesa lanza DeskError', async () => {
  const tx = fakeTx({
    blocking: [1, 2, 3].map((d) => ({ deskId: d, reservationId: 90 + d, reservation: { startTime: at('2030-01-01T00:00:00Z'), endTime: at('2030-01-02T00:00:00Z') } })),
  });
  await assert.rejects(allocateDeskBatch(tx, space, [row(null, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z')]), DeskError);
  await assert.rejects(allocateDeskBatch(fakeTx(), space, [row(null, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z')], { admin: true }), DeskError);
  // el admin elige mesa explícita
  const ok = await allocateDeskBatch(fakeTx(), space, [row(null, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z')], { admin: true, deskIds: [3] });
  assert.deepEqual(ok, [[3]]);
});
