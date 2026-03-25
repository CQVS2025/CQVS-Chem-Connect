export interface Order {
  id: string
  orderNumber: string
  date: string
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  items: { name: string; qty: number; price: number; unit: string }[]
  total: number
  trackingNumber?: string
}

export const orders: Order[] = [
  {
    id: "1",
    orderNumber: "ORD-2026-001",
    date: "2026-03-20",
    status: "delivered",
    items: [
      { name: "Green Acid Replacement", qty: 4, price: 2.45, unit: "1000L IBC" },
      { name: "Eco Wash", qty: 2, price: 1.8, unit: "200L Drum" },
    ],
    total: 10160,
    trackingNumber: "TRK-AU-9283741",
  },
  {
    id: "2",
    orderNumber: "ORD-2026-002",
    date: "2026-03-18",
    status: "shipped",
    items: [
      { name: "AdBlue (DEF)", qty: 6, price: 1.15, unit: "1000L IBC" },
    ],
    total: 6900,
    trackingNumber: "TRK-AU-8372615",
  },
  {
    id: "3",
    orderNumber: "ORD-2026-003",
    date: "2026-03-15",
    status: "processing",
    items: [
      { name: "Truck Wash Premium", qty: 3, price: 1.95, unit: "200L Drum" },
      { name: "Truck Wash Standard", qty: 5, price: 1.5, unit: "200L Drum" },
    ],
    total: 2670,
  },
  {
    id: "4",
    orderNumber: "ORD-2026-004",
    date: "2026-03-10",
    status: "delivered",
    items: [
      { name: "Agi Acid", qty: 2, price: 2.06, unit: "200L Drum" },
      { name: "Agi Gel", qty: 2, price: 2.21, unit: "200L Drum" },
    ],
    total: 1708,
    trackingNumber: "TRK-AU-7261534",
  },
  {
    id: "5",
    orderNumber: "ORD-2026-005",
    date: "2026-03-05",
    status: "delivered",
    items: [
      { name: "Green Acid Replacement", qty: 8, price: 2.45, unit: "1000L IBC" },
    ],
    total: 19600,
    trackingNumber: "TRK-AU-6150423",
  },
  {
    id: "6",
    orderNumber: "ORD-2026-006",
    date: "2026-02-28",
    status: "cancelled",
    items: [
      { name: "Sodium Hydroxide (NaOH) - 50kg", qty: 10, price: 85.0, unit: "50kg Bag" },
    ],
    total: 850,
  },
]

export const statusColors: Record<Order["status"], string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  delivered: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
}
