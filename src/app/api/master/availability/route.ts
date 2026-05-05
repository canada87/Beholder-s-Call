import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { addDays, parseISO, getDay } from "date-fns"

function toWeekday(date: Date): number {
  const d = getDay(date)
  return d === 0 ? 6 : d - 1
}

// GET /api/master/availability?campaignId=xxx&weekStart=yyyy-MM-dd
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId")
  const weekStartStr = searchParams.get("weekStart")
  if (!campaignId || !weekStartStr)
    return NextResponse.json({ error: "missing params" }, { status: 400 })

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { master: { select: { id: true, username: true } } },
  })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const canView =
    session.user.role === "ADMIN" || campaign.masterId === session.user.id
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const weekStart = parseISO(weekStartStr)

  // Session override for this campaign this week
  const sessionOverride = await prisma.session.findUnique({
    where: { campaignId_weekStart: { campaignId, weekStart } },
  })
  const defaultDate = addDays(weekStart, campaign.defaultDayOfWeek)
  const sessionDate = sessionOverride?.date ?? defaultDate

  // All players of this campaign
  const players = await prisma.campaignPlayer.findMany({
    where: { campaignId },
    include: { user: { select: { id: true, username: true } } },
  })

  // All votes for this campaign this week
  const allVotes = await prisma.availability.findMany({
    where: { campaignId, weekStart },
  })

  const playersData = players.map((p) => {
    const votes: Record<number, string | null> = {}
    for (let d = 0; d < 7; d++) votes[d] = null
    allVotes
      .filter((v) => v.userId === p.user.id)
      .forEach((v) => { votes[v.dayOfWeek] = v.vote })
    return { id: p.user.id, username: p.user.username, votes }
  })

  // All sessions for ALL campaigns this week (to show conflicts)
  const allCampaigns = await prisma.campaign.findMany({
    select: { id: true, name: true, color: true, defaultDayOfWeek: true },
  })
  const allOverrides = await prisma.session.findMany({
    where: { weekStart, isCancelled: false },
  })

  const allSessions = allCampaigns
    .filter((c) => c.id !== campaignId)
    .map((c) => {
      const ov = allOverrides.find((o) => o.campaignId === c.id)
      const cancelled = ov?.isCancelled ?? false
      if (cancelled) return null
      const date = ov?.date ?? addDays(weekStart, c.defaultDayOfWeek)
      return {
        campaignId: c.id,
        campaignName: c.name,
        campaignColor: c.color,
        dayOfWeek: toWeekday(date),
      }
    })
    .filter(Boolean)

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      color: campaign.color,
      defaultDayOfWeek: campaign.defaultDayOfWeek,
      masterName: campaign.master.username,
    },
    currentSession: {
      date: sessionDate.toISOString().split("T")[0],
      dayOfWeek: toWeekday(sessionDate),
      isCancelled: sessionOverride?.isCancelled ?? false,
      isOverridden: !!sessionOverride,
    },
    players: playersData,
    allSessions,
  })
}
