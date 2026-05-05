import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { addDays, parseISO, getDay } from "date-fns"

function isoToWeekday(date: Date): number {
  // date-fns getDay: 0=Sun, 1=Mon … convert to 0=Mon
  const d = getDay(date)
  return d === 0 ? 6 : d - 1
}

// GET /api/sessions?weekStart=yyyy-MM-dd
// Returns sessions for all campaigns the user is in, for that week
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const weekStartStr = searchParams.get("weekStart")
  if (!weekStartStr) return NextResponse.json({ error: "weekStart required" }, { status: 400 })

  const weekStart = parseISO(weekStartStr)

  const campaigns = await prisma.campaign.findMany({
    where: {
      OR: [
        { masterId: session.user.id },
        { players: { some: { userId: session.user.id } } },
      ],
    },
    include: { master: { select: { username: true } } },
  })

  const campaignIds = campaigns.map((c) => c.id)
  const overrides = await prisma.session.findMany({
    where: { campaignId: { in: campaignIds }, weekStart },
  })

  const result = campaigns.map((c) => {
    const override = overrides.find((o) => o.campaignId === c.id)
    const defaultDate = addDays(weekStart, c.defaultDayOfWeek)
    const date = override?.date ?? defaultDate
    return {
      campaignId: c.id,
      campaignName: c.name,
      campaignColor: c.color,
      masterName: c.master.username,
      isMaster: c.masterId === session.user.id,
      date: date.toISOString().split("T")[0],
      dayOfWeek: isoToWeekday(date),
      isCancelled: override?.isCancelled ?? false,
      isOverridden: !!override,
    }
  })

  return NextResponse.json(result)
}

// POST /api/sessions — create or update session override (master of campaign)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { campaignId, weekStart: weekStartStr, date: dateStr, isCancelled } = body

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const canEdit =
    session.user.role === "ADMIN" || campaign.masterId === session.user.id
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const weekStart = parseISO(weekStartStr)
  const date = dateStr ? parseISO(dateStr) : addDays(weekStart, campaign.defaultDayOfWeek)

  const result = await prisma.session.upsert({
    where: { campaignId_weekStart: { campaignId, weekStart } },
    update: { date, isCancelled: isCancelled ?? false },
    create: { campaignId, weekStart, date, isCancelled: isCancelled ?? false },
  })

  return NextResponse.json(result)
}
