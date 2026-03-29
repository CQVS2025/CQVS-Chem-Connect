export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: "customer" | "admin"
          status: "active" | "suspended"
          company_name: string | null
          abn: string | null
          contact_name: string | null
          phone: string | null
          address_street: string | null
          address_city: string | null
          address_state: string | null
          address_postcode: string | null
          delivery_address: string | null
          company_logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: "customer" | "admin"
          status?: "active" | "suspended"
          company_name?: string | null
          abn?: string | null
          contact_name?: string | null
          phone?: string | null
          address_street?: string | null
          address_city?: string | null
          address_state?: string | null
          address_postcode?: string | null
          delivery_address?: string | null
          company_logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: "customer" | "admin"
          status?: "active" | "suspended"
          company_name?: string | null
          abn?: string | null
          contact_name?: string | null
          phone?: string | null
          address_street?: string | null
          address_city?: string | null
          address_state?: string | null
          address_postcode?: string | null
          delivery_address?: string | null
          company_logo_url?: string | null
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          price: number
          unit: string
          description: string
          manufacturer: string
          category: string
          classification: string
          cas_number: string
          packaging_sizes: string[]
          safety_info: string
          delivery_info: string
          in_stock: boolean
          stock_qty: number
          region: string
          image_url: string | null
          badge: string | null
          shipping_fee: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          price: number
          unit: string
          description: string
          manufacturer: string
          category: string
          classification?: string
          cas_number?: string
          packaging_sizes?: string[]
          safety_info?: string
          delivery_info?: string
          in_stock?: boolean
          stock_qty?: number
          region?: string
          image_url?: string | null
          badge?: string | null
          shipping_fee?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          price?: number
          unit?: string
          description?: string
          manufacturer?: string
          category?: string
          classification?: string
          cas_number?: string
          packaging_sizes?: string[]
          safety_info?: string
          delivery_info?: string
          in_stock?: boolean
          stock_qty?: number
          region?: string
          image_url?: string | null
          badge?: string | null
          shipping_fee?: number
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: "customer" | "admin"
    }
  }
}

// Helper types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]
export type Product = Database["public"]["Tables"]["products"]["Row"]
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"]
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"]
