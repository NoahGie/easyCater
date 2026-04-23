import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type Customer = { id: string; company_name: string }

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function CreateEventModal({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    customer_id: '',
    event_date: '',
    start_time: '',
    end_time: '',
    location_name: '',
    location_address: '',
    guest_count: '50',
    budget_cents: '',
    internal_notes: '',
  })

  useEffect(() => {
    supabase
      .from('customers')
      .select('id, company_name')
      .order('company_name')
      .then(({ data }) => { if (data) setCustomers(data) })
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.customer_id || !form.event_date) {
      setError('Titel, Kunde und Datum sind Pflichtfelder.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase.from('events').insert({
      title: form.title.trim(),
      customer_id: form.customer_id,
      event_date: form.event_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location_name: form.location_name || null,
      location_address: form.location_address || null,
      guest_count: parseInt(form.guest_count) || 0,
      budget_cents: form.budget_cents ? Math.round(parseFloat(form.budget_cents) * 100) : null,
      internal_notes: form.internal_notes || null,
      status: 'anfrage' as const,
      created_by: user?.id ?? null,
    })
    setSaving(false)
    if (dbErr) {
      setError(dbErr.message)
    } else {
      onCreated()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Neue Anfrage</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="z.B. Weihnachtsfeier Müller GmbH"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde *</label>
            <select
              value={form.customer_id}
              onChange={e => set('customer_id', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Kunde auswählen...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            {customers.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Noch keine Kunden vorhanden – zuerst unter „Kunden" anlegen.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
            <input
              type="date"
              value={form.event_date}
              onChange={e => set('event_date', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit von</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => set('start_time', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit bis</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => set('end_time', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veranstaltungsort</label>
            <input
              value={form.location_name}
              onChange={e => set('location_name', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Name des Veranstaltungsortes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              value={form.location_address}
              onChange={e => set('location_address', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Straße, PLZ Ort"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gästeanzahl</label>
              <input
                type="number"
                min="0"
                value={form.guest_count}
                onChange={e => set('guest_count', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.budget_cents}
                onChange={e => set('budget_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="0,00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interne Notizen</label>
            <textarea
              value={form.internal_notes}
              onChange={e => set('internal_notes', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 font-medium"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Anfrage anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
