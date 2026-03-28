export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  product_image_url: string | null
  quantity: number
  unit: string
  packaging_size: string
  unit_price: number
  total_price: number
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
  subtotal: number
  shipping: number
  gst: number
  total: number
  delivery_address_street: string | null
  delivery_address_city: string | null
  delivery_address_state: string | null
  delivery_address_postcode: string | null
  stripe_payment_intent_id: string | null
  tracking_number: string | null
  estimated_delivery: string | null
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
