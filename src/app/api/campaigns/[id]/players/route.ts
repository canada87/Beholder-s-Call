import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/campaigns/[id]/players — add player (admin only)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId } = await req.json()
  const row = await prisma.campaignPlayer.upsert({
    where: { campaignId_userId: { campaignId: params.id, userId } },
    update: {},
    create: { campaignId: params.id, userId },
  })
  return NextResponse.json(row, { status: 201 })
}

// DELETE /api/campaigns/[id]/players?userId=xxx — remove player (admin only)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  await prisma.campaignPlayer.delete({
    where: { campaignId_userId: { campaignId: params.id, userId } },
  })
  return NextResponse.json({ ok: true })
}
