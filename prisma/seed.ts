// Run with: DATABASE_URL=<your-url> npx tsx prisma/seed.ts
// (prisma db seed invokes this via prisma.config.ts migrations.seed command)
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const db = new PrismaClient({ adapter });

const SHELF: Record<string, number> = {
  "熟食": 3, "葉菜": 5, "根莖蔬菜": 14, "水果": 7,
  "肉類": 2, "海鮮": 1, "乳製品": 7, "蛋": 21,
  "醬料": 30, "飲料": 7, "剩菜": 2, "其他": 5,
};

async function main() {
  for (const [category, defaultDays] of Object.entries(SHELF)) {
    await db.shelfLife.upsert({ where: { category }, update: { defaultDays }, create: { category, defaultDays } });
  }
}
main().finally(() => db.$disconnect());
