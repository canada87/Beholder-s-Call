import { NextResponse } from "next/server"
import { getServerSession, Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { parseISO } from "date-fns"

function adminOnly(session: Session | null) {
  return !session || session.user.role !== "ADMIN"
}

// GET /api/admin/availability?userId=xxx&campaignId=xxx&weekStart=yyyy-MM-dd
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (adminOnly(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const campaignId = searchParams.get("campaignId")
  const weekStartStr = searchParams.get("weekStart")
  if (!userId || !campaignId || !weekStartStr)
    return NextResponse.json({ error: "userId, campaignId and weekStart required" }, { status: 400 })

  const weekStart = parseISO(weekStartStr)
  const dbVotes = await prisma.availability.findMany({
    where: { userId, campaignId, weekStart },
  })

  const result: Record<number, string | null> = {}
  for (let d = 0; d < 7; d++) result[d] = null
  dbVotes.forEach((v) => { result[v.dayOfWeek] = v.vote })

  return NextResponse.json(result)
}

// POST /api/admin/availability
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (adminOnly(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId, campaignId, weekStart: weekStartStr, dayOfWeek, vote } = await req.json()
  if (!userId || !campaignId || !weekStartStr || dayOfWeek === undefined)
    return NextResponse.json({ error: "userId, campaignId, weekStart, dayOfWeek required" }, { status: 400 })

  const weekStart = parseISO(weekStartStr)

  if (vote === null) {
    await prisma.availability.deleteMany({
      where: { userId, campaignId, weekStart, dayOfWeek },
    })
    return NextResponse.json({ ok: true })
  }

  const result = await prisma.availability.upsert({
    where: {
      userId_campaignId_weekStart_dayOfWeek: { userId, campaignId, weekStart, dayOfWeek },
    },
    update: { vote },
    create: { userId, campaignId, weekStart, dayOfWeek, vote },
  })

  return NextResponse.json(result)
}
