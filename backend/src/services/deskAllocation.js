const BLOCKING_STATUSES = ['ACTIVE', 'PENDING'];
const deskInclude = { include: { desk: true } };
class DeskError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; this.code = 'DESK_UNAVAILABLE'; }
}
async function lockSpaces(tx, ids) {
  for (const id of [...new Set(ids.map(Number))].sort((a,b) => a-b)) {
    await tx.$queryRaw`SELECT "id" FROM "Space" WHERE "id" = ${id} FOR UPDATE`;
  }
}
function chooseDesks(desks, count, requested, preferred = []) {
  if (!Number.isInteger(count) || count < 1) throw new DeskError('La cantidad de asistentes debe ser un entero mayor a cero.', 400);
  const free = desks.filter(d => d.status === 'FREE');
  if (requested !== undefined) {
    if (!Array.isArray(requested) || requested.some(id => !Number.isInteger(id)) || new Set(requested).size !== count || requested.length !== count) {
      throw new DeskError('Seleccioná una mesa distinta por cada asistente.', 400);
    }
    if (requested.some(id => !free.some(d => d.id === id))) throw new DeskError('Alguna mesa seleccionada ya no está disponible para todo el horario. Actualizá la disponibilidad.');
    return requested;
  }
  const sorted = [...free].sort((a,b) => Number(preferred.includes(b.id)) - Number(preferred.includes(a.id)) || a.number-b.number);
  if (sorted.length < count) throw new DeskError('No hay suficientes mesas libres durante todo el horario solicitado.');
  return sorted.slice(0,count).map(d => d.id);
}
async function getAvailability(tx, space, startTime, endTime, excludeId) {
  const desks = await tx.desk.findMany({
    where: { spaceId: space.id, active: true }, orderBy: { number: 'asc' },
    include: {
      reservations: { where: { reservation: {
        status: { in: BLOCKING_STATUSES }, startTime: { lt: endTime }, endTime: { gt: startTime },
        ...(excludeId ? { id: { not: excludeId } } : {})
      } }, select: { reservationId: true } },
      fixedAssignments: { where: { active: true, startTime: { lt: endTime }, OR: [{ endTime: null }, { endTime: { gt: startTime } }] }, select: { id: true } }
    }
  });
  const result = desks.map(d => ({ id: d.id, number: d.number, status: d.fixedAssignments.length ? 'FIXED' : d.reservations.length ? 'OCCUPIED' : 'FREE' }));
  const available = result.filter(d => d.status === 'FREE').length;
  return { capacity: desks.length, available, occupied: desks.length - available, desks: result };
}
async function allocationData(tx, row, { admin = false, deskIds, excludeId } = {}) {
  const space = await tx.space.findUnique({ where: { id: row.spaceId } });
  if (!space?.active) throw new DeskError('El espacio no está disponible.', 400);
  if (!space.numberedDesks) {
    if (excludeId) await tx.reservationDesk.deleteMany({ where: { reservationId: excludeId } });
    return {};
  }
  const availability = await getAvailability(tx, space, row.startTime, row.endTime, excludeId);
  const previous = excludeId ? await tx.reservationDesk.findMany({ where: { reservationId: excludeId } }) : [];
  if (admin && deskIds === undefined) throw new DeskError('Seleccioná el número de mesa para cada asistente.', 400);
  const ids = chooseDesks(availability.desks, row.attendees, admin ? deskIds : undefined, previous.map(d => d.deskId));
  if (excludeId) await tx.reservationDesk.deleteMany({ where: { reservationId: excludeId } });
  return { desks: { create: ids.map(deskId => ({ deskId })) } };
}
async function configureDesks(tx, space, previous) {
  if (!Number.isInteger(space.capacity) || space.capacity < 1) throw new DeskError('La capacidad debe ser un entero mayor a cero.', 400);
  if (!space.numberedDesks) {
    if (previous?.numberedDesks) throw new DeskError('Un espacio con mesas numeradas debe mantener esa configuración para conservar sus asignaciones.', 400);
    return;
  }
  if (!['FLEX_DESK','SHARED_TABLE'].includes(space.type)) throw new DeskError('Las mesas numeradas requieren un espacio compartido (puesto flex o mesa compartida).', 400);
  const desks = await tx.desk.findMany({ where: { spaceId: space.id }, orderBy: { number: 'asc' } });
  const active = desks.filter(d => d.active);
  if (active.length > space.capacity) throw new DeskError('Deshabilitá primero las mesas sobrantes desde Gestionar mesas.', 400);
  let nextNumber = Math.max(0, ...desks.map(d => d.number)) + 1;
  for (let i = active.length; i < space.capacity; i++) await tx.desk.create({ data: { spaceId: space.id, number: nextNumber++ } });
  if (!previous?.numberedDesks) {
    const reservations = await tx.reservation.findMany({ where: { spaceId: space.id, status: { in: BLOCKING_STATUSES }, endTime: { gt: new Date() } }, orderBy: [{ startTime: 'asc' }, { id: 'asc' }] });
    for (const row of reservations) {
      const data = await allocationData(tx, row, { excludeId: row.id });
      await tx.reservation.update({ where: { id: row.id }, data });
    }
  }
}
module.exports = { BLOCKING_STATUSES, deskInclude, DeskError, lockSpaces, chooseDesks, getAvailability, allocationData, configureDesks };
