import { getPrisma } from "../prisma.js";

export async function listCategories() {
  const categories = await getPrisma().category.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  return categories;
}

export async function listRelatedSystems() {
  const systems = await getPrisma().relatedSystem.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  return systems;
}
