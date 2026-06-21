"use client"
import { useState, useEffect, useCallback } from "react"
import WeekSelector from "@/components/WeekSelector"
import { getNext2Weeks, weekStartToString, DAYS_FULL, DAYS_SHORT, formatDayLabel } from "@/lib/utils"
import { addDays } from "date-fns"

type VoteValue = "AVAILABLE" | "PREFERRED" | "UNAVAILABLE" | null

interface PlayerVotes {
  id: string
  username: string
  votes: Record<number, VoteValue>
  campaignIds: string[]
}

interface CampaignHighlight {
  campaignId: string
  campaignName: string
  campaignColor: string
  bestDay: number | null
}

export default function VotePage() {
  const [weeks] = useState(getNext2Weeks)
  const [selectedWeek, setSelectedWeek] = useState(weeks[0])
  const [myVotes, setMyVotes] = useState<Record<number, VoteValue>>({})
  const [playersVotes, setPlayersVotes] = useState<PlayerVotes[]>([])
  const [campaignHighlights, setCampaignHighlights] = useState<CampaignHighlight[]>([])
  const [saving, setSaving] = useState<number | null>(null)
  const [noGroup, setNoGroup] = useState(false)

  const fetchVotes = useCallback(async () => {
    const res = await fetch(`/api/availability?weekStart=${weekStartToString(selectedWeek)}`)
    const data = await res.json()
    if (!data.days) return
    const votes: Record<number, VoteValue> = {}
    data.days.forEach((d: { dayOfWeek: number; vote: VoteValue }) => {
      votes[d.dayOfWeek] = d.vote
    })
    setMyVotes(votes)
    setPlayersVotes(data.playersVotes ?? [])
    setCampaignHighlights(data.campaignHighlights ?? [])
    setNoGroup((data.playersVotes ?? []).length === 0)
  }, [selectedWeek])

  useEffect(() => { fetchVotes() }, [fetchVotes])

  const handleVote = async (dayOfWeek: number, vote: VoteValue) => {
    const previous = myVotes[dayOfWeek]
    const next = previous === vote ? null : vote
    setMyVotes((prev) => ({ ...prev, [dayOfWeek]: next }))
    setSaving(dayOfWeek)
    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: weekStartToString(selectedWeek), dayOfWeek, vote: next }),
    })
    setSaving(null)
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Disponibilità</h1>

      {noGroup ? (
        <p className="text-gray-400">Non sei iscritto a nessuna campagna.</p>
      ) : (
        <>
          <WeekSelector weeks={weeks} selected={selectedWeek} onChange={setSelectedWeek} />

          {playersVotes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                  Disponibilità del gruppo
                </h2>
                {campaignHighlights.length > 0 && (
                  <div className="flex gap-3">
                    {campaignHighlights.filter((h) => h.bestDay !== null).map((h) => (
                      <span key={h.campaignId} className="flex items-center gap-1 text-xs text-gray-400">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: h.campaignColor }} />
                        {h.campaignName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left px-3 py-2 text-gray-400 font-medium">Giocatore</th>
                        {DAYS_SHORT.map((d, i) => {
                          const hl = campaignHighlights.find((h) => h.bestDay === i)
                          return (
                            <th
                              key={d}
                              className="px-2 pt-2 pb-1.5 font-medium text-center"
                              style={hl ? { borderBottom: `2px solid ${hl.campaignColor}` } : {}}
                            >
                              {hl && (
                                <div
                                  className="w-1.5 h-1.5 rounded-full mx-auto mb-1"
                                  style={{ backgroundColor: hl.campaignColor }}
                                />
                              )}
                              <span className={hl ? "text-white" : "text-gray-400"}>{d}</span>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {playersVotes.map((p) => (
                        <tr key={p.id} className="border-b border-gray-700 last:border-0">
                          <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{p.username}</td>
                          {Array.from({ length: 7 }, (_, i) => {
                            const hl = campaignHighlights.find((h) => h.bestDay === i)
                            const inCampaign = hl ? p.campaignIds.includes(hl.campaignId) : false
                            return (
                              <td
                                key={i}
                                className="px-2 py-1.5 text-center"
                                style={hl ? { backgroundColor: hl.campaignColor + "18" } : {}}
                              >
                                {inCampaign && (
                                  <div
                                    className="w-2 h-2 rounded-full mx-auto mb-0.5"
                                    style={{ backgroundColor: hl!.campaignColor }}
                                  />
                                )}
                                {!inCampaign && hl && <div className="h-2 mb-0.5" />}
                                <VoteIcon vote={p.votes[i]} />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
