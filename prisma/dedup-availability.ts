import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const deleted = await prisma.$executeRaw`
    DELETE FROM "Availability"
    WHERE id NOT IN (
      SELECT DISTINCT ON ("userId", "weekStart", "dayOfWeek") id
      FROM "Availability"
      ORDER BY "userId", "weekStart", "dayOfWeek",
        CASE vote
          WHEN 'PREFERRED' THEN 1
          WHEN 'AVAILABLE' THEN 2
          WHEN 'UNAVAILABLE' THEN 3
        END ASC,
        id ASC
    )
  `
  if (deleted > 0) console.log(`Removed ${deleted} duplicate availability records.`)
  else console.log("No duplicate availability records found.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
