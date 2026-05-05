import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/admin/campaigns — all campaigns with full details (admin only)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const campaigns = await prisma.campaign.findMany({
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
      master: { id: c.master.id, username: c.master.username },
      players: c.players.map((p) => ({ id: p.user.id, username: p.user.username })),
    }))
  )
}
