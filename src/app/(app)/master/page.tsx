"use client"
import { useState, useEffect, useCallback } from "react"
import WeekSelector from "@/components/WeekSelector"
import { getNext4Weeks, weekStartToString, DAYS_FULL, DAYS_SHORT, formatDayLabel } from "@/lib/utils"
import { addDays, parseISO } from "date-fns"

type VoteValue = "AVAILABLE" | "PREFERRED" | "UNAVAILABLE" | null

interface MasterData {
  campaign: { id: string; name: string; color: string; defaultDayOfWeek: number; masterName: string }
  currentSession: { date: string; dayOfWeek: number; isCancelled: boolean; isOverridden: boolean }
  players: { id: string; username: string; votes: Record<number, VoteValue> }[]
  allSessions: { campaignId: string; campaignName: string; campaignColor: string; dayOfWeek: number }[]
}

interface Campaign {
  id: string
  name: string
  color: string
  isMaster: boolean
}

export default function MasterPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState("")
  const [weeks] = useState(getNext4Weeks)
  const [selectedWeek, setSelectedWeek] = useState(weeks[0])
  const [data, setData] = useState<MasterData | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDefaultModal, setShowDefaultModal] = useState(false)
  const [newDefaultDay, setNewDefaultDay] = useState(0)

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((all: Campaign[]) => {
        const mastered = all.filter((c) => c.isMaster)
        setCampaigns(mastered)
        if (mastered.length > 0) setSelectedCampaign(mastered[0].id)
      })
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedCampaign) return
    setLoading(true)
    const res = await fetch(
      `/api/master/availability?campaignId=${selectedCampaign}&weekStart=${weekStartToString(selectedWeek)}`
    )
    const d = await res.json()
    setData(d)
    setLoading(false)
  }, [selectedCampaign, selectedWeek])

  useEffect(() => { fetchData() }, [fetchData])

  const setSessionDay = async (dayOfWeek: number) => {
    if (!data) return
    setActionLoading(true)
    const date = addDays(selectedWeek, dayOfWeek)
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: selectedCampaign,
        weekStart: weekStartToString(selectedWeek),
        date: date.toISOString().split("T")[0],
        isCancelled: false,
      }),
    })
    await fetchData()
    setActionLoading(false)
  }

  const toggleCancel = async () => {
    if (!data) return
    setActionLoading(true)
    const newCancelled = !data.currentSession.isCancelled
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: selectedCampaign,
        weekStart: weekStartToString(selectedWeek),
        isCancelled: newCancelled,
      }),
    })
    await fetchData()
    setActionLoading(false)
  }

  const changeDefaultDay = async () => {
    setActionLoading(true)
    await fetch(`/api/campaigns/${selectedCampaign}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultDayOfWeek: newDefaultDay }),
    })
    setShowDefaultModal(false)
    await fetchData()
    setActionLoading(false)
  }

  if (campaigns.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Vista Master</h1>
        <p className="text-gray-400">Non sei master di nessuna campagna.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Vista Master</h1>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Campagna</label>
        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <WeekSelector weeks={weeks} selected={selectedWeek} onChange={setSelectedWeek} />

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : !data ? null : (
        <>
          {/* Session control */}
          <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sessione</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setNewDefaultDay(data.campaign.defaultDayOfWeek)
                    setShowDefaultModal(true)
                  }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-gray-300 transition-colors"
                >
                  Giorno default
                </button>
                <button
                  onClick={toggleCancel}
                  disabled={actionLoading}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    data.currentSession.isCancelled
                      ? "bg-green-800 hover:bg-green-700 text-green-200"
                      : "bg-red-900 hover:bg-red-800 text-red-200"
                  }`}
                >
                  {data.currentSession.isCancelled ? "Ripristina" : "Annulla"}
                </button>
              </div>
            </div>

            {data.currentSession.isCancelled ? (
              <p className="text-red-400 text-sm">Sessione annullata questa settimana</p>
            ) : (
              <p className="text-sm text-gray-300">
                Giorno corrente:{" "}
                <strong className="text-white">
                  {DAYS_FULL[data.currentSession.dayOfWeek]}{" "}
                  {formatDayLabel(parseISO(data.currentSession.date))}
                </strong>
                {data.currentSession.isOverridden && (
                  <span className="ml-2 text-xs text-yellow-400">modificato</span>
                )}
              </p>
            )}
          </div>

          {/* Day cards */}
          <div className="space-y-3">
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(selectedWeek, i)
              const conflict = data.allSessions.find((s) => s.dayOfWeek === i)
              const isCurrentDay = data.currentSession.dayOfWeek === i && !data.currentSession.isCancelled

              const available = data.players.filter((p) =>
                p.votes[i] === "AVAILABLE" || p.votes[i] === "PREFERRED"
              )
              const preferred = data.players.filter((p) => p.votes[i] === "PREFERRED")
              const unavailable = data.players.filter((p) => p.votes[i] === "UNAVAILABLE")
              const noVote = data.players.filter((p) => !p.votes[i])

              return (
                <div
                  key={i}
                  className={`rounded-2xl p-4 border transition-colors ${
                    isCurrentDay
                      ? "border-violet-500 bg-violet-900/20"
                      : "border-gray-700 bg-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold">{DAYS_FULL[i]}</span>
                      <span className="text-sm text-gray-400 ml-2">{formatDayLabel(date)}</span>
                      {isCurrentDay && (
                        <span className="ml-2 text-xs bg-violet-700 text-violet-200 px-1.5 py-0.5 rounded">
                          sessione
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setSessionDay(i)}
                      disabled={actionLoading || isCurrentDay}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        isCurrentDay
                          ? "bg-gray-700 text-gray-500 cursor-default"
                          : "bg-violet-700 hover:bg-violet-600 text-white"
                      }`}
                    >
                      {isCurrentDay ? "✓ Scelto" : "Scegli"}
                    </button>
                  </div>

                  {conflict && (
                    <div
                      className="text-xs px-2 py-1 rounded mb-2 flex items-center gap-1"
                      style={{ backgroundColor: conflict.campaignColor + "33", color: conflict.campaignColor }}
                    >
                      <span>⚠</span>
                      <span>Conflitto: {conflict.campaignName}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    {available.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {available.map((p) => (
                          <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full ${
                            p.votes[i] === "PREFERRED"
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-green-900 text-green-300"
                          }`}>
                            {p.votes[i] === "PREFERRED" ? "★ " : "✓ "}{p.username}
                          </span>
                        ))}
                      </div>
                    )}
                    {unavailable.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {unavailable.map((p) => (
                          <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">
                            ✗ {p.username}
                          </span>
                        ))}
                      </div>
                    )}
                    {noVote.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {noVote.map((p) => (
                          <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                            – {p.username}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    {available.length}/{data.players.length} disponibili
                    {preferred.length > 0 && ` · ${preferred.length} preferiscono`}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Default day modal */}
      {showDefaultModal && data && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold">Cambia giorno predefinito</h3>
            <p className="text-sm text-gray-400">
              Questo cambierà il giorno di default per tutte le settimane future senza override.
            </p>
            <select
              value={newDefaultDay}
              onChange={(e) => setNewDefaultDay(Number(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white"
            >
              {DAYS_FULL.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDefaultModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={changeDefaultDay}
                disabled={actionLoading}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-3 rounded-xl transition-colors"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
