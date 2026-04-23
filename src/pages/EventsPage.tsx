import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import type { EventStatus } from '../types/database'
import { EventStatusBadge } from '../components/events/EventStatusBadge'
import { CreateEventModal } from '../components/events/CreateEventModal'

type EventRow = {
  id: string
  title: string
  status: EventStatus
  event_date: string
  guest_count: number
  budget_cents: number | null
  location_name: string | null
  customers: { company_name: string } | null
}

const STATUS_FILTERS: { value: EventStatus | 'alle'; label: string }[] = [
  { value: 'alle',          label: 'Alle' },
  { value: 'anfrage',       label: 'Anfrage' },
  { value: 'angebot',       label: 'Angebot' },
  { value: 'bestaetigt',    label: 'Bestätigt' },
  { value: 'durchfuehrung', label: 'Durchführung' },
  { value: 'abrechnung',    label: 'Abrechnung' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
]

export function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'alle'>('alle')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('events')
      .select('id, title, status, event_date, guest_count, budget_cents, location_name, customers(company_name)')
      .order('event_date', { ascending: false })

    if (statusFilter !== 'alle') {
      query = query.eq('status', statusFilter)
    }
    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`)
    }

    const { data } = await query
    setEvents((data ?? []) as unknown as EventRow[])
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => { loadEvents() }, [loadEvents])

  function formatBudget(cents: number | null) {
    if (!cents) return '–'
    return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Aufträge</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
        >
          + Neue Anfrage
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Nach Titel suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <span className="text-sm text-gray-400">
          {loading ? '' : `${events.length} Auftrag${events.length !== 1 ? 'e' : ''}`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Laden...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm mb-3">Keine Aufträge gefunden</p>
          {statusFilter === 'alle' && !search && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Erste Anfrage anlegen →
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Auftrag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Kunde</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Gäste</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Budget</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map(event => (
                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/events/${event.id}`}
                      className="font-medium text-gray-900 hover:text-red-600 transition-colors"
                    >
                      {event.title}
                    </Link>
                    {event.location_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{event.location_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {event.customers?.company_name ?? '–'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {format(new Date(event.event_date), 'dd.MM.yyyy', { locale: de })}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {event.guest_count}
                  </td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">
                    {formatBudget(event.budget_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={event.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadEvents() }}
        />
      )}
    </div>
  )
}
