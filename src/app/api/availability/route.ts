import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { addDays, parseISO } from "date-fns"

// GET /api/availability?campaignId=xxx&weekStart=yyyy-MM-dd
// Returns own votes + all players' votes for the campaign that week
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId")
  const weekStartStr = searchParams.get("weekStart")
  if (!campaignId || !weekStartStr)
    return NextResponse.json({ error: "campaignId and weekStart required" }, { status: 400 })

  const weekStart = parseISO(weekStartStr)

  const allVotes = await prisma.availability.findMany({
    where: { campaignId, weekStart },
    include: { user: { select: { id: true, username: true } } },
  })

  const myVotes: Record<number, string | null> = {}
  for (let d = 0; d < 7; d++) myVotes[d] = null
  allVotes
    .filter((v) => v.userId === session.user.id)
    .forEach((v) => { myVotes[v.dayOfWeek] = v.vote })

  const players = await prisma.campaignPlayer.findMany({
    where: { campaignId },
    include: { user: { select: { id: true, username: true } } },
  })

  const playersVotes = players.map((p) => {
    const votes: Record<number, string | null> = {}
    for (let d = 0; d < 7; d++) votes[d] = null
    allVotes
      .filter((v) => v.userId === p.user.id)
      .forEach((v) => { votes[v.dayOfWeek] = v.vote })
    return {
      id: p.user.id,
      username: p.user.username,
      votes,
    }
  })

  const days = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    date: addDays(weekStart, i).toISOString().split("T")[0],
    vote: myVotes[i],
  }))

  return NextResponse.json({ days, playersVotes })
}

// POST /api/availability — upsert a single vote
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { campaignId, weekStart: weekStartStr, dayOfWeek, vote } = await req.json()
  const weekStart = parseISO(weekStartStr)

  if (vote === null) {
    await prisma.availability.deleteMany({
      where: {
        userId: session.user.id,
        campaignId,
        weekStart,
        dayOfWeek,
      },
    })
    return NextResponse.json({ ok: true })
  }

  const result = await prisma.availability.upsert({
    where: {
      userId_campaignId_weekStart_dayOfWeek: {
        userId: session.user.id,
        campaignId,
        weekStart,
        dayOfWeek,
      },
    },
    update: { vote },
    create: { userId: session.user.id, campaignId, weekStart, dayOfWeek, vote },
  })

  return NextResponse.json(result)
}
