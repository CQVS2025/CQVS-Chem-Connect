export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  product_image_url: string | null
  quantity: number
  unit: string
  packaging_size: string
  packaging_size_id: string | null
  price_type: "per_litre" | "fixed" | null
  unit_price: number
  total_price: number
  shipping_fee: number
  container_cost: number
}

export interface OrderStatusHistory {
  id: string
  status: string
  note: string | null
  created_at: string
}

export type OrderStatus =
  | "pending_approval"
  | "received"
  | "processing"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "rejected"

export type PaymentMethod = "stripe" | "purchase_order"

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded"

export interface Order {
  id: string
  order_number: string
  user_id: string
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  po_number: string | null
  invoice_email: string | null
  forklift_available: boolean | null
  warehouse_id: string | null
  subtotal: number
  shipping: number
  gst: number
  processing_fee: number
  container_total: number
  total: number
  bundle_discount: number
  first_order_discount: number
  first_order_type: string | null
  promo_discount: number
  promo_names: string | null
  delivery_address_street: string | null
  delivery_address_city: string | null
  delivery_address_state: string | null
  delivery_address_postcode: string | null
  stripe_payment_intent_id: string | null
  tracking_number: string | null
  estimated_delivery: string | null
  xero_invoice_id: string | null
  xero_invoice_number: string | null
  xero_invoice_status: string | null
  xero_synced_at: string | null
  xero_po_id: string | null
  xero_po_number: string | null
  macship_consignment_id: string | null
  macship_carrier_id: string | null
  macship_tracking_url: string | null
  macship_pickup_date: string | null
  macship_manifest_id: string | null
  macship_dispatched_at: string | null
  macship_quote_amount: number | null
  macship_consignment_failed: boolean | null
  macship_lead_time_fallback: boolean | null
  macship_shipping_breakdown: {
    base_rate: number
    fuel_levy: number
    fuel_levy_percent: number
    tax: number
    tax_percent: number
    before_tax: number
    tailgate_applied: boolean
    tailgate_amount: number
    tailgate_name: string | null
    other_surcharges: Array<{ name: string; amount: number }>
    total: number
  } | null
  macship_service_name: string | null
  macship_eta_date: string | null
  macship_eta_business_days: number | null
  // Supplier-managed fulfillment (Feature B)
  supplier_dispatch_date: string | null
  supplier_dispatch_notes: string | null
  supplier_tracking_url: string | null
  supplier_freight_cost: number | null
  supplier_variance_flagged: boolean | null
  supplier_variance_amount: number | null
  supplier_sla_breached: boolean | null
  site_access_answers: Record<string, unknown> | null
  created_at: string
  updated_at: string
  items: OrderItem[]
  status_history?: OrderStatusHistory[]
  client_secret?: string | null
  profile?: {
    contact_name: string | null
    email: string
    company_name: string | null
  }
}
