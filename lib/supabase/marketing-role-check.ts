/**
 * Role guard for marketing API routes.
 *
 * `admin` -> full access (including delete + settings)
 * `marketing_admin` -> full access
 * `marketing_editor` -> create/edit, no delete + no settings edit
 *
 * Usage:
 *   const { error } = await requireMarketingRole(["view"])
 *   if (error) return error
 *
 * Currently only admin is enforced in practice (no team members have
 * marketing_* roles yet) but the helper is in place so adding them later
 * is one setRoleOnProfile call, not a codebase sweep.
 */

import { NextResponse } from "next/server"

import { createServerSupabaseClient } from "./server"

type MarketingPermission =
  | "view"           // read contacts / campaigns / settings
  | "edit"           // create/update contacts and campaigns
  | "delete"         // delete campaigns, contacts
  | "settings"       // edit sender identity / DNS / connection

const ROLES_FOR: Record<MarketingPermission, string[]> = {
  view: ["admin", "marketing_admin", "marketing_editor"],
  edit: ["admin", "marketing_admin", "marketing_editor"],
  delete: ["admin", "marketing_admin"],
  settings: ["admin", "marketing_admin"],
}

export async function requireMarketingRole(
  required: MarketingPermission = "view",
) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized", detail: authError?.message ?? "No session" },
        { status: 401 },
      ),
      supabase,
      user: null,
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = (profile as { role?: string } | null)?.role ?? ""
  const allowed = ROLES_FOR[required]

  if (!allowed.includes(role)) {
    return {
      error: NextResponse.json(
        {
          error: "Forbidden",
          detail: `Role "${role || "unknown"}" does not have "${required}" permission. Required one of: ${allowed.join(", ")}`,
        },
        { status: 403 },
      ),
      supabase,
      user,
    }
  }

  return { error: null, supabase, user, role }
}
