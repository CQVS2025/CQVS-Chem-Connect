/**
 * Create an admin user for Chem Connect
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <password>
 *
 * Example:
 *   npx tsx scripts/create-admin.ts admin@chemconnect.com MySecurePass123
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars. Make sure .env.local has:")
  console.error("  NEXT_PUBLIC_SUPABASE_URL")
  console.error("  SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error("Usage: npx tsx scripts/create-admin.ts <email> <password>")
  process.exit(1)
}

if (password.length < 6) {
  console.error("Password must be at least 6 characters")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`Creating admin user: ${email}`)

  // 1. Create auth user (service role bypasses email confirmation)
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    })

  if (authError) {
    console.error("Failed to create auth user:", authError.message)
    process.exit(1)
  }

  console.log(`Auth user created: ${authData.user.id}`)

  // 2. Update the profile to admin role
  // (the trigger already created the profile row, we just need to set role)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: "admin",
      contact_name: "Admin",
    })
    .eq("id", authData.user.id)

  if (profileError) {
    console.error("Failed to update profile:", profileError.message)
    console.error("The auth user was created but profile update failed.")
    console.error("Run this SQL in Supabase SQL Editor to fix:")
    console.error(
      `  UPDATE profiles SET role = 'admin' WHERE id = '${authData.user.id}';`,
    )
    process.exit(1)
  }

  console.log("")
  console.log("Admin user created successfully!")
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log(`  User ID:  ${authData.user.id}`)
  console.log(`  Role:     admin`)
  console.log("")
  console.log("You can now sign in at /login")
}

main()
