import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CreateCustomerModal } from '../components/customers/CreateCustomerModal'

type CustomerRow = {
  id: string
  company_name: string
  industry: string | null
  city: string | null
  postal_code: string | null
  country: string
  is_repeat_client: boolean
  created_at: string
  contact_count: number
  event_count: number
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [repeatOnly, setRepeatOnly] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const loadCustomers = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('customers')
      .select(`
        id, company_name, industry, city, postal_code, country,
        is_repeat_client, created_at,
        customer_contacts(id),
        events(id)
      `)
      .order('company_name')

    if (repeatOnly) query = query.eq('is_repeat_client', true)
    if (search.trim()) query = query.ilike('company_name', `%${search.trim()}%`)

    const { data } = await query

    const rows: CustomerRow[] = (data ?? []).map((c: any) => ({
      id: c.id,
      company_name: c.company_name,
      industry: c.industry,
      city: c.city,
      postal_code: c.postal_code,
      country: c.country,
      is_repeat_client: c.is_repeat_client,
      created_at: c.created_at,
      contact_count: c.customer_contacts?.length ?? 0,
      event_count: c.events?.length ?? 0,
    }))

    setCustomers(rows)
    setLoading(false)
  }, [search, repeatOnly])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kunden</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
        >
          + Neuer Kunde
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Nach Firma suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={() => setRepeatOnly(v => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            repeatOnly
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Nur Stammkunden
        </button>
        <span className="text-sm text-gray-400 ml-auto">
          {loading ? '' : `${customers.length} Kunde${customers.length !== 1 ? 'n' : ''}`}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Laden...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm mb-3">Keine Kunden gefunden</p>
          {!search && !repeatOnly && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Ersten Kunden anlegen →
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Firma</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Branche</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ort</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Kontakte</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Aufträge</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Typ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/customers/${c.id}`}
                      className="font-medium text-gray-900 hover:text-red-600 transition-colors"
                    >
                      {c.company_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.industry ?? '–'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.city ? `${c.postal_code ? c.postal_code + ' ' : ''}${c.city}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.contact_count}</td>
                  <td className="px-4 py-3 text-gray-500">{c.event_count}</td>
                  <td className="px-4 py-3">
                    {c.is_repeat_client ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Stammkunde
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Neukunde</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateCustomerModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadCustomers() }}
        />
      )}
    </div>
  )
}
