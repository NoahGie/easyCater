export type EventStatus =
  | 'anfrage'
  | 'angebot'
  | 'bestaetigt'
  | 'durchfuehrung'
  | 'abrechnung'
  | 'abgeschlossen'
  | 'storniert'

export type OfferStatus =
  | 'entwurf'
  | 'gesendet'
  | 'angenommen'
  | 'abgelehnt'
  | 'abgelaufen'

export type InvoiceStatus =
  | 'entwurf'
  | 'gesendet'
  | 'bezahlt'
  | 'ueberfaellig'
  | 'storniert'

export type CatalogItemType =
  | 'menu'
  | 'getraenke'
  | 'personal'
  | 'equipment'
  | 'logistik'
  | 'sonstiges'

export type StaffRole =
  | 'kueche'
  | 'service'
  | 'logistik'
  | 'management'
  | 'sonstiges'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          avatar_url: string | null
          role: string
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          avatar_url?: string | null
          role?: string
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          avatar_url?: string | null
          role?: string
          phone?: string | null
          updated_at?: string
        }
      }
      catalog_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          sort_order?: number
        }
      }
      catalog_items: {
        Row: {
          id: string
          category_id: string | null
          type: CatalogItemType
          name: string
          description: string | null
          unit: string
          unit_price_cents: number
          tax_rate_pct: number
          is_active: boolean
          image_url: string | null
          metadata: Record<string, unknown> | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          type: CatalogItemType
          name: string
          description?: string | null
          unit?: string
          unit_price_cents?: number
          tax_rate_pct?: number
          is_active?: boolean
          image_url?: string | null
          metadata?: Record<string, unknown> | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          type?: CatalogItemType
          name?: string
          description?: string | null
          unit?: string
          unit_price_cents?: number
          tax_rate_pct?: number
          is_active?: boolean
          image_url?: string | null
          metadata?: Record<string, unknown> | null
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          company_name: string
          industry: string | null
          street: string | null
          city: string | null
          postal_code: string | null
          country: string
          notes: string | null
          preferences: Record<string, unknown> | null
          is_repeat_client: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          industry?: string | null
          street?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          notes?: string | null
          preferences?: Record<string, unknown> | null
          is_repeat_client?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          industry?: string | null
          street?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          notes?: string | null
          preferences?: Record<string, unknown> | null
          is_repeat_client?: boolean
          updated_at?: string
        }
      }
      customer_contacts: {
        Row: {
          id: string
          customer_id: string
          full_name: string
          title: string | null
          email: string | null
          phone: string | null
          is_primary: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          full_name: string
          title?: string | null
          email?: string | null
          phone?: string | null
          is_primary?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          customer_id?: string
          full_name?: string
          title?: string | null
          email?: string | null
          phone?: string | null
          is_primary?: boolean
          notes?: string | null
        }
      }
      events: {
        Row: {
          id: string
          customer_id: string
          primary_contact_id: string | null
          title: string
          status: EventStatus
          event_date: string
          start_time: string | null
          end_time: string | null
          location_name: string | null
          location_address: string | null
          guest_count: number
          budget_cents: number | null
          internal_notes: string | null
          created_by: string | null
          assigned_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          primary_contact_id?: string | null
          title: string
          status?: EventStatus
          event_date: string
          start_time?: string | null
          end_time?: string | null
          location_name?: string | null
          location_address?: string | null
          guest_count?: number
          budget_cents?: number | null
          internal_notes?: string | null
          created_by?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          primary_contact_id?: string | null
          title?: string
          status?: EventStatus
          event_date?: string
          start_time?: string | null
          end_time?: string | null
          location_name?: string | null
          location_address?: string | null
          guest_count?: number
          budget_cents?: number | null
          internal_notes?: string | null
          assigned_to?: string | null
          updated_at?: string
        }
      }
      offers: {
        Row: {
          id: string
          event_id: string
          version: number
          status: OfferStatus
          valid_until: string | null
          total_net_cents: number
          tax_rate_pct: number
          discount_cents: number
          notes: string | null
          sent_at: string | null
          accepted_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          version?: number
          status?: OfferStatus
          valid_until?: string | null
          total_net_cents?: number
          tax_rate_pct?: number
          discount_cents?: number
          notes?: string | null
          sent_at?: string | null
          accepted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: OfferStatus
          valid_until?: string | null
          total_net_cents?: number
          tax_rate_pct?: number
          discount_cents?: number
          notes?: string | null
          sent_at?: string | null
          accepted_at?: string | null
          updated_at?: string
        }
      }
      offer_items: {
        Row: {
          id: string
          offer_id: string
          catalog_item_id: string | null
          position: number
          label: string
          description: string | null
          quantity: number
          unit: string
          unit_price_cents: number
          total_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          offer_id: string
          catalog_item_id?: string | null
          position?: number
          label: string
          description?: string | null
          quantity?: number
          unit?: string
          unit_price_cents?: number
          created_at?: string
        }
        Update: {
          catalog_item_id?: string | null
          position?: number
          label?: string
          description?: string | null
          quantity?: number
          unit?: string
          unit_price_cents?: number
        }
      }
      staff_members: {
        Row: {
          id: string
          profile_id: string | null
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          role: StaffRole
          hourly_rate_cents: number
          skills: string[] | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          first_name: string
          last_name: string
          email?: string | null
          phone?: string | null
          role?: StaffRole
          hourly_rate_cents?: number
          skills?: string[] | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string | null
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          role?: StaffRole
          hourly_rate_cents?: number
          skills?: string[] | null
          notes?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      equipment_items: {
        Row: {
          id: string
          catalog_item_id: string | null
          serial_number: string | null
          name: string
          description: string | null
          quantity_total: number
          daily_rate_cents: number
          condition: string
          storage_location: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          catalog_item_id?: string | null
          serial_number?: string | null
          name: string
          description?: string | null
          quantity_total?: number
          daily_rate_cents?: number
          condition?: string
          storage_location?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string | null
          serial_number?: string | null
          name?: string
          description?: string | null
          quantity_total?: number
          daily_rate_cents?: number
          condition?: string
          storage_location?: string | null
          notes?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      event_staff: {
        Row: {
          id: string
          event_id: string
          staff_member_id: string
          role_override: StaffRole | null
          start_time: string | null
          end_time: string | null
          hours_worked: number | null
          confirmed: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          staff_member_id: string
          role_override?: StaffRole | null
          start_time?: string | null
          end_time?: string | null
          hours_worked?: number | null
          confirmed?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          role_override?: StaffRole | null
          start_time?: string | null
          end_time?: string | null
          hours_worked?: number | null
          confirmed?: boolean
          notes?: string | null
        }
      }
      invoices: {
        Row: {
          id: string
          event_id: string
          offer_id: string | null
          invoice_number: string | null
          status: InvoiceStatus
          issued_date: string
          due_date: string | null
          total_net_cents: number
          tax_rate_pct: number
          total_gross_cents: number
          paid_at: string | null
          payment_method: string | null
          notes: string | null
          pdf_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          offer_id?: string | null
          invoice_number?: string | null
          status?: InvoiceStatus
          issued_date?: string
          due_date?: string | null
          total_net_cents?: number
          tax_rate_pct?: number
          paid_at?: string | null
          payment_method?: string | null
          notes?: string | null
          pdf_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          offer_id?: string | null
          status?: InvoiceStatus
          issued_date?: string
          due_date?: string | null
          total_net_cents?: number
          tax_rate_pct?: number
          paid_at?: string | null
          payment_method?: string | null
          notes?: string | null
          pdf_url?: string | null
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      event_status: EventStatus
      offer_status: OfferStatus
      invoice_status: InvoiceStatus
      catalog_item_type: CatalogItemType
      staff_role: StaffRole
    }
  }
}
