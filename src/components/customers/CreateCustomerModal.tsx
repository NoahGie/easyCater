import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function CreateCustomerModal({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    company_name: '',
    industry: '',
    street: '',
    city: '',
    postal_code: '',
    country: 'DE',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim()) {
      setError('Firmenname ist ein Pflichtfeld.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase.from('customers').insert({
      company_name: form.company_name.trim(),
      industry: form.industry.trim() || null,
      street: form.street.trim() || null,
      city: form.city.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country || 'DE',
      notes: form.notes.trim() || null,
      is_repeat_client: false,
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Neuer Kunde</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Firmenname *</label>
            <input
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="z.B. Müller GmbH"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branche</label>
            <input
              value={form.industry}
              onChange={e => set('industry', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="z.B. IT, Pharma, Automobil"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
            <input
              value={form.street}
              onChange={e => set('street', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Musterstraße 1"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
              <input
                value={form.postal_code}
                onChange={e => set('postal_code', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="12345"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
              <input
                value={form.city}
                onChange={e => set('city', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Berlin"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
            <select
              value={form.country}
              onChange={e => set('country', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="DE">Deutschland</option>
              <option value="AT">Österreich</option>
              <option value="CH">Schweiz</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              placeholder="Interne Hinweise zum Kunden..."
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
              {saving ? 'Speichern...' : 'Kunden anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
