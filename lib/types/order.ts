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
  | "received"
  | "processing"
  | "in_transit"
  | "delivered"
  | "cancelled"

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
