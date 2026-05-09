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

  // All campaigns the current user belongs to (as player or master) + all campaigns for highlights
  const [playerMemberships, masteredCampaigns, allCampaigns] = await Promise.all([
    prisma.campaignPlayer.findMany({
      where: { userId: session.user.id },
      select: { campaignId: true },
    }),
    prisma.campaign.findMany({
      where: { masterId: session.user.id },
      select: { id: true },
    }),
    prisma.campaign.findMany({
      select: { id: true, name: true, color: true, defaultDayOfWeek: true, players: { select: { userId: true } } },
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
    return NextResponse.json({ days, playersVotes: [], campaignHighlights: [] })
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

  // Global votes for all group members this week (used for table display)
  const allVotes = await prisma.availability.findMany({
    where: { userId: { in: players.map((p) => p.id) }, weekStart },
  })

  // All votes for the week across all users (used for highlight computation — includes masters who aren't CampaignPlayers)
  const allVotesThisWeek = await prisma.availability.findMany({
    where: { weekStart },
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

  // Best non-overlapping day per campaign based on player vote scores
  const VOTE_SCORE: Record<string, number> = { PREFERRED: 2, AVAILABLE: 1, UNAVAILABLE: 0 }
  const campaignDayScores = allCampaigns.map((c) => {
    const memberIds = new Set(c.players.map((p) => p.userId))
    const dayScores = Array.from({ length: 7 }, (_, day) =>
      allVotesThisWeek
        .filter((v) => memberIds.has(v.userId) && v.dayOfWeek === day)
        .reduce((sum, v) => sum + (VOTE_SCORE[v.vote] ?? 0), 0)
    )
    return { id: c.id, name: c.name, color: c.color, defaultDayOfWeek: c.defaultDayOfWeek, dayScores }
  })

  // Campaign with the clearest preference (biggest gap between 1st and 2nd best) goes first
  campaignDayScores.sort((a, b) => {
    const aS = [...a.dayScores].sort((x, y) => y - x)
    const bS = [...b.dayScores].sort((x, y) => y - x)
    return ((bS[0] ?? 0) - (bS[1] ?? 0)) - ((aS[0] ?? 0) - (aS[1] ?? 0))
  })

  const assignedDays = new Set<number>()
  const campaignHighlights = campaignDayScores.map((c) => {
    const ranked = c.dayScores
      .map((score, day) => ({ day, score }))
      .sort((a, b) =>
        b.score - a.score ||
        // tiebreaker: prefer defaultDayOfWeek when scores are equal (e.g. no votes yet)
        (b.day === c.defaultDayOfWeek ? 1 : 0) - (a.day === c.defaultDayOfWeek ? 1 : 0) ||
        a.day - b.day
      )
    const best = ranked.find(({ day }) => !assignedDays.has(day))
    if (best) assignedDays.add(best.day)
    return { campaignId: c.id, campaignName: c.name, campaignColor: c.color, bestDay: best?.day ?? null }
  })

  return NextResponse.json({ days, playersVotes, campaignHighlights })
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
