import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

function adminOnly(session: Awaited<ReturnType<typeof getServerSession>>) {
  return !session || session.user.role !== "ADMIN"
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (adminOnly(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, role: true, createdAt: true },
    orderBy: { username: "asc" },
  })
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (adminOnly(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { email, username, password, role } = await req.json()
  if (!email || !username || !password)
    return NextResponse.json({ error: "email, username and password required" }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, username, passwordHash, role: role ?? "PLAYER" },
    select: { id: true, email: true, username: true, role: true },
  })
  return NextResponse.json(user, { status: 201 })
}
