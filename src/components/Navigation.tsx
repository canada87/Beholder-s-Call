"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"

const NAV = [
  { href: "/", label: "Calendario", icon: "📅" },
  { href: "/vote", label: "Vota", icon: "🎲" },
  { href: "/master", label: "Master", icon: "⚔️", masterOnly: true },
  { href: "/admin", label: "Admin", icon: "⚙️", adminOnly: true },
]

export default function Navigation({ isMaster }: { isMaster: boolean }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"

  const visible = NAV.filter((item) => {
    if (item.adminOnly) return isAdmin
    if (item.masterOnly) return isMaster || isAdmin
    return true
  })

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 pb-safe z-50">
      <div className="flex justify-around">
        {visible.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-3 px-4 flex-1 transition-colors ${
                active ? "text-violet-400" : "text-gray-400"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs mt-0.5">{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
          className="flex flex-col items-center py-3 px-4 flex-1 text-gray-400 transition-colors hover:text-red-400"
        >
          <span className="text-xl">🚪</span>
          <span className="text-xs mt-0.5">Esci</span>
        </button>
      </div>
    </nav>
  )
}
