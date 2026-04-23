import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { CatalogItemType } from '../types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; description: string | null; sort_order: number }

type CatalogItem = {
  id: string
  category_id: string | null
  type: CatalogItemType
  name: string
  description: string | null
  unit: string
  unit_price_cents: number
  tax_rate_pct: number
  is_active: boolean
}

type ItemForm = {
  category_id: string
  type: CatalogItemType
  name: string
  description: string
  unit: string
  unit_price: string   // euros
  tax_rate_pct: string
  is_active: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function eur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function emptyForm(): ItemForm {
  return { category_id: '', type: 'menu', name: '', description: '', unit: 'Pers.', unit_price: '', tax_rate_pct: '19', is_active: true }
}

const TYPE_LABELS: Record<CatalogItemType, string> = {
  menu: 'Menü',
  getraenke: 'Getränke',
  personal: 'Personal',
  equipment: 'Equipment',
  logistik: 'Logistik',
  sonstiges: 'Sonstiges',
}

const TYPE_COLORS: Record<CatalogItemType, string> = {
  menu:       'bg-orange-100 text-orange-700',
  getraenke:  'bg-blue-100 text-blue-700',
  personal:   'bg-purple-100 text-purple-700',
  equipment:  'bg-gray-100 text-gray-700',
  logistik:   'bg-yellow-100 text-yellow-800',
  sonstiges:  'bg-gray-100 text-gray-500',
}

// ─── Item form modal ──────────────────────────────────────────────────────────

function ItemModal({
  initial,
  categories,
  onSave,
  onClose,
}: {
  initial: ItemForm & { id?: string }
  categories: Category[]
  onSave: (form: ItemForm, id?: string) => Promise<string | null>
  onClose: () => void
}) {
  const [form, setForm] = useState<ItemForm>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof ItemForm, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name ist erforderlich.'); return }
    setSaving(true)
    setError(null)
    const err = await onSave(form, initial.id)
    setSaving(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial.id ? 'Position bearbeiten' : 'Neue Position'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="z.B. Fingerfood-Buffet Classic"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
              <select
                value={form.category_id}
                onChange={e => set('category_id', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Keine Kategorie</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              placeholder="Optionale Beschreibung…"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
              <input
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Pers., Stk., h…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preis/Einheit (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unit_price}
                onChange={e => set('unit_price', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MwSt. (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.tax_rate_pct}
                onChange={e => set('tax_rate_pct', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 text-red-600 border-gray-300 rounded"
            />
            Aktiv (im Angebotseditor verfügbar)
          </label>

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
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CatalogPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCatId, setActiveCatId] = useState<string | 'all'>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState<(ItemForm & { id?: string }) | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const load = useCallback(async () => {
    const [{ data: cats }, { data: catItems }] = await Promise.all([
      supabase.from('catalog_categories').select('*').order('sort_order'),
      supabase.from('catalog_items').select('*').order('name'),
    ])
    if (cats) setCategories(cats as Category[])
    if (catItems) setItems(catItems as CatalogItem[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveItem(form: ItemForm, id?: string): Promise<string | null> {
    const payload = {
      category_id: form.category_id || null,
      type: form.type,
      name: form.name.trim(),
      description: form.description || null,
      unit: form.unit || 'Stk.',
      unit_price_cents: Math.round((parseFloat(form.unit_price) || 0) * 100),
      tax_rate_pct: parseFloat(form.tax_rate_pct) || 19,
      is_active: form.is_active,
    }

    if (id) {
      const { error } = await supabase.from('catalog_items').update(payload).eq('id', id)
      if (error) return error.message
    } else {
      const { error } = await supabase.from('catalog_items').insert({ ...payload, created_by: user?.id ?? null })
      if (error) return error.message
    }
    await load()
    return null
  }

  async function deleteItem(id: string) {
    if (!window.confirm('Position wirklich löschen? Angebote mit dieser Position bleiben erhalten.')) return
    setDeletingId(id)
    await supabase.from('catalog_items').delete().eq('id', id)
    setDeletingId(null)
    await load()
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    setAddingCat(true)
    await supabase.from('catalog_categories').insert({
      name: newCatName.trim(),
      sort_order: categories.length + 1,
    })
    setNewCatName('')
    setAddingCat(false)
    await load()
  }

  async function toggleActive(item: CatalogItem) {
    await supabase.from('catalog_items').update({ is_active: !item.is_active }).eq('id', item.id)
    await load()
  }

  const filtered = items.filter(item => {
    if (!showInactive && !item.is_active) return false
    if (activeCatId !== 'all' && item.category_id !== activeCatId) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return item.name.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q)
    }
    return true
  })

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Lädt Katalog…</div>

  return (
    <div className="flex gap-4 h-full">

      {/* Left sidebar: categories */}
      <div className="w-52 shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Kategorien</h2>
        <nav className="space-y-0.5 mb-4">
          <button
            onClick={() => setActiveCatId('all')}
            className={`w-full text-left px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              activeCatId === 'all' ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Alle
            <span className="ml-1 text-xs text-gray-400">({items.length})</span>
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCatId(cat.id)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md font-medium transition-colors ${
                activeCatId === cat.id ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.name}
              <span className="ml-1 text-xs text-gray-400">
                ({items.filter(i => i.category_id === cat.id).length})
              </span>
            </button>
          ))}
        </nav>

        {/* Add category */}
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2 px-1">Neue Kategorie</p>
          <div className="flex gap-1">
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Name…"
            />
            <button
              onClick={addCategory}
              disabled={addingCat || !newCatName.trim()}
              className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Katalog</h1>
          <button
            onClick={() => setEditItem({ ...emptyForm() })}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
          >
            + Neue Position
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Suchen…"
          />
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="w-3.5 h-3.5 rounded"
            />
            Inaktive anzeigen
          </label>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const count = items.filter(i => i.type === type && i.is_active).length
            return (
              <div key={type} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-xl font-bold text-gray-900 mt-0.5">{count}</div>
              </div>
            )
          })}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg py-16 text-center">
            <p className="text-gray-400 text-sm">
              {items.length === 0 ? 'Noch keine Positionen. Erstelle die erste.' : 'Keine Einträge gefunden.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Einheit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preis</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">MwSt.</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aktiv</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${!item.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[item.type]}`}>
                        {TYPE_LABELS[item.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                      {eur(item.unit_price_cents)} €
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums">
                      {item.tax_rate_pct}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(item)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          item.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {item.is_active ? '✓ Aktiv' : 'Inaktiv'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditItem({
                            id: item.id,
                            category_id: item.category_id ?? '',
                            type: item.type,
                            name: item.name,
                            description: item.description ?? '',
                            unit: item.unit,
                            unit_price: String(item.unit_price_cents / 100),
                            tax_rate_pct: String(item.tax_rate_pct),
                            is_active: item.is_active,
                          })}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          disabled={deletingId === item.id}
                          className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editItem && (
        <ItemModal
          initial={editItem}
          categories={categories}
          onSave={saveItem}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  )
}
