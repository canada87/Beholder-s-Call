import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { addDays, parseISO } from "date-fns"

// GET /api/availability?weekStart=yyyy-MM-dd
// Returns own votes + all group members' votes for that week (group = union of all user's campaigns)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const weekStartStr = searchParams.get("weekStart")
  if (!weekStartStr)
    return NextResponse.json({ error: "weekStart required" }, { status: 400 })

  const weekStart = parseISO(weekStartStr)

  // All campaigns the current user belongs to (as player or master)
  const [playerMemberships, masteredCampaigns] = await Promise.all([
    prisma.campaignPlayer.findMany({
      where: { userId: session.user.id },
      select: { campaignId: true },
    }),
    prisma.campaign.findMany({
      where: { masterId: session.user.id },
      select: { id: true },
    }),
  ])
  const myCampaignIds = [
    ...playerMemberships.map((m) => m.campaignId),
    ...masteredCampaigns.map((c) => c.id),
  ]

  if (myCampaignIds.length === 0) {
    const days = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      date: addDays(weekStart, i).toISOString().split("T")[0],
      vote: null,
    }))
    return NextResponse.json({ days, playersVotes: [] })
  }

  // All players in those campaigns (the "group"), deduplicated
  const groupMemberships = await prisma.campaignPlayer.findMany({
    where: { campaignId: { in: [...new Set(myCampaignIds)] } },
    include: { user: { select: { id: true, username: true } } },
  })
  const playersMap = new Map<string, { id: string; username: true }>()
  for (const m of groupMemberships) {
    if (!playersMap.has(m.user.id)) playersMap.set(m.user.id, m.user as any)
  }
  const players = Array.from(playersMap.values())

  // Global votes for all group members this week
  const allVotes = await prisma.availability.findMany({
    where: { userId: { in: players.map((p) => p.id) }, weekStart },
  })

  const myVotes: Record<number, string | null> = {}
  for (let d = 0; d < 7; d++) myVotes[d] = null
  allVotes
    .filter((v) => v.userId === session.user.id)
    .forEach((v) => { myVotes[v.dayOfWeek] = v.vote })

  const playersVotes = players.map((p) => {
    const votes: Record<number, string | null> = {}
    for (let d = 0; d < 7; d++) votes[d] = null
    allVotes
      .filter((v) => v.userId === p.id)
      .forEach((v) => { votes[v.dayOfWeek] = v.vote })
    return { id: p.id, username: p.username, votes }
  })

  const days = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    date: addDays(weekStart, i).toISOString().split("T")[0],
    vote: myVotes[i],
  }))

  return NextResponse.json({ days, playersVotes })
}

// POST /api/availability — upsert a single vote (global, no campaign)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { weekStart: weekStartStr, dayOfWeek, vote } = await req.json()
  const weekStart = parseISO(weekStartStr)

  if (vote === null) {
    await prisma.availability.deleteMany({
      where: { userId: session.user.id, weekStart, dayOfWeek },
    })
    return NextResponse.json({ ok: true })
  }

  const result = await prisma.availability.upsert({
    where: { userId_weekStart_dayOfWeek: { userId: session.user.id, weekStart, dayOfWeek } },
    update: { vote },
    create: { userId: session.user.id, weekStart, dayOfWeek, vote },
  })

  return NextResponse.json(result)
}
