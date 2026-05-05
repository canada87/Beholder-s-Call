import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// PUT /api/campaigns/[id] — update (admin or master of this campaign)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const canEdit =
    session.user.role === "ADMIN" || campaign.masterId === session.user.id
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.defaultDayOfWeek !== undefined) data.defaultDayOfWeek = body.defaultDayOfWeek
  if (body.color !== undefined) data.color = body.color
  if (body.masterId !== undefined && session.user.role === "ADMIN")
    data.masterId = body.masterId

  const updated = await prisma.campaign.update({ where: { id: params.id }, data })
  return NextResponse.json(updated)
}

// DELETE /api/campaigns/[id] — admin only
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.campaign.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
