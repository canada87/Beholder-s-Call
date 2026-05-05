import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

function adminOnly(session: Session | null) {
  return !session || session.user.role !== "ADMIN"
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (adminOnly(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.email) data.email = body.email
  if (body.username) data.username = body.username
  if (body.role) data.role = body.role
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10)

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, email: true, username: true, role: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (adminOnly(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
