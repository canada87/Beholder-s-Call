import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import Navigation from "@/components/Navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const masterCount = await prisma.campaign.count({
    where: { masterId: session.user.id },
  })
  const isMaster = masterCount > 0 || session.user.role === "ADMIN"

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center gap-2">
        <span className="text-xl">👁️</span>
        <span className="font-bold text-violet-400">Beholder's Call</span>
        <span className="ml-auto text-sm text-gray-400">{session.user.username}</span>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4">{children}</main>
      <Navigation isMaster={isMaster} />
    </div>
  )
}
