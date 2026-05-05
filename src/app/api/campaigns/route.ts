import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/campaigns — campaigns the current user is master of OR player in
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaigns = await prisma.campaign.findMany({
    where: {
      OR: [
        { masterId: session.user.id },
        { players: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      master: { select: { id: true, username: true } },
      players: { include: { user: { select: { id: true, username: true } } } },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(
    campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      defaultDayOfWeek: c.defaultDayOfWeek,
      masterId: c.masterId,
      masterName: c.master.username,
      isMaster: c.masterId === session.user.id,
      players: c.players.map((p) => ({ id: p.user.id, username: p.user.username })),
    }))
  )
}

// POST /api/campaigns — create (admin only)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const campaign = await prisma.campaign.create({
    data: {
      name: body.name,
      masterId: body.masterId,
      defaultDayOfWeek: body.defaultDayOfWeek,
      color: body.color ?? "#8b5cf6",
    },
  })

  if (body.playerIds?.length) {
    await prisma.campaignPlayer.createMany({
      data: body.playerIds.map((uid: string) => ({
        campaignId: campaign.id,
        userId: uid,
      })),
      skipDuplicates: true,
    })
  }

  return NextResponse.json(campaign, { status: 201 })
}
