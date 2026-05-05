import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10)

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@beholders.call"
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!"
  const adminUsername = process.env.ADMIN_USERNAME ?? adminEmail.split("@")[0]

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: adminUsername,
      passwordHash: await hash(adminPassword),
      role: "ADMIN",
    },
  })

  console.log(`Admin pronto: ${adminEmail}`)
  console.log(`Utente admin: ${admin.username}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
