// backend/src/services/pricingResolver.js
// Resuelve precio por unidad (HOUR | HALF_DAY | DAY | MONTH) en base a PriceLists/PriceItems.
// Estrategia (MVP):
// 1) Buscar PriceList activa y vigente (validFrom/validTo) ordenada por priority DESC
// 2) Dentro de esa lista, buscar item en orden:
//    a) scope=SPACE_ID y spaceId
//    b) scope=SPACE_TYPE y spaceType
//    c) scope=GLOBAL
//    (siempre filtrando por unit)
// 3) Fallback:
//    - si unit=HOUR y existe Space.hourlyRate -> usarlo
//    - si unit!=HOUR y no hay item -> fallback a unit=HOUR (para no romper) y dejar que el caller decida.

const prisma = require("../prisma");
const { Prisma } = require("@prisma/client");

function nowDate(d) {
  return d instanceof Date ? d : new Date();
}

async function getActivePriceListId(when, userId) {
  // Segmentación por tags:
  // - Si una lista NO tiene targetTags => aplica a todos.
  // - Si tiene targetTags => aplica si el usuario tiene al menos uno de esos tags.
  let userTagIds = [];
  if (userId) {
    const rows = await prisma.userTag.findMany({
      where: { userId: Number(userId) },
      select: { tagId: true },
    });
    userTagIds = rows.map(r => r.tagId);
  }

  const priceList = await prisma.priceList.findFirst({
    where: {
      active: true,
      OR: [{ validFrom: null }, { validFrom: { lte: when } }],
      AND: [{ OR: [{ validTo: null }, { validTo: { gte: when } }] }],
      ...(userId ? {
        OR: [
          { targetTags: { none: {} } },
          ...(userTagIds.length ? [{ targetTags: { some: { tagId: { in: userTagIds } } } }] : []),
        ],
      } : { targetTags: { none: {} } }),
    },
    orderBy: [{ priority: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return priceList?.id ?? null;
}

async function resolveUnitPrice({ userId, spaceId, unit = "HOUR", date }) {
  const when = nowDate(date);

  const space = await prisma.space.findUnique({
    where: { id: Number(spaceId) },
    select: { id: true, type: true, hourlyRate: true },
  });
  if (!space) throw new Error("Space not found");

  const listId = await getActivePriceListId(when, userId);

  // helper: buscar item por scope
  const findItem = async (where) => {
    const it = await prisma.priceItem.findFirst({
      where: { ...where, unit },
      select: { price: true },
    });
    return it?.price != null ? new Prisma.Decimal(it.price) : null;
  };

  if (listId) {
    const bySpace = await findItem({ priceListId: listId, scope: "SPACE_ID", spaceId: space.id });
    if (bySpace) return bySpace;

    const byType = await findItem({ priceListId: listId, scope: "SPACE_TYPE", spaceType: space.type });
    if (byType) return byType;

    const global = await findItem({ priceListId: listId, scope: "GLOBAL" });
    if (global) return global;
  }

  // Fallbacks
  if (unit === "HOUR") {
    return new Prisma.Decimal(space.hourlyRate || 0);
  }

  // si no hay unit específico, devolvemos null para que el caller maneje.
  return null;
}

// compat: wrapper anterior
async function resolveHourlyRate({ userId, spaceId, date }) {
  const v = await resolveUnitPrice({ userId, spaceId, unit: "HOUR", date });
  return v ?? new Prisma.Decimal(0);
}

module.exports = { resolveUnitPrice, resolveHourlyRate };
