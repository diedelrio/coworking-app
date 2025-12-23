// frontend/src/utils/reservationsCalendar.js

function isSharedType(spaceType) {
  const t = String(spaceType || '').toUpperCase();
  return t === 'FLEX' || t === 'SHARED_TABLE';
}

/**
 * Agrupa reservas compartidas por:
 * spaceId + date + startTime + endTime
 *
 * Recomendación: pasale solo reservas "que ocupan" (ACTIVE/PENDING),
 * así CANCELLED/REJECTED no cuentan para capacidad.
 */
export function aggregateSharedSlots(reservations = []) {
  const out = [];
  const map = new Map();

  for (const r of reservations) {
    const space = r.space || {};
    const spaceId = r.spaceId ?? space.id ?? null;
    const spaceType = r.spaceType ?? space.type ?? '';
    const shared = isSharedType(spaceType);

    if (!shared) {
      out.push({
        kind: 'SINGLE',
        id: r.id,
        reservation: r,
        space,
        spaceId,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        count: 1,
        capacity: 1,
        isFull: true,
      });
      continue;
    }

    const capacity = Number(space.capacity) > 0 ? Number(space.capacity) : 1;

    // Sin spaceId no podemos agrupar: devolvemos SINGLE para no romper UI
    if (!spaceId) {
      out.push({
        kind: 'SINGLE',
        id: r.id,
        reservation: r,
        space,
        spaceId: null,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        count: 1,
        capacity,
        isFull: false,
      });
      continue;
    }

    const key = `${spaceId}|${r.date}|${r.startTime}|${r.endTime}`;

    if (!map.has(key)) {
      map.set(key, {
        kind: 'AGG',
        key,
        space,
        spaceId,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        count: 0,
        capacity,
        reservations: [],
      });
    }

    const slot = map.get(key);
    slot.count += 1;
    slot.reservations.push(r);
  }

  for (const slot of map.values()) {
    out.push({
      ...slot,
      isFull: slot.count >= slot.capacity,
    });
  }

  return out;
}

export function occupyingReservations(reservations = []) {
  return reservations.filter((r) =>
    ['ACTIVE', 'PENDING'].includes(String(r.status || '').toUpperCase())
  );
}
