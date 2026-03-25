"use server"

import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "./server"

export async function signUp(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const companyName = formData.get("company") as string
  const abn = formData.get("abn") as string
  const contactName = formData.get("name") as string
  const phone = formData.get("phone") as string
  const addressStreet = formData.get("address") as string
  const addressCity = formData.get("city") as string
  const addressState = formData.get("state") as string
  const addressPostcode = formData.get("postcode") as string
  const deliveryAddress = formData.get("delivery-address") as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "customer",
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Update the profile with company details
  if (data.user) {
    await supabase
      .from("profiles")
      .update({
        company_name: companyName || null,
        abn: abn || null,
        contact_name: contactName || null,
        phone: phone || null,
        address_street: addressStreet || null,
        address_city: addressCity || null,
        address_state: addressState || null,
        address_postcode: addressPostcode || null,
        delivery_address: deliveryAddress || null,
      })
      .eq("id", data.user.id)
  }

  redirect("/dashboard")
}

export async function signIn(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  const redirectTo = formData.get("redirect") as string
  redirect(redirectTo || "/dashboard")
}

export async function signOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getProfile() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return data
}
