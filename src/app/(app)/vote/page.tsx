"use client"
import { useState, useEffect, useCallback } from "react"
import WeekSelector from "@/components/WeekSelector"
import { getNext4Weeks, weekStartToString, DAYS_FULL, DAYS_SHORT, formatDayLabel } from "@/lib/utils"
import { addDays, parseISO } from "date-fns"

type VoteValue = "AVAILABLE" | "PREFERRED" | "UNAVAILABLE" | null

interface Campaign {
  id: string
  name: string
  color: string
}

interface PlayerVotes {
  id: string
  username: string
  votes: Record<number, VoteValue>
}

export default function VotePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState("")
  const [weeks] = useState(getNext4Weeks)
  const [selectedWeek, setSelectedWeek] = useState(weeks[0])
  const [myVotes, setMyVotes] = useState<Record<number, VoteValue>>({})
  const [playersVotes, setPlayersVotes] = useState<PlayerVotes[]>([])
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data)
        if (data.length > 0) setSelectedCampaign(data[0].id)
      })
  }, [])

  const fetchVotes = useCallback(async () => {
    if (!selectedCampaign) return
    const res = await fetch(
      `/api/availability?campaignId=${selectedCampaign}&weekStart=${weekStartToString(selectedWeek)}`
    )
    const data = await res.json()
    const votes: Record<number, VoteValue> = {}
    data.days.forEach((d: { dayOfWeek: number; vote: VoteValue }) => {
      votes[d.dayOfWeek] = d.vote
    })
    setMyVotes(votes)
    setPlayersVotes(data.playersVotes ?? [])
  }, [selectedCampaign, selectedWeek])

  useEffect(() => { fetchVotes() }, [fetchVotes])

  const handleVote = async (dayOfWeek: number, vote: VoteValue) => {
    const previous = myVotes[dayOfWeek]
    const next = previous === vote ? null : vote
    setMyVotes((prev) => ({ ...prev, [dayOfWeek]: next }))
    setSaving(dayOfWeek)
    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: selectedCampaign,
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
      <h1 className="text-2xl font-bold">Disponibilità</h1>

      {campaigns.length === 0 ? (
        <p className="text-gray-400">Non sei iscritto a nessuna campagna.</p>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Campagna</label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <WeekSelector weeks={weeks} selected={selectedWeek} onChange={setSelectedWeek} />

          <div>
            <h2 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
              La mia disponibilità
            </h2>
            <div className="space-y-2">
              {weekDates.map((date, i) => (
                <DayRow
                  key={i}
                  dayName={DAYS_FULL[i]}
                  dateLabel={formatDayLabel(date)}
                  vote={myVotes[i] ?? null}
                  saving={saving === i}
                  onChange={(v) => handleVote(i, v)}
                />
              ))}
            </div>
          </div>

          {playersVotes.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                Disponibilità del gruppo
              </h2>
              <div className="bg-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left px-3 py-2 text-gray-400 font-medium">Giocatore</th>
                        {DAYS_SHORT.map((d) => (
                          <th key={d} className="px-2 py-2 text-gray-400 font-medium text-center">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {playersVotes.map((p) => (
                        <tr key={p.id} className="border-b border-gray-700 last:border-0">
                          <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{p.username}</td>
                          {Array.from({ length: 7 }, (_, i) => (
                            <td key={i} className="px-2 py-2 text-center">
                              <VoteIcon vote={p.votes[i]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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

function VoteIcon({ vote }: { vote: VoteValue }) {
  if (vote === "AVAILABLE") return <span className="text-green-400">✓</span>
  if (vote === "PREFERRED") return <span className="text-yellow-400">★</span>
  if (vote === "UNAVAILABLE") return <span className="text-red-400">✗</span>
  return <span className="text-gray-600">–</span>
}
