const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Reglas de negocio
const MIN_HOURS_BEFORE = 1; // antelación mínima en horas
const MAX_HOURS_PER_DAY = 4;
const MAX_HOURS_PER_WEEK = 10;

const MS_PER_HOUR = 1000 * 60 * 60;

function getReservationDurationHours(startTime, endTime) {
  return (endTime - startTime) / MS_PER_HOUR;
}

function getDayRange(dateOnly) {
  const start = new Date(dateOnly);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateOnly);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekRangeFromDate(dateOnly) {
  const base = new Date(dateOnly);
  base.setHours(0, 0, 0, 0);

  const day = base.getDay() || 7; // domingo=0 -> 7
  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - day + 1);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return { weekStart, weekEnd };
}

/**
 * POST /api/reservations
 * Body:
 * {
 *   "spaceId": 1,
 *   "date": "2025-11-25",
 *   "startTime": "09:00",
 *   "endTime": "11:00"
 * }
 */
router.post('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { spaceId, date, startTime, endTime } = req.body;

    if (!spaceId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Faltan datos de la reserva' });
    }

    // Construimos objetos Date
    const dateOnly = new Date(`${date}T00:00:00`);
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    if (isNaN(dateOnly) || isNaN(startDateTime) || isNaN(endDateTime)) {
      return res.status(400).json({ message: 'Fecha u horas inválidas' });
    }

    if (endDateTime <= startDateTime) {
      return res
        .status(400)
        .json({ message: 'La hora de fin debe ser posterior a la de inicio' });
    }

    const now = new Date();
    const diffHours = (startDateTime - now) / MS_PER_HOUR;

    if (diffHours < MIN_HOURS_BEFORE) {
      return res.status(400).json({
        message: `Debes reservar con al menos ${MIN_HOURS_BEFORE} horas de antelación`,
      });
    }

    const newReservationHours = getReservationDurationHours(
      startDateTime,
      endDateTime
    );

    // 1) Límite de horas por día
    const { start: startOfDay, end: endOfDay } = getDayRange(dateOnly);

    const dayReservations = await prisma.reservation.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    const usedDayHours = dayReservations.reduce(
      (sum, r) => sum + getReservationDurationHours(r.startTime, r.endTime),
      0
    );

    if (usedDayHours + newReservationHours > MAX_HOURS_PER_DAY) {
      return res.status(400).json({
        message: `Superas el máximo de ${MAX_HOURS_PER_DAY} horas por día`,
      });
    }

    // 2) Límite de horas por semana
    const { weekStart, weekEnd } = getWeekRangeFromDate(dateOnly);

    const weekReservations = await prisma.reservation.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        date: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    });

    const usedWeekHours = weekReservations.reduce(
      (sum, r) => sum + getReservationDurationHours(r.startTime, r.endTime),
      0
    );

    if (usedWeekHours + newReservationHours > MAX_HOURS_PER_WEEK) {
      return res.status(400).json({
        message: `Superas el máximo de ${MAX_HOURS_PER_WEEK} horas por semana`,
      });
    }

    // 3) Comprobar espacio
    const space = await prisma.space.findUnique({
      where: { id: Number(spaceId) },
    });
    if (!space || !space.active) {
      return res.status(400).json({ message: 'El espacio no existe o está inactivo' });
    }

    // 4) Comprobar solapamiento de reservas en ese espacio
    const overlapping = await prisma.reservation.findFirst({
      where: {
        spaceId: Number(spaceId),
        status: 'ACTIVE',
        date: dateOnly,
        startTime: { lt: endDateTime },
        endTime: { gt: startDateTime },
      },
    });

    if (overlapping) {
      return res.status(400).json({
        message: 'Ya existe una reserva en ese espacio para esa franja horaria',
      });
    }

    // 5) Crear la reserva
    const reservation = await prisma.reservation.create({
      data: {
        userId,
        spaceId: Number(spaceId),
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,
        status: 'ACTIVE',
      },
      include: {
        space: true,
      },
    });

    console.log('RESERVA CREADA:', reservation.id);

    res.status(201).json(reservation);
  } catch (err) {
    console.error('ERROR POST /reservations', err);
    res.status(500).json({ message: 'Error al crear la reserva' });
  }
});

/**
 * GET /api/reservations/my
 */
router.get('/my', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;

    const reservations = await prisma.reservation.findMany({
      where: {
        userId,
      },
      include: {
        space: true,
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });

    res.json(reservations);
  } catch (err) {
    console.error('ERROR GET /reservations/my', err);
    res.status(500).json({ message: 'Error al obtener tus reservas' });
  }
});

/**
 * GET /api/reservations
 * Todas las reservas (admin)
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        user: true,
        space: true,
      },
      orderBy: [
        { date: 'desc' },
        { startTime: 'desc' },
      ],
    });

    res.json(reservations);
  } catch (err) {
    console.error('ERROR GET /reservations', err);
    res.status(500).json({ message: 'Error al obtener todas las reservas' });
  }
});

/**
 * DELETE /api/reservations/:id
 * Cancelar una reserva
 */
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.userId;
    const role = req.user.role;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    if (role !== 'ADMIN' && reservation.userId !== userId) {
      return res.status(403).json({ message: 'No puedes cancelar esta reserva' });
    }

    const now = new Date();
    if (reservation.startTime <= now) {
      return res
        .status(400)
        .json({ message: 'No se puede cancelar una reserva pasada' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    res.json({ message: 'Reserva cancelada', reservation: updated });
  } catch (err) {
    console.error('ERROR DELETE /reservations/:id', err);
    res.status(500).json({ message: 'Error al cancelar la reserva' });
  }
});

/**
 * GET /api/reservations/space/:spaceId?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Calendario de un espacio en un rango de fechas (día / semana)
 */
router.get('/space/:spaceId', authRequired, requireAdmin, async (req, res) => {
  try {
    const spaceId = Number(req.params.spaceId);
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ message: 'Debes indicar from y to en formato YYYY-MM-DD' });
    }

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59`);

    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ message: 'Fechas inválidas' });
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        spaceId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        user: true,
        space: true,
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });

    res.json(reservations);
  } catch (err) {
    console.error('ERROR GET /reservations/space/:spaceId', err);
    res.status(500).json({ message: 'Error al obtener el calendario del espacio' });
  }
});

module.exports = router;
