await prisma.setting.upsert({
  where: { key: 'OFFICE_OPEN_HOUR' },
  update: {},
  create: {
    key: 'OFFICE_OPEN_HOUR',
    value: '9',
    valueType: 'INT',
    status: 'ACTIVE',
    description: 'Hora de apertura de la oficina (0-23)',
  },
});

await prisma.setting.upsert({
  where: { key: 'OFFICE_CLOSE_HOUR' },
  update: {},
  create: {
    key: 'OFFICE_CLOSE_HOUR',
    value: '18',
    valueType: 'INT',
    status: 'ACTIVE',
    description: 'Hora de cierre de la oficina (0-23)',
  },
});

await prisma.setting.upsert({
  where: { key: 'RESERVATION_MIN_MINUTES' },
  update: {},
  create: {
    key: 'RESERVATION_MIN_MINUTES',
    value: '60',
    valueType: 'INT',
    status: 'ACTIVE',
    description: 'Duración mínima de una reserva (minutos)',
  },
});

await prisma.setting.upsert({
  where: { key: 'RESERVATION_STEP_MINUTES' },
  update: {},
  create: {
    key: 'RESERVATION_STEP_MINUTES',
    value: '30',
    valueType: 'INT',
    status: 'ACTIVE',
    description: 'Granularidad de selección de horario (minutos)',
  },
});
