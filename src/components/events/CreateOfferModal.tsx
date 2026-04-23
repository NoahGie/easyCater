import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface LineItem {
  label: string
  description: string
  quantity: string
  unit: string
  unit_price: string
}

interface Props {
  eventId: string
  nextVersion: number
  onClose: () => void
  onCreated: () => void
}

function emptyLine(): LineItem {
  return { label: '', description: '', quantity: '1', unit: 'Pers.', unit_price: '' }
}

function formatEur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CreateOfferModal({ eventId, nextVersion, onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [validUntil, setValidUntil] = useState('')
  const [taxRate, setTaxRate] = useState('19')
  const [discountEur, setDiscountEur] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([emptyLine()])

  function addLine() {
    setItems(prev => [...prev, emptyLine()])
  }

  function removeLine(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function lineTotal(item: LineItem): number {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price) || 0
    return Math.round(qty * price * 100)
  }

  const subtotalCents = items.reduce((sum, item) => sum + lineTotal(item), 0)
  const discountCents = Math.round((parseFloat(discountEur) || 0) * 100)
  const netCents = Math.max(0, subtotalCents - discountCents)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.label.trim())
    if (validItems.length === 0) {
      setError('Mindestens eine Position ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)

    const { data: offer, error: offerErr } = await supabase
      .from('offers')
      .insert({
        event_id: eventId,
        version: nextVersion,
        status: 'entwurf' as const,
        valid_until: validUntil || null,
        total_net_cents: netCents,
        tax_rate_pct: parseFloat(taxRate) || 19,
        discount_cents: discountCents,
        notes: notes || null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()

    if (offerErr || !offer) {
      setError(offerErr?.message ?? 'Fehler beim Erstellen des Angebots.')
      setSaving(false)
      return
    }

    const offerItems = validItems.map((item, idx) => ({
      offer_id: offer.id,
      position: idx + 1,
      label: item.label.trim(),
      description: item.description || null,
      quantity: parseFloat(item.quantity) || 1,
      unit: item.unit || 'Stk.',
      unit_price_cents: Math.round((parseFloat(item.unit_price) || 0) * 100),
    }))

    const { error: itemsErr } = await supabase.from('offer_items').insert(offerItems)
    setSaving(false)
    if (itemsErr) {
      setError(itemsErr.message)
    } else {
      onCreated()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            Angebot v{nextVersion} erstellen
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis</label>
              <input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MwSt. (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rabatt (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountEur}
                onChange={e => setDiscountEur(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="0,00"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Positionen *</label>
              <button
                type="button"
                onClick={addLine}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                + Position hinzufügen
              </button>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium w-[35%]">Bezeichnung</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium w-[15%]">Menge</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium w-[12%]">Einheit</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium w-[18%]">Preis/Einheit</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500 font-medium w-[15%]">Gesamt</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.label}
                          onChange={e => updateLine(idx, 'label', e.target.value)}
                          className="w-full border-0 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5"
                          placeholder="Position..."
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.quantity}
                          onChange={e => updateLine(idx, 'quantity', e.target.value)}
                          className="w-full border-0 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.unit}
                          onChange={e => updateLine(idx, 'unit', e.target.value)}
                          className="w-full border-0 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={e => updateLine(idx, 'unit_price', e.target.value)}
                          className="w-full border-0 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5"
                          placeholder="0,00"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-sm text-gray-700 font-medium tabular-nums">
                        {formatEur(lineTotal(item))} €
                      </td>
                      <td className="px-1 py-1.5">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="text-gray-300 hover:text-red-500 text-lg leading-none"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Zwischensumme</span>
                <span className="tabular-nums">{formatEur(subtotalCents)} €</span>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Rabatt</span>
                  <span className="tabular-nums text-red-600">− {formatEur(discountCents)} €</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1">
                <span>Netto</span>
                <span className="tabular-nums">{formatEur(netCents)} €</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>zzgl. {taxRate}% MwSt.</span>
                <span className="tabular-nums">
                  {formatEur(Math.round(netCents * (parseFloat(taxRate) || 0) / 100))} €
                </span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1">
                <span>Brutto</span>
                <span className="tabular-nums">
                  {formatEur(Math.round(netCents * (1 + (parseFloat(taxRate) || 0) / 100)))} €
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anmerkungen</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              placeholder="Interne oder externe Anmerkungen..."
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
              {saving ? 'Speichern...' : 'Angebot als Entwurf speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
