import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  let deleted: number
  try {
    deleted = await prisma.$executeRaw`
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
  } catch (e: any) {
    // Table doesn't exist yet (fresh DB) — nothing to deduplicate
    if (e?.meta?.code === "42P01") { console.log("Table not yet created, skipping."); return }
    throw e
  }
  if (deleted > 0) console.log(`Removed ${deleted} duplicate availability records.`)
  else console.log("No duplicate availability records found.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
