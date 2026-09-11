const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');
const { madridDateTimeToUtc, getPartsInTZ } = require('../utils/timezone');
const { BLOCKING_STATUSES, DeskError, lockSpaces, getAvailability } = require('../services/deskAllocation');
const router = express.Router();
const handle = fn => async (req,res) => { try { await fn(req,res); } catch(e) {
  if (e instanceof DeskError) return res.status(e.status).json({ message: e.message, code: e.code });
  if (e.code === 'P2002') return res.status(409).json({ message: 'Ese número de mesa ya existe en el espacio.' });
  console.error('Desk operation failed', e); res.status(500).json({ message: 'No se pudo completar la operación de mesas.' });
} };
function positiveId(raw) { const id = Number(raw); if (!Number.isInteger(id) || id < 1) throw new DeskError('Identificador inválido.',400); return id; }
function instant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new DeskError('Fecha u horario inválido.',400);
  const value = madridDateTimeToUtc(date,time);
  const p = getPartsInTZ(value);
  const actual = [p.year,p.month,p.day].map((n,i) => String(n).padStart(i ? 2 : 4,'0')).join('-');
  if (actual !== date || p.hour !== Number(time.slice(0,2)) || p.minute !== Number(time.slice(3))) throw new DeskError('Fecha u horario inválido.',400);
  return value;
}
async function getSpace(tx,id) { const space = await tx.space.findUnique({where:{id}}); if (!space) throw new DeskError('Espacio no encontrado.',404); return space; }
router.get('/:id/desks/availability', authRequired, handle(async (req,res) => {
  const space = await getSpace(prisma,positiveId(req.params.id));
  if (!space.active || !space.numberedDesks) throw new DeskError('Este espacio no admite reservas de mesas.',400);
  const start = instant(req.query.date,req.query.startTime), end = instant(req.query.date,req.query.endTime);
  if (end <= start) throw new DeskError('La hora de fin debe ser posterior al inicio.',400);
  let excludeId;
  if (req.query.excludeReservationId) {
    excludeId = positiveId(req.query.excludeReservationId);
    const own = await prisma.reservation.findUnique({where:{id:excludeId}});
    if (!own || (req.user.role !== 'ADMIN' && own.userId !== req.user.userId)) throw new DeskError('No podés consultar esa reserva.',403);
  }
  res.json(await getAvailability(prisma,space,start,end,excludeId));
}));
router.get('/:id/desks', authRequired, requireAdmin, handle(async (req,res) => {
  const id = positiveId(req.params.id); await getSpace(prisma,id);
  res.json(await prisma.desk.findMany({ where: {spaceId:id}, orderBy:{number:'asc'}, include:{ fixedAssignments:{where:{active:true},orderBy:{startTime:'asc'}} } }));
}));
router.put('/:id/desks/:deskId', authRequired, requireAdmin, handle(async (req,res) => {
  const spaceId = positiveId(req.params.id), id = positiveId(req.params.deskId);
  const result = await prisma.$transaction(async tx => {
    await lockSpaces(tx,[spaceId]); const space = await getSpace(tx,spaceId);
    const desk = await tx.desk.findFirst({where:{id,spaceId}}); if (!desk || !space.numberedDesks) throw new DeskError('Mesa no encontrada.',404);
    const number = req.body.number === undefined ? desk.number : positiveId(req.body.number);
    const active = req.body.active === undefined ? desk.active : req.body.active;
    if (typeof active !== 'boolean') throw new DeskError('Estado inválido.',400);
    if (!active && desk.active) {
      const reserved = await tx.reservationDesk.count({where:{deskId:id,reservation:{status:{in:BLOCKING_STATUSES},endTime:{gt:new Date()}}}});
      const fixed = await tx.fixedDeskAssignment.count({where:{deskId:id,active:true,OR:[{endTime:null},{endTime:{gt:new Date()}}]}});
      if (reserved || fixed) throw new DeskError('La mesa tiene reservas o asignaciones fijas vigentes o futuras.');
      if (space.capacity <= 1) throw new DeskError('El espacio debe conservar al menos una mesa habilitada.',400);
    }
    const updated = await tx.desk.update({where:{id},data:{number,active}});
    if (active !== desk.active) await tx.space.update({where:{id:spaceId},data:{capacity:{increment:active ? 1 : -1}}});
    return updated;
  });
  res.json(result);
}));
router.post('/:id/desks/:deskId/fixed', authRequired, requireAdmin, handle(async (req,res) => {
  const spaceId = positiveId(req.params.id), deskId = positiveId(req.params.deskId);
  const occupantName = String(req.body.occupantName || '').trim();
  if (!occupantName || occupantName.length > 200) throw new DeskError('Indicá el nombre del ocupante (hasta 200 caracteres).',400);
  const startTime = instant(req.body.startDate,'00:00');
  let endTime = null;
  if (req.body.endDate) {
    instant(req.body.endDate,'00:00');
    const next = new Date(req.body.endDate + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate()+1);
    endTime = instant(next.toISOString().slice(0,10),'00:00');
    if (endTime <= startTime) throw new DeskError('La fecha final debe ser igual o posterior a la inicial.',400);
  }
  const result = await prisma.$transaction(async tx => {
    await lockSpaces(tx,[spaceId]); const space = await getSpace(tx,spaceId);
    const desk = await tx.desk.findFirst({where:{id:deskId,spaceId,active:true}});
    if (!desk || !space.numberedDesks) throw new DeskError('Mesa no disponible.',400);
    const until = endTime || new Date('9999-12-31T00:00:00Z');
    const availability = await getAvailability(tx,space,startTime,until);
    if (availability.desks.find(d => d.id === deskId)?.status !== 'FREE') throw new DeskError('La mesa tiene una reserva o asignación fija dentro de ese período.');
    return tx.fixedDeskAssignment.create({data:{deskId,occupantName,startTime,endTime}});
  });
  res.status(201).json(result);
}));
router.delete('/:id/desks/:deskId/fixed/:assignmentId', authRequired, requireAdmin, handle(async (req,res) => {
  const spaceId = positiveId(req.params.id), deskId = positiveId(req.params.deskId), id = positiveId(req.params.assignmentId);
  await prisma.$transaction(async tx => {
    await lockSpaces(tx,[spaceId]);
    const assignment = await tx.fixedDeskAssignment.findFirst({where:{id,deskId,desk:{spaceId}}});
    if (!assignment) throw new DeskError('Asignación no encontrada.',404);
    await tx.fixedDeskAssignment.update({where:{id},data:{active:false}});
  });
  res.json({ok:true});
}));
module.exports = router;
