"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { addDays } from "date-fns"
import { DAYS_FULL, CAMPAIGN_COLORS, getNext4Weeks, weekStartToString, formatDayLabel } from "@/lib/utils"
import WeekSelector from "@/components/WeekSelector"

interface User {
  id: string
  email: string
  username: string
  role: "ADMIN" | "PLAYER"
}

interface Campaign {
  id: string
  name: string
  color: string
  defaultDayOfWeek: number
  master: { id: string; username: string }
  players: { id: string; username: string }[]
}

type VoteValue = "AVAILABLE" | "PREFERRED" | "UNAVAILABLE" | null
type Tab = "users" | "campaigns" | "availability"

export default function AdminPage() {
  const { data: session } = useSession()
  const [tab, setTab] = useState<Tab>("users")
  const [users, setUsers] = useState<User[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  const fetchUsers = useCallback(() =>
    fetch("/api/admin/users").then((r) => r.json()).then(setUsers), [])
  const fetchCampaigns = useCallback(() =>
    fetch("/api/admin/campaigns").then((r) => r.json()).then(setCampaigns), [])

  useEffect(() => { fetchUsers(); fetchCampaigns() }, [fetchUsers, fetchCampaigns])

  if (session?.user?.role !== "ADMIN") {
    return <div className="text-gray-400 py-10 text-center">Accesso riservato agli admin.</div>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Amministrazione</h1>

      <div className="flex rounded-xl overflow-hidden border border-gray-700">
        {(["users", "campaigns", "availability"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-violet-700 text-white" : "bg-gray-800 text-gray-400"
            }`}
          >
            {t === "users" ? "Utenti" : t === "campaigns" ? "Campagne" : "Disponibilità"}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <UsersTab users={users} onRefresh={fetchUsers} />
      )}
      {tab === "campaigns" && (
        <CampaignsTab campaigns={campaigns} users={users} onRefresh={fetchCampaigns} />
      )}
      {tab === "availability" && (
        <AvailabilityTab users={users} campaigns={campaigns} />
      )}
    </div>
  )
}

// ---- Users Tab ----

function UsersTab({ users, onRefresh }: { users: User[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  return (
    <div className="space-y-3">
      <button
        onClick={() => { setEditing(null); setShowForm(true) }}
        className="w-full bg-violet-700 hover:bg-violet-600 text-white py-3 rounded-xl font-medium transition-colors"
      >
        + Nuovo utente
      </button>

      {showForm && (
        <UserForm
          user={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onRefresh() }}
        />
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{u.username}</div>
              <div className="text-xs text-gray-400">{u.email}</div>
              <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
                u.role === "ADMIN" ? "bg-violet-900 text-violet-300" : "bg-gray-700 text-gray-400"
              }`}>
                {u.role}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(u); setShowForm(true) }}
                className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-gray-300 transition-colors"
              >
                Modifica
              </button>
              <DeleteUserButton userId={u.id} onDeleted={onRefresh} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user: User | null
  onClose: () => void
  onSaved: () => void
}) {
  const [username, setUsername] = useState(user?.username ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"ADMIN" | "PLAYER">(user?.role ?? "PLAYER")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const body: Record<string, string> = { username, email, role }
    if (password) body.password = password

    const res = user
      ? await fetch(`/api/admin/users/${user.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, password }) })

    setLoading(false)
    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json()
      setError(d.error ?? "Errore")
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold">{user ? "Modifica utente" : "Nuovo utente"}</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none"
        />
        <input
          type="password"
          placeholder={user ? "Nuova password (lascia vuoto per non cambiare)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!user}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "ADMIN" | "PLAYER")}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none"
        >
          <option value="PLAYER">PLAYER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl transition-colors text-sm">
            Annulla
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-xl transition-colors text-sm">
            {loading ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </form>
    </div>
  )
}

function DeleteUserButton({ userId, onDeleted }: { userId: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) {
    return (
      <button
        onClick={async () => {
          await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
          onDeleted()
        }}
        className="text-xs bg-red-800 hover:bg-red-700 px-3 py-2 rounded-lg text-red-200 transition-colors"
      >
        Conferma
      </button>
    )
  }
  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs bg-gray-700 hover:bg-red-900 px-3 py-2 rounded-lg text-gray-300 transition-colors"
    >
      Elimina
    </button>
  )
}

// ---- Campaigns Tab ----

function CampaignsTab({
  campaigns,
  users,
  onRefresh,
}: {
  campaigns: Campaign[]
  users: User[]
  onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)

  return (
    <div className="space-y-3">
      <button
        onClick={() => { setEditing(null); setShowForm(true) }}
        className="w-full bg-violet-700 hover:bg-violet-600 text-white py-3 rounded-xl font-medium transition-colors"
      >
        + Nuova campagna
      </button>

      {showForm && (
        <CampaignForm
          campaign={editing}
          users={users}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onRefresh() }}
        />
      )}

      <div className="space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-gray-800 rounded-xl p-4" style={{ borderLeft: `4px solid ${c.color}` }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  DM: {c.master.username} · {DAYS_FULL[c.defaultDayOfWeek]}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.players.map((p) => (
                    <span key={p.id} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                      {p.username}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => { setEditing(c); setShowForm(true) }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-gray-300 transition-colors"
                >
                  Modifica
                </button>
                <DeleteCampaignButton campaignId={c.id} onDeleted={onRefresh} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CampaignForm({
  campaign,
  users,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null
  users: User[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(campaign?.name ?? "")
  const [masterId, setMasterId] = useState(campaign?.master.id ?? "")
  const [defaultDayOfWeek, setDefaultDayOfWeek] = useState(campaign?.defaultDayOfWeek ?? 2)
  const [color, setColor] = useState(campaign?.color ?? CAMPAIGN_COLORS[0])
  const [playerIds, setPlayerIds] = useState<string[]>(
    campaign?.players.map((p) => p.id) ?? []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const togglePlayer = (id: string) =>
    setPlayerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!masterId) { setError("Seleziona un master"); return }
    setLoading(true)
    setError("")

    if (campaign) {
      const r = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, masterId, defaultDayOfWeek, color }),
      })
      if (!r.ok) { setLoading(false); setError("Errore aggiornamento campagna"); return }
      const current = campaign.players.map((p) => p.id)
      for (const uid of current) {
        await fetch(`/api/campaigns/${campaign.id}/players?userId=${uid}`, { method: "DELETE" })
      }
      for (const uid of playerIds) {
        await fetch(`/api/campaigns/${campaign.id}/players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid }),
        })
      }
    } else {
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, masterId, defaultDayOfWeek, color, playerIds }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setLoading(false)
        setError(d.error ?? "Errore creazione campagna")
        return
      }
    }

    setLoading(false)
    onSaved()
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold">{campaign ? "Modifica campagna" : "Nuova campagna"}</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          placeholder="Nome campagna"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none"
        />
        <select
          value={masterId}
          onChange={(e) => setMasterId(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none"
        >
          <option value="">Seleziona master…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
        </select>
        <select
          value={defaultDayOfWeek}
          onChange={(e) => setDefaultDayOfWeek(Number(e.target.value))}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none"
        >
          {DAYS_FULL.map((d, i) => (
            <option key={i} value={i}>{d}</option>
          ))}
        </select>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Colore</label>
          <div className="flex gap-2 flex-wrap">
            {CAMPAIGN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${color === c ? "ring-2 ring-white scale-110" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Giocatori</label>
          <div className="grid grid-cols-2 gap-1">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => togglePlayer(u.id)}
                className={`text-sm px-3 py-2 rounded-lg text-left transition-colors ${
                  playerIds.includes(u.id)
                    ? "bg-violet-700 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                {playerIds.includes(u.id) ? "✓ " : ""}{u.username}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl transition-colors text-sm">
            Annulla
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-xl transition-colors text-sm">
            {loading ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---- Availability Tab ----

function AvailabilityTab({ users, campaigns }: { users: User[]; campaigns: Campaign[] }) {
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [weeks] = useState(getNext4Weeks)
  const [selectedWeek, setSelectedWeek] = useState(weeks[0])
  const [votes, setVotes] = useState<Record<number, VoteValue>>({})
  const [saving, setSaving] = useState<number | null>(null)

  const userCampaigns = campaigns.filter(
    (c) => c.players.some((p) => p.id === selectedUserId) || c.master.id === selectedUserId
  )

  useEffect(() => {
    const uc = campaigns.filter(
      (c) => c.players.some((p) => p.id === selectedUserId) || c.master.id === selectedUserId
    )
    setSelectedCampaignId(uc[0]?.id ?? "")
    setVotes({})
  }, [selectedUserId, campaigns])

  const fetchVotes = useCallback(async () => {
    if (!selectedUserId || !selectedCampaignId) return
    const res = await fetch(
      `/api/admin/availability?userId=${selectedUserId}&campaignId=${selectedCampaignId}&weekStart=${weekStartToString(selectedWeek)}`
    )
    const data = await res.json()
    setVotes(data)
  }, [selectedUserId, selectedCampaignId, selectedWeek])

  useEffect(() => { fetchVotes() }, [fetchVotes])

  const handleVote = async (dayOfWeek: number, vote: VoteValue) => {
    const previous = votes[dayOfWeek]
    const next = previous === vote ? null : vote
    setVotes((prev) => ({ ...prev, [dayOfWeek]: next }))
    setSaving(dayOfWeek)
    await fetch("/api/admin/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUserId,
        campaignId: selectedCampaignId,
        weekStart: weekStartToString(selectedWeek),
        dayOfWeek,
        vote: next,
      }),
    })
    setSaving(null)
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i))

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Utente</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none"
        >
          <option value="">Seleziona utente…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
        </select>
      </div>

      {selectedUserId && userCampaigns.length === 0 && (
        <p className="text-gray-400 text-sm">Utente non iscritto a nessuna campagna.</p>
      )}

      {selectedUserId && userCampaigns.length > 0 && (
        <>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Campagna</label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none"
            >
              {userCampaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <WeekSelector weeks={weeks} selected={selectedWeek} onChange={setSelectedWeek} />

          {selectedCampaignId && (
            <div className="space-y-2">
              {weekDates.map((date, i) => (
                <DayRow
                  key={i}
                  dayName={DAYS_FULL[i]}
                  dateLabel={formatDayLabel(date)}
                  vote={votes[i] ?? null}
                  saving={saving === i}
                  onChange={(v) => handleVote(i, v)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DayRow({
  dayName,
  dateLabel,
  vote,
  saving,
  onChange,
}: {
  dayName: string
  dateLabel: string
  vote: VoteValue
  saving: boolean
  onChange: (v: VoteValue) => void
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="font-medium text-sm">{dayName}</div>
        <div className="text-xs text-gray-400">{dateLabel}</div>
      </div>
      <div className="flex gap-1 items-center">
        {saving && <span className="text-xs text-gray-500 mr-1">...</span>}
        <VoteButton label="✓" value="AVAILABLE" active={vote === "AVAILABLE"} color="bg-green-600" onClick={onChange} />
        <VoteButton label="★" value="PREFERRED" active={vote === "PREFERRED"} color="bg-yellow-500" onClick={onChange} />
        <VoteButton label="✗" value="UNAVAILABLE" active={vote === "UNAVAILABLE"} color="bg-red-600" onClick={onChange} />
      </div>
    </div>
  )
}

function VoteButton({
  label,
  value,
  active,
  color,
  onClick,
}: {
  label: string
  value: VoteValue
  active: boolean
  color: string
  onClick: (v: VoteValue) => void
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className={`w-10 h-10 rounded-full text-base font-bold transition-colors flex items-center justify-center ${
        active ? `${color} text-white` : "bg-gray-700 text-gray-400 hover:bg-gray-600"
      }`}
    >
      {label}
    </button>
  )
}

function DeleteCampaignButton({ campaignId, onDeleted }: { campaignId: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) {
    return (
      <button
        onClick={async () => {
          await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" })
          onDeleted()
        }}
        className="text-xs bg-red-800 hover:bg-red-700 px-3 py-1.5 rounded-lg text-red-200 transition-colors"
      >
        Conferma
      </button>
    )
  }
  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs bg-gray-700 hover:bg-red-900 px-3 py-1.5 rounded-lg text-gray-300 transition-colors"
    >
      Elimina
    </button>
  )
}
