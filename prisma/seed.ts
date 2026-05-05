import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10)

  const admin = await prisma.user.upsert({
    where: { email: "admin@beholders.call" },
    update: {},
    create: {
      email: "admin@beholders.call",
      username: "admin",
      passwordHash: await hash("Admin123!"),
      role: "ADMIN",
    },
  })

  const master1 = await prisma.user.upsert({
    where: { email: "master1@beholders.call" },
    update: {},
    create: {
      email: "master1@beholders.call",
      username: "Gandalf",
      passwordHash: await hash("Master123!"),
      role: "PLAYER",
    },
  })

  const master2 = await prisma.user.upsert({
    where: { email: "master2@beholders.call" },
    update: {},
    create: {
      email: "master2@beholders.call",
      username: "Elminster",
      passwordHash: await hash("Master123!"),
      role: "PLAYER",
    },
  })

  const players = await Promise.all(
    ["Aragorn", "Legolas", "Gimli", "Frodo"].map(async (username, i) =>
      prisma.user.upsert({
        where: { email: `player${i + 1}@beholders.call` },
        update: {},
        create: {
          email: `player${i + 1}@beholders.call`,
          username,
          passwordHash: await hash("Player123!"),
          role: "PLAYER",
        },
      })
    )
  )

  const campaign1 = await prisma.campaign.upsert({
    where: { id: "campaign1" },
    update: {},
    create: {
      id: "campaign1",
      name: "Il Richiamo del Beholder",
      masterId: master1.id,
      defaultDayOfWeek: 2, // Wednesday
      color: "#8b5cf6",
    },
  })

  const campaign2 = await prisma.campaign.upsert({
    where: { id: "campaign2" },
    update: {},
    create: {
      id: "campaign2",
      name: "La Maledizione di Strahd",
      masterId: master2.id,
      defaultDayOfWeek: 4, // Friday
      color: "#3b82f6",
    },
  })

  const allPlayers = [admin, master1, master2, ...players]

  for (const player of allPlayers) {
    await prisma.campaignPlayer.upsert({
      where: { campaignId_userId: { campaignId: campaign1.id, userId: player.id } },
      update: {},
      create: { campaignId: campaign1.id, userId: player.id },
    })
  }

  for (const player of allPlayers) {
    await prisma.campaignPlayer.upsert({
      where: { campaignId_userId: { campaignId: campaign2.id, userId: player.id } },
      update: {},
      create: { campaignId: campaign2.id, userId: player.id },
    })
  }

  console.log("Seed completato.")
  console.log("Admin:    admin@beholders.call / Admin123!")
  console.log("Master 1: master1@beholders.call / Master123!")
  console.log("Master 2: master2@beholders.call / Master123!")
  console.log("Players:  player1-4@beholders.call / Player123!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
