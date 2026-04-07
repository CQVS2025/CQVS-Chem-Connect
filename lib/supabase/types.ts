export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProductPriceType = "per_litre" | "fixed"

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
          invoice_email: string | null
          xero_contact_id: string | null
          accepted_payment_terms_at: string | null
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
          invoice_email?: string | null
          xero_contact_id?: string | null
          accepted_payment_terms_at?: string | null
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
          invoice_email?: string | null
          xero_contact_id?: string | null
          accepted_payment_terms_at?: string | null
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
          price_type: ProductPriceType
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
          price_type?: ProductPriceType
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
          price_type?: ProductPriceType
          updated_at?: string
        }
      }
      packaging_sizes: {
        Row: {
          id: string
          name: string
          volume_litres: number | null
          container_type: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          volume_litres?: number | null
          container_type?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          volume_litres?: number | null
          container_type?: string
          sort_order?: number
          is_active?: boolean
          updated_at?: string
        }
      }
      product_packaging_prices: {
        Row: {
          id: string
          product_id: string
          packaging_size_id: string
          price_per_litre: number | null
          fixed_price: number | null
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          packaging_size_id: string
          price_per_litre?: number | null
          fixed_price?: number | null
          is_available?: boolean
        }
        Update: {
          price_per_litre?: number | null
          fixed_price?: number | null
          is_available?: boolean
        }
      }
      warehouses: {
        Row: {
          id: string
          name: string
          address_street: string
          address_city: string
          address_state: string
          address_postcode: string
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          xero_contact_id: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address_street: string
          address_city: string
          address_state: string
          address_postcode: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          xero_contact_id?: string | null
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          name?: string
          address_street?: string
          address_city?: string
          address_state?: string
          address_postcode?: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          xero_contact_id?: string | null
          is_active?: boolean
          sort_order?: number
        }
      }
      container_costs: {
        Row: {
          id: string
          warehouse_id: string
          packaging_size_id: string
          cost: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          warehouse_id: string
          packaging_size_id: string
          cost?: number
        }
        Update: {
          cost?: number
        }
      }
      warehouse_product_pricing: {
        Row: {
          id: string
          warehouse_id: string
          product_id: string
          packaging_size_id: string
          cost_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          warehouse_id: string
          product_id: string
          packaging_size_id: string
          cost_price?: number
        }
        Update: {
          cost_price?: number
        }
      }
      product_warehouses: {
        Row: {
          id: string
          product_id: string
          warehouse_id: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          warehouse_id: string
        }
        Update: never
      }
      xero_credentials: {
        Row: {
          id: string
          tenant_id: string
          tenant_name: string | null
          access_token: string
          refresh_token: string
          expires_at: string
          scope: string | null
          connected_by: string | null
          connected_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          tenant_name?: string | null
          access_token: string
          refresh_token: string
          expires_at: string
          scope?: string | null
          connected_by?: string | null
        }
        Update: {
          tenant_id?: string
          tenant_name?: string | null
          access_token?: string
          refresh_token?: string
          expires_at?: string
          scope?: string | null
        }
      }
      xero_sync_log: {
        Row: {
          id: string
          entity_type: string
          entity_id: string | null
          action: string
          status: string
          xero_id: string | null
          error_message: string | null
          request_payload: Json | null
          response_payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id?: string | null
          action: string
          status: string
          xero_id?: string | null
          error_message?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
        }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: "customer" | "admin"
      product_price_type: ProductPriceType
    }
  }
}

// Helper types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]
export type Product = Database["public"]["Tables"]["products"]["Row"]
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"]
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"]
export type PackagingSize = Database["public"]["Tables"]["packaging_sizes"]["Row"]
export type ProductPackagingPrice = Database["public"]["Tables"]["product_packaging_prices"]["Row"]
export type Warehouse = Database["public"]["Tables"]["warehouses"]["Row"]
export type ContainerCost = Database["public"]["Tables"]["container_costs"]["Row"]
export type WarehouseProductPricing = Database["public"]["Tables"]["warehouse_product_pricing"]["Row"]
export type XeroCredentials = Database["public"]["Tables"]["xero_credentials"]["Row"]

// Composite types used in cart/checkout
export interface ProductWithPricing extends Product {
  packaging_prices?: (ProductPackagingPrice & {
    packaging_size: PackagingSize
  })[]
}
