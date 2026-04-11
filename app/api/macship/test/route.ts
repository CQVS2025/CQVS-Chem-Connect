import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/macship/test - check MacShip configuration (admin only)
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const hasTestToken = Boolean(process.env.MACSHIP_TEST_API_TOKEN)
  const hasProductionToken = Boolean(process.env.MACSHIP_PRODUCTION_API_TOKEN)
  const mode = (process.env.MACSHIP_MODE?.toLowerCase() === "production" ? "production" : "test") as
    | "test"
    | "production"

  const configured =
    mode === "production" ? hasProductionToken : hasTestToken

  return NextResponse.json({
    configured,
    mode,
    hasTestToken,
    hasProductionToken,
  })
}
