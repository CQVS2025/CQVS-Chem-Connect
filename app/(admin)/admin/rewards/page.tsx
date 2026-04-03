"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Crown,
  Award,
  Medal,
  Megaphone,
  Gift,
  Calendar,
  Loader2,
  Save,
  Users,
  TrendingUp,
  Plus,
  Pencil,
  Package,
  Stamp,
  Mail,
  DollarSign,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, put, post } from "@/lib/api/client"

import { PageTransition } from "@/components/shared/page-transition"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useFeatureFlags } from "@/lib/hooks/use-feature-flags"

// --- Types ---
interface RewardTier { id: string; name: string; display_name: string; min_monthly_spend: number; reward_description: string; estimated_monthly_savings: number; sort_order: number; is_active: boolean }
interface Referral { id: string; referrer_name: string; referred_site_name: string; referred_contact_name: string; referred_email: string | null; referred_phone: string; status: string; reward_given: boolean; created_at: string; referred_order_count?: number }
interface Promotion { id: string; name: string; headline: string | null; description: string | null; type: string; season: string | null; discount_type: string; discount_value: number; promotion_type_detail: string | null; buy_quantity: number; min_order_value: number; eligible_product_ids: string[] | null; display_style: string | null; fine_print: string | null; start_date: string | null; end_date: string | null; is_active: boolean }
interface BundleProduct { id: string; product_id: string; product: { id: string; name: string; slug: string; price: number; unit: string } | null }
interface Bundle { id: string; name: string; description: string | null; discount_percent: number; min_products: number; badge_text: string | null; is_active: boolean; bundle_products?: BundleProduct[] }
interface Product { id: string; name: string; slug: string; price: number; unit: string }
interface RebateTier { id: string; min_annual_spend: number; max_annual_spend: number | null; rebate_percent: number; sort_order: number; is_active: boolean }
interface StampRecord { id: string; user_id: string; order_id: string | null; stamps_earned: number; notes: string | null; created_at: string; contact_name: string | null; company_name: string | null; email: string | null }
interface EarlyAccessSignup { id: string; email: string; product_slug: string | null; created_at: string }
interface CustomerRewardSummary { user_id: string; contact_name: string; company_name: string; current_tier: string; current_month_spend: number; annual_spend: number; total_stamps: number; referral_count: number }

const tierIcons: Record<string, typeof Crown> = { bronze: Medal, silver: Award, gold: Crown }
const tierColors: Record<string, string> = { bronze: "text-amber-600", silver: "text-slate-300", gold: "text-yellow-400", none: "text-muted-foreground" }
const statusColors: Record<string, string> = { pending: "bg-amber-500/15 text-amber-500", contacted: "bg-sky-500/15 text-sky-500", converted: "bg-emerald-500/15 text-emerald-500", rejected: "bg-red-500/15 text-red-500" }

export default function AdminRewardsPage() {
  const qc = useQueryClient()
  const { data: flags } = useFeatureFlags()
  const earlyAccessLimit = flags?.early_access_limit ?? 20

  // --- Data Fetching ---
  const { data: tiers, isLoading: tiersLoading } = useQuery<RewardTier[]>({ queryKey: ["admin-reward-tiers"], queryFn: () => get("/rewards/tiers") })
  const { data: referrals, isLoading: referralsLoading } = useQuery<Referral[]>({ queryKey: ["admin-referrals"], queryFn: () => get("/admin/rewards/referrals") })
  const { data: promotions, isLoading: promosLoading } = useQuery<Promotion[]>({ queryKey: ["admin-promotions"], queryFn: () => get("/admin/rewards/promotions") })
  const { data: bundles, isLoading: bundlesLoading } = useQuery<Bundle[]>({ queryKey: ["admin-bundles"], queryFn: () => get("/admin/rewards/bundles") })
  const { data: rebateTiers, isLoading: rebatesLoading } = useQuery<RebateTier[]>({ queryKey: ["admin-rebates"], queryFn: () => get("/admin/rewards/rebates") })
  const { data: stamps, isLoading: stampsLoading } = useQuery<StampRecord[]>({ queryKey: ["admin-stamps"], queryFn: () => get("/admin/rewards/stamps") })
  const { data: earlyAccess, isLoading: eaLoading } = useQuery<EarlyAccessSignup[]>({ queryKey: ["admin-early-access"], queryFn: () => get("/admin/rewards/early-access") })
  const { data: customerRewards, isLoading: customersLoading } = useQuery<CustomerRewardSummary[]>({ queryKey: ["admin-customer-rewards"], queryFn: () => get("/admin/rewards/customers") })
  const { data: allProducts } = useQuery<Product[]>({ queryKey: ["admin-products-list"], queryFn: () => get("/products") })

  // --- Tier State ---
  const [editingTier, setEditingTier] = useState<RewardTier | null>(null)
  const [tierForm, setTierForm] = useState({ min_monthly_spend: "", reward_description: "", estimated_monthly_savings: "" })
  useEffect(() => { if (editingTier) setTierForm({ min_monthly_spend: String(editingTier.min_monthly_spend), reward_description: editingTier.reward_description, estimated_monthly_savings: String(editingTier.estimated_monthly_savings) }) }, [editingTier])
  const updateTier = useMutation({ mutationFn: (d: Record<string, unknown>) => put("/rewards/tiers", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reward-tiers"] }); toast.success("Tier updated"); setEditingTier(null) }, onError: () => toast.error("Failed to update tier") })

  // --- Referral ---
  const updateReferral = useMutation({ mutationFn: (d: { id: string; status: string; reward_given?: boolean }) => put("/admin/rewards/referrals", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-referrals"] }); toast.success("Referral updated") }, onError: () => toast.error("Failed to update") })

  // --- Promotion State ---
  const [promoDialog, setPromoDialog] = useState<"create" | "edit" | null>(null)
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)
  const [promoProductIds, setPromoProductIds] = useState<string[]>([])
  const [pf, setPf] = useState({
    name: "", headline: "", description: "", type: "seasonal", season: "",
    discount_type: "percentage", discount_value: "", promotion_type_detail: "",
    buy_quantity: "3", min_order_value: "", display_style: "card", fine_print: "",
    start_date: "", end_date: "",
  })
  function openCreatePromo() {
    setPf({ name: "", headline: "", description: "", type: "seasonal", season: "", discount_type: "percentage", discount_value: "", promotion_type_detail: "", buy_quantity: "3", min_order_value: "", display_style: "card", fine_print: "", start_date: "", end_date: "" })
    setPromoProductIds([])
    setEditingPromo(null)
    setPromoDialog("create")
  }
  function openEditPromo(p: Promotion) {
    setEditingPromo(p)
    setPf({
      name: p.name, headline: p.headline || "", description: p.description || "",
      type: p.type, season: p.season || "", discount_type: p.discount_type,
      discount_value: String(p.discount_value || ""), promotion_type_detail: p.promotion_type_detail || "",
      buy_quantity: String(p.buy_quantity || 3), min_order_value: String(p.min_order_value || ""), display_style: p.display_style || "card",
      fine_print: p.fine_print || "", start_date: p.start_date || "", end_date: p.end_date || "",
    })
    setPromoProductIds(p.eligible_product_ids ?? [])
    setPromoDialog("edit")
  }
  const savePromo = useMutation({ mutationFn: (d: Record<string, unknown>) => d.id ? put("/admin/rewards/promotions", d) : post("/admin/rewards/promotions", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promotions"] }); toast.success(promoDialog === "create" ? "Promotion created" : "Promotion updated"); setPromoDialog(null) }, onError: () => toast.error("Failed to save promotion") })
  const togglePromo = useMutation({ mutationFn: (d: { id: string; is_active: boolean }) => put("/admin/rewards/promotions", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promotions"] }); toast.success("Status updated") } })
  function handleSavePromo() {
    const payload: Record<string, unknown> = {
      name: pf.name, headline: pf.headline || null, description: pf.description || null,
      type: pf.type, season: pf.season || null, discount_type: pf.discount_type,
      discount_value: parseFloat(pf.discount_value) || 0, promotion_type_detail: pf.promotion_type_detail || null,
      buy_quantity: parseInt(pf.buy_quantity) || 0, min_order_value: parseFloat(pf.min_order_value) || 0,
      eligible_product_ids: promoProductIds.length > 0 ? promoProductIds : [],
      display_style: pf.display_style || "card", fine_print: pf.fine_print || null,
      start_date: pf.start_date || null, end_date: pf.end_date || null,
    }
    if (promoDialog === "edit" && editingPromo) payload.id = editingPromo.id
    savePromo.mutate(payload)
  }

  // --- Bundle State ---
  const [bundleDialog, setBundleDialog] = useState<"create" | "edit" | null>(null)
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null)
  const [bf, setBf] = useState({ name: "", description: "", discount_percent: "", min_products: "3", badge_text: "" })
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  function openCreateBundle() { setBf({ name: "", description: "", discount_percent: "", min_products: "3", badge_text: "" }); setSelectedProductIds([]); setEditingBundle(null); setBundleDialog("create") }
  function openEditBundle(b: Bundle) { setEditingBundle(b); setBf({ name: b.name, description: b.description || "", discount_percent: String(b.discount_percent), min_products: String(b.min_products), badge_text: b.badge_text || "" }); setSelectedProductIds(b.bundle_products?.map(bp => bp.product_id) ?? []); setBundleDialog("edit") }
  const saveBundle = useMutation({ mutationFn: (d: Record<string, unknown>) => d.id ? put("/admin/rewards/bundles", d) : post("/admin/rewards/bundles", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bundles"] }); toast.success(bundleDialog === "create" ? "Bundle created" : "Bundle updated"); setBundleDialog(null) }, onError: () => toast.error("Failed to save bundle") })
  const toggleBundle = useMutation({ mutationFn: (d: { id: string; is_active: boolean }) => put("/admin/rewards/bundles", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bundles"] }); toast.success("Status updated") } })
  function handleSaveBundle() { const payload: Record<string, unknown> = { name: bf.name, description: bf.description || null, discount_percent: parseFloat(bf.discount_percent) || 10, min_products: parseInt(bf.min_products) || 3, badge_text: bf.badge_text || `${bf.discount_percent}% OFF`, product_ids: selectedProductIds }; if (bundleDialog === "edit" && editingBundle) payload.id = editingBundle.id; saveBundle.mutate(payload) }

  // --- Rebate State ---
  const [rebateDialog, setRebateDialog] = useState<"create" | "edit" | null>(null)
  const [editingRebate, setEditingRebate] = useState<RebateTier | null>(null)
  const [rf, setRf] = useState({ min_annual_spend: "", max_annual_spend: "", rebate_percent: "" })
  function openCreateRebate() { setRf({ min_annual_spend: "", max_annual_spend: "", rebate_percent: "" }); setEditingRebate(null); setRebateDialog("create") }
  function openEditRebate(r: RebateTier) { setEditingRebate(r); setRf({ min_annual_spend: String(r.min_annual_spend), max_annual_spend: r.max_annual_spend ? String(r.max_annual_spend) : "", rebate_percent: String(r.rebate_percent) }); setRebateDialog("edit") }
  const saveRebate = useMutation({ mutationFn: (d: Record<string, unknown>) => d.id ? put("/admin/rewards/rebates", d) : post("/admin/rewards/rebates", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-rebates"] }); toast.success(rebateDialog === "create" ? "Rebate tier created" : "Rebate tier updated"); setRebateDialog(null) }, onError: () => toast.error("Failed to save rebate tier") })

  // --- Stamp State ---
  const [stampDialog, setStampDialog] = useState(false)
  const [sf, setSf] = useState({ user_id: "", stamps_earned: "1", notes: "" })
  const addStamp = useMutation({ mutationFn: (d: Record<string, unknown>) => post("/admin/rewards/stamps", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-stamps"] }); toast.success("Stamp added"); setStampDialog(false); setSf({ user_id: "", stamps_earned: "1", notes: "" }) }, onError: () => toast.error("Failed to add stamp") })
  const [editingStamp, setEditingStamp] = useState<StampRecord | null>(null)
  const [esf, setEsf] = useState({ stamps_earned: "1", notes: "" })
  function openEditStamp(s: StampRecord) { setEditingStamp(s); setEsf({ stamps_earned: String(s.stamps_earned), notes: (s.notes || "").replace(/\[orders:[^\]]*\]/, "").trim() }) }
  const updateStamp = useMutation({ mutationFn: (d: Record<string, unknown>) => put("/admin/rewards/stamps", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-stamps"] }); toast.success("Stamp updated"); setEditingStamp(null) }, onError: () => toast.error("Failed to update stamp") })
  const deleteStamp = useMutation({ mutationFn: (id: string) => fetch(`/api/admin/rewards/stamps?id=${id}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-stamps"] }); toast.success("Stamp removed") }, onError: () => toast.error("Failed to remove stamp") })

  // --- Early Access Notify ---
  const [notifyDialog, setNotifyDialog] = useState(false)
  const [notifyProductId, setNotifyProductId] = useState("")
  const notifyMutation = useMutation({
    mutationFn: (data: { product_id: string; product_name: string; product_slug: string }) =>
      post("/admin/rewards/early-access/notify", data),
    onSuccess: (data: unknown) => {
      const result = data as { sent: number; total: number; message: string }
      toast.success(result.message || "Notifications sent!")
      setNotifyDialog(false)
      setNotifyProductId("")
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to send notifications"
      toast.error(message)
    },
  })

  // --- Stats ---
  const totalCustomersWithTier = customerRewards?.filter((c) => c.current_tier !== "none").length ?? 0
  const activePromotions = promotions?.filter((p) => p.is_active).length ?? 0

  if (tiersLoading) return <PageTransition><div className="space-y-6"><Skeleton className="h-10 w-48" /><div className="grid gap-4 sm:grid-cols-4">{[1,2,3,4].map(i=><Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div></PageTransition>

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rewards Management</h1>
          <p className="text-muted-foreground">Configure all loyalty programs, tiers, promotions, bundles, rebates, and stamps.</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10"><Users className="size-5 text-primary" /></div><div><p className="text-2xl font-bold">{totalCustomersWithTier}</p><p className="text-xs text-muted-foreground">Customers with tier</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-sky-400/10"><Megaphone className="size-5 text-sky-400" /></div><div><p className="text-2xl font-bold">{referrals?.filter(r=>r.status==="converted").length??0}/{referrals?.length??0}</p><p className="text-xs text-muted-foreground">Referrals converted</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-violet-400/10"><Calendar className="size-5 text-violet-400" /></div><div><p className="text-2xl font-bold">{activePromotions}</p><p className="text-xs text-muted-foreground">Active promotions</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-amber-400/10"><Stamp className="size-5 text-amber-400" /></div><div><p className="text-2xl font-bold">{stamps?.reduce((s,r)=>s+r.stamps_earned,0)??0}</p><p className="text-xs text-muted-foreground">Total stamps issued</p></div></div></CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tiers">
          <div className="overflow-x-auto scrollbar-none">
            <TabsList className="h-auto flex-wrap gap-1.5 bg-transparent p-0">
              <TabsTrigger value="tiers" className="h-9 px-4 text-sm"><Gift className="mr-1.5 size-4" />Tiers</TabsTrigger>
              <TabsTrigger value="referrals" className="h-9 px-4 text-sm"><Megaphone className="mr-1.5 size-4" />Referrals</TabsTrigger>
              <TabsTrigger value="promotions" className="h-9 px-4 text-sm"><Calendar className="mr-1.5 size-4" />Promotions</TabsTrigger>
              <TabsTrigger value="bundles" className="h-9 px-4 text-sm"><Package className="mr-1.5 size-4" />Bundles</TabsTrigger>
              <TabsTrigger value="rebates" className="h-9 px-4 text-sm"><DollarSign className="mr-1.5 size-4" />Rebates</TabsTrigger>
              <TabsTrigger value="stamps" className="h-9 px-4 text-sm"><Stamp className="mr-1.5 size-4" />Stamps</TabsTrigger>
              <TabsTrigger value="early-access" className="h-9 px-4 text-sm"><Mail className="mr-1.5 size-4" />Early Access</TabsTrigger>
              <TabsTrigger value="customers" className="h-9 px-4 text-sm"><Users className="mr-1.5 size-4" />Customers</TabsTrigger>
            </TabsList>
          </div>

          {/* ===== TIERS ===== */}
          <TabsContent value="tiers" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {tiers?.map(tier => { const Icon = tierIcons[tier.name] || Gift; return (
                <Card key={tier.id} className="border-white/5 bg-card/50 backdrop-blur-sm"><CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Icon className={cn("size-5", tierColors[tier.name])} /><h3 className="font-bold">{tier.display_name}</h3></div>
                    <Button variant="ghost" size="xs" onClick={() => setEditingTier(tier)}><Pencil className="mr-1 size-3" />Edit</Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Min. spend</span><span className="font-semibold">${tier.min_monthly_spend.toLocaleString()}/mo</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Est. savings</span><span className="font-semibold text-primary">~${tier.estimated_monthly_savings.toLocaleString()}/mo</span></div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{tier.reward_description}</p>
                </CardContent></Card>
              )})}
            </div>
          </TabsContent>

          {/* ===== REFERRALS ===== */}
          <TabsContent value="referrals" className="mt-4">
            <Card><CardHeader><CardTitle>Referral Submissions</CardTitle><CardDescription>Manage referral submissions from customers.</CardDescription></CardHeader>
              <CardContent>{referralsLoading ? <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-12"/>)}</div> : !referrals?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No referrals yet.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Referrer</TableHead><TableHead>Referred Site</TableHead><TableHead className="hidden md:table-cell">Contact</TableHead><TableHead className="hidden lg:table-cell">Email</TableHead><TableHead className="hidden md:table-cell">Phone</TableHead><TableHead className="hidden sm:table-cell">Orders</TableHead><TableHead>Status</TableHead><TableHead className="hidden sm:table-cell">Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{referrals.map(ref=><TableRow key={ref.id}><TableCell className="font-medium">{ref.referrer_name}</TableCell><TableCell>{ref.referred_site_name}</TableCell><TableCell className="hidden md:table-cell">{ref.referred_contact_name}</TableCell><TableCell className="hidden lg:table-cell text-muted-foreground">{ref.referred_email||"-"}</TableCell><TableCell className="hidden md:table-cell">{ref.referred_phone}</TableCell><TableCell className="hidden sm:table-cell">{(ref.referred_order_count??0)>0?<Badge className="border-0 bg-emerald-500/15 text-emerald-500">{ref.referred_order_count} order{(ref.referred_order_count??0)>1?"s":""}</Badge>:<span className="text-muted-foreground text-xs">None</span>}</TableCell><TableCell><Badge className={cn("border-0",statusColors[ref.status]||"bg-muted text-muted-foreground")}>{ref.status}</Badge></TableCell><TableCell className="hidden sm:table-cell text-muted-foreground">{new Date(ref.created_at).toLocaleDateString()}</TableCell><TableCell className="text-right"><Select value={ref.status} onValueChange={v=>updateReferral.mutate({id:ref.id,status:v,reward_given:v==="converted"})}><SelectTrigger className="h-7 w-28"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="contacted">Contacted</SelectItem><SelectItem value="converted">Converted</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
            </Card>
          </TabsContent>

          {/* ===== PROMOTIONS ===== */}
          <TabsContent value="promotions" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Promotions Manager</CardTitle>
                    <CardDescription>Build, save, and toggle promotions. Active ones appear on the customer rewards page.</CardDescription>
                  </div>
                  <Button size="sm" onClick={openCreatePromo}><Plus className="mr-1.5 size-3.5"/>Add Promotion</Button>
                </div>
              </CardHeader>
              <CardContent>
                {promosLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-16"/>)}</div>
                ) : !promotions?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No promotions yet. Click &quot;Add Promotion&quot; to build one.</p>
                ) : (
                  <div className="space-y-3">
                    {promotions.map(p => {
                      const productNames = p.eligible_product_ids && p.eligible_product_ids.length > 0
                        ? allProducts?.filter(pr => p.eligible_product_ids!.includes(pr.id)).map(pr => pr.name) ?? []
                        : []
                      return (
                        <div key={p.id} className={cn("rounded-xl border px-4 py-3 transition-all", p.is_active ? "border-primary/20 bg-primary/5" : "border-white/5 bg-muted/5 opacity-60")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold">{p.name}</p>
                                <Badge variant="secondary" className="capitalize text-[10px]">{p.season || p.type}</Badge>
                                <Badge className={cn("border-0 text-[10px]", p.discount_type === "free_freight" ? "bg-sky-400/15 text-sky-400" : p.discount_type === "buy_x_get_y" ? "bg-violet-400/15 text-violet-400" : "bg-primary/15 text-primary")}>
                                  {p.discount_type === "percentage" ? `${p.discount_value}% off` : p.discount_type === "free_freight" ? "Free freight" : p.discount_type === "bonus_credit" ? `${p.discount_value}% credit` : p.discount_type === "buy_x_get_y" ? "Buy X Get Y" : `$${p.discount_value} off`}
                                </Badge>
                                {p.display_style && p.display_style !== "card" && (
                                  <Badge variant="outline" className="text-[10px] capitalize">{p.display_style}</Badge>
                                )}
                              </div>
                              {p.headline && <p className="mt-0.5 text-sm text-foreground">{p.headline}</p>}
                              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                {p.start_date && p.end_date && (
                                  <span>{new Date(p.start_date).toLocaleDateString()} - {new Date(p.end_date).toLocaleDateString()}</span>
                                )}
                                {p.min_order_value > 0 && <span>Min: ${p.min_order_value}</span>}
                                {productNames.length > 0 && <span>Products: {productNames.join(", ")}</span>}
                                {!productNames.length && <span>All products</span>}
                              </div>
                              {p.fine_print && <p className="mt-1 text-[10px] italic text-muted-foreground/70">{p.fine_print}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={()=>togglePromo.mutate({id:p.id,is_active:!p.is_active})} className="cursor-pointer">
                                <Badge className={cn("border-0", p.is_active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>{p.is_active ? "Active" : "Inactive"}</Badge>
                              </button>
                              <Button variant="ghost" size="xs" onClick={()=>openEditPromo(p)}><Pencil className="mr-1 size-3"/>Edit</Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== BUNDLES ===== */}
          <TabsContent value="bundles" className="mt-4">
            <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Product Bundles</CardTitle><CardDescription>Configure bundle discounts. Active bundles show on the customer rewards page.</CardDescription></div><Button size="sm" onClick={openCreateBundle}><Plus className="mr-1.5 size-3.5"/>Add Bundle</Button></div></CardHeader>
              <CardContent>{bundlesLoading ? <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-12"/>)}</div> : !bundles?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No bundles yet.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Discount</TableHead><TableHead className="hidden sm:table-cell">Min Products</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{bundles.map(b=><TableRow key={b.id}><TableCell><div><p className="font-medium">{b.name}</p>{b.description&&<p className="text-xs text-muted-foreground">{b.description}</p>}{b.bundle_products&&b.bundle_products.length>0&&<p className="mt-1 text-xs text-primary">{b.bundle_products.map(bp=>bp.product?.name).filter(Boolean).join(", ")}</p>}</div></TableCell><TableCell><Badge className="border-0 bg-primary/15 text-primary">{b.discount_percent}% OFF</Badge></TableCell><TableCell className="hidden sm:table-cell">{b.bundle_products&&b.bundle_products.length>0?`${b.bundle_products.length} products`:`${b.min_products}+ products`}</TableCell><TableCell><button onClick={()=>toggleBundle.mutate({id:b.id,is_active:!b.is_active})} className="cursor-pointer"><Badge className={cn("border-0",b.is_active?"bg-emerald-500/15 text-emerald-500":"bg-muted text-muted-foreground")}>{b.is_active?"Active":"Inactive"}</Badge></button></TableCell><TableCell className="text-right"><Button variant="ghost" size="xs" onClick={()=>openEditBundle(b)}><Pencil className="mr-1 size-3"/>Edit</Button></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
            </Card>
          </TabsContent>

          {/* ===== REBATES ===== */}
          <TabsContent value="rebates" className="mt-4">
            <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Annual Spend Rebate Tiers</CardTitle><CardDescription>Configure rebate percentages based on annual spend. These show on the customer dashboard and rewards page.</CardDescription></div><Button size="sm" onClick={openCreateRebate}><Plus className="mr-1.5 size-3.5"/>Add Tier</Button></div></CardHeader>
              <CardContent>{rebatesLoading ? <div className="space-y-3">{[1,2].map(i=><Skeleton key={i} className="h-12"/>)}</div> : !rebateTiers?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No rebate tiers configured.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Rebate %</TableHead><TableHead>Min Annual Spend</TableHead><TableHead>Max Annual Spend</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rebateTiers.map(r=><TableRow key={r.id}><TableCell><span className="text-lg font-bold text-primary">{r.rebate_percent}%</span></TableCell><TableCell>${r.min_annual_spend.toLocaleString()}</TableCell><TableCell>{r.max_annual_spend?`$${r.max_annual_spend.toLocaleString()}`:"No limit"}</TableCell><TableCell className="text-right"><Button variant="ghost" size="xs" onClick={()=>openEditRebate(r)}><Pencil className="mr-1 size-3"/>Edit</Button></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
            </Card>
          </TabsContent>

          {/* ===== STAMPS ===== */}
          <TabsContent value="stamps" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Stamp Card Records</CardTitle>
                    <CardDescription>Stamps are auto-added for 1000L IBC orders. 10 stamps = free IBC of TW Standard, TW Premium, or Eco Wash. You can also manually add/edit.</CardDescription>
                  </div>
                  <Button size="sm" onClick={()=>setStampDialog(true)}><Plus className="mr-1.5 size-3.5"/>Add Stamp</Button>
                </div>
              </CardHeader>
              <CardContent>
                {stampsLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-12"/>)}</div>
                ) : !stamps?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No stamp records yet. Add stamps when customers make IBC orders.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Stamps</TableHead>
                          <TableHead className="hidden sm:table-cell">Notes</TableHead>
                          <TableHead className="hidden md:table-cell">Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stamps.map(s => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{s.contact_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">{s.email || s.user_id.slice(0,8)}</p>
                                {s.company_name && <p className="text-xs text-muted-foreground">{s.company_name}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className="border-0 bg-primary/15 text-primary">+{s.stamps_earned}</Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{(s.notes || "").replace(/\[orders:[^\]]*\]/, "").trim() || "-"}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="xs" onClick={() => openEditStamp(s)}>
                                  <Pencil className="mr-1 size-3"/>Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => { if (confirm("Remove this stamp record?")) deleteStamp.mutate(s.id) }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== EARLY ACCESS ===== */}
          <TabsContent value="early-access" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Early Access Signups</CardTitle>
                    <CardDescription>
                      First {earlyAccessLimit} customers get a free 200L drum with any order over $1,000. Notify them when a product launches.
                    </CardDescription>
                  </div>
                  {earlyAccess && earlyAccess.length > 0 && (
                    <Button size="sm" onClick={() => setNotifyDialog(true)}>
                      <Mail className="mr-1.5 size-3.5" />
                      Notify Launch
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {eaLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-12"/>)}</div>
                ) : !earlyAccess?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No signups yet. Customers can sign up from the Rewards page.</p>
                ) : (
                  <>
                    <div className="mb-3 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">{Math.min(earlyAccess.length, earlyAccessLimit)}</span> of {earlyAccessLimit} early access slots filled.
                        {earlyAccess.length > earlyAccessLimit && ` ${earlyAccess.length - earlyAccessLimit} additional signups on waitlist.`}
                        {" "}Only the first {earlyAccessLimit} will receive the free 200L drum reward.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="hidden sm:table-cell">Product Interest</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="hidden sm:table-cell">Eligibility</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {earlyAccess.map((ea, idx) => (
                            <TableRow key={ea.id}>
                              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                              <TableCell className="font-medium">{ea.email}</TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground">{ea.product_slug || "All products"}</TableCell>
                              <TableCell className="text-muted-foreground">{new Date(ea.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {idx < earlyAccessLimit ? (
                                  <Badge className="border-0 bg-emerald-500/15 text-emerald-500">Eligible</Badge>
                                ) : (
                                  <Badge className="border-0 bg-muted text-muted-foreground">Waitlist</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== CUSTOMERS ===== */}
          <TabsContent value="customers" className="mt-4">
            <Card><CardHeader><CardTitle>Customer Rewards Overview</CardTitle><CardDescription>Track customer tier status, spending, and loyalty metrics.</CardDescription></CardHeader>
              <CardContent>{customersLoading ? <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-12"/>)}</div> : !customerRewards?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No customer rewards data yet.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Tier</TableHead><TableHead className="hidden sm:table-cell">Monthly Spend</TableHead><TableHead className="hidden md:table-cell">Annual Spend</TableHead><TableHead className="hidden lg:table-cell">Stamps</TableHead><TableHead className="hidden lg:table-cell">Referrals</TableHead></TableRow></TableHeader><TableBody>{customerRewards.map(c=>{ const TI=tierIcons[c.current_tier]||Gift; return <TableRow key={c.user_id}><TableCell><div><p className="font-medium">{c.contact_name||"Unknown"}</p><p className="text-xs text-muted-foreground">{c.company_name||""}</p></div></TableCell><TableCell><div className="flex items-center gap-1.5"><TI className={cn("size-4",tierColors[c.current_tier])}/><span className="capitalize text-sm">{c.current_tier==="none"?"No tier":c.current_tier}</span></div></TableCell><TableCell className="hidden sm:table-cell">${c.current_month_spend?.toLocaleString(undefined,{minimumFractionDigits:2})??"0.00"}</TableCell><TableCell className="hidden md:table-cell">${c.annual_spend?.toLocaleString(undefined,{minimumFractionDigits:2})??"0.00"}</TableCell><TableCell className="hidden lg:table-cell">{c.total_stamps??0}</TableCell><TableCell className="hidden lg:table-cell"><div className="flex items-center gap-1.5">{c.referral_count??0}{(c.referral_count??0)>=5&&<Badge className="border-0 bg-amber-400/15 text-amber-400 text-[10px] px-1.5">Ambassador</Badge>}</div></TableCell></TableRow>})}</TableBody></Table></div>}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ===== DIALOGS ===== */}

        {/* Tier Edit */}
        <Dialog open={!!editingTier} onOpenChange={o=>!o&&setEditingTier(null)}><DialogContent><DialogHeader><DialogTitle>Edit {editingTier?.display_name} Tier</DialogTitle><DialogDescription>Changes reflect immediately on customer pages.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Min Monthly Spend ($)</Label><Input type="number" value={tierForm.min_monthly_spend} onChange={e=>setTierForm({...tierForm,min_monthly_spend:e.target.value})}/></div><div className="space-y-2"><Label>Reward Description</Label><Input value={tierForm.reward_description} onChange={e=>setTierForm({...tierForm,reward_description:e.target.value})}/></div><div className="space-y-2"><Label>Est. Monthly Savings ($)</Label><Input type="number" value={tierForm.estimated_monthly_savings} onChange={e=>setTierForm({...tierForm,estimated_monthly_savings:e.target.value})}/></div></div><DialogFooter><Button variant="outline" onClick={()=>setEditingTier(null)}>Cancel</Button><Button onClick={()=>updateTier.mutate({id:editingTier?.id,min_monthly_spend:parseFloat(tierForm.min_monthly_spend),reward_description:tierForm.reward_description,estimated_monthly_savings:parseFloat(tierForm.estimated_monthly_savings)})} disabled={updateTier.isPending}>{updateTier.isPending?<Loader2 className="mr-2 size-4 animate-spin"/>:<Save className="mr-2 size-4"/>}Save</Button></DialogFooter></DialogContent></Dialog>

        {/* Promotion Create/Edit */}
        <Dialog open={!!promoDialog} onOpenChange={o=>!o&&setPromoDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{promoDialog==="create"?"Create Promotion":"Edit Promotion"}</DialogTitle>
              <DialogDescription>{promoDialog==="create"?"Build a fully customized promotion. Toggle it on when ready.":"Update promotion details. Changes reflect immediately for active promotions."}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Internal name */}
              <div className="space-y-2">
                <Label>Promotion Name (internal)</Label>
                <Input required value={pf.name} onChange={e=>setPf({...pf,name:e.target.value})} placeholder="e.g. Summer Wash Deal"/>
              </div>
              {/* Customer-facing headline */}
              <div className="space-y-2">
                <Label>Customer Headline</Label>
                <Input value={pf.headline} onChange={e=>setPf({...pf,headline:e.target.value})} placeholder="e.g. Summer Special - Half Price Truck Wash!"/>
              </div>
              {/* Description */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Customer Description</Label>
                <Input value={pf.description} onChange={e=>setPf({...pf,description:e.target.value})} placeholder="e.g. Buy 3 IBCs of Truck Wash, get the 4th at half price"/>
              </div>
              {/* Type + Season */}
              <div className="space-y-2">
                <Label>Promotion Type</Label>
                <Select value={pf.type} onValueChange={v=>setPf({...pf,type:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                    <SelectItem value="launch">Product Launch</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Season (if seasonal)</Label>
                <Select value={pf.season} onValueChange={v=>setPf({...pf,season:v})}>
                  <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summer">Summer</SelectItem>
                    <SelectItem value="winter">Winter</SelectItem>
                    <SelectItem value="eofy">EOFY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Discount Type + Value */}
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={pf.discount_type} onValueChange={v=>setPf({...pf,discount_type:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">% Discount</SelectItem>
                    <SelectItem value="fixed">Flat $ Discount</SelectItem>
                    <SelectItem value="free_freight">Free Freight</SelectItem>
                    <SelectItem value="bonus_credit">Bonus Store Credit</SelectItem>
                    <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input type="number" value={pf.discount_value} onChange={e=>setPf({...pf,discount_value:e.target.value})} placeholder="e.g. 15"/>
                <p className="text-[10px] text-muted-foreground">
                  {pf.discount_type==="percentage"?"Percentage off (e.g. 15 = 15%)":pf.discount_type==="fixed"?"Dollar amount off":pf.discount_type==="bonus_credit"?"Credit percentage (e.g. 15 = 15% credit)":"Leave 0 for free freight / buy X get Y"}
                </p>
              </div>
              {/* Buy X Get Y detail */}
              {pf.discount_type === "buy_x_get_y" && (
                <>
                  <div className="space-y-2">
                    <Label>Buy Quantity (X)</Label>
                    <Input type="number" min="1" value={pf.buy_quantity} onChange={e=>setPf({...pf,buy_quantity:e.target.value})} placeholder="3"/>
                    <p className="text-[10px] text-muted-foreground">Customer buys X items, items beyond X get the discount %.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Description</Label>
                    <Input value={pf.promotion_type_detail || ""} onChange={e=>setPf({...pf,promotion_type_detail:e.target.value})} placeholder="e.g. Buy 3 IBCs, get 4th at half price"/>
                  </div>
                </>
              )}
              {/* Min order */}
              <div className="space-y-2">
                <Label>Min Order Value ($)</Label>
                <Input type="number" value={pf.min_order_value} onChange={e=>setPf({...pf,min_order_value:e.target.value})} placeholder="0"/>
              </div>
              {/* Display Style */}
              <div className="space-y-2">
                <Label>Display Style</Label>
                <Select value={pf.display_style} onValueChange={v=>setPf({...pf,display_style:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="callout">Callout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Dates */}
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={pf.start_date} onChange={e=>setPf({...pf,start_date:e.target.value})}/>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={pf.end_date} onChange={e=>setPf({...pf,end_date:e.target.value})}/>
              </div>
              {/* Eligible Products */}
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Eligible Products</Label>
                  <span className="text-[10px] text-muted-foreground">{promoProductIds.length === 0 ? "All products" : `${promoProductIds.length} selected`}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Leave empty for all products, or select specific ones.</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-muted/10 p-2">
                  {allProducts?.map(product => {
                    const isSelected = promoProductIds.includes(product.id)
                    return (
                      <button key={product.id} type="button" onClick={() => {
                        if (isSelected) setPromoProductIds(promoProductIds.filter(id => id !== product.id))
                        else setPromoProductIds([...promoProductIds, product.id])
                      }} className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors", isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-muted-foreground")}>
                        <div className="flex items-center gap-2">
                          <div className={cn("flex size-4 items-center justify-center rounded border text-[9px] font-bold", isSelected ? "border-primary bg-primary text-primary-foreground" : "border-white/20")}>
                            {isSelected && "✓"}
                          </div>
                          <span className={isSelected ? "font-medium" : ""}>{product.name}</span>
                        </div>
                        <span className="text-[10px]">${product.price.toFixed(2)}/{product.unit}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Fine Print */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Fine Print / Terms</Label>
                <Input value={pf.fine_print} onChange={e=>setPf({...pf,fine_print:e.target.value})} placeholder="e.g. Cannot be combined with other offers. While stocks last."/>
              </div>
              {/* Active toggle for edit */}
              {promoDialog === "edit" && editingPromo && (
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-white/5 bg-muted/10 px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <p className="text-xs text-muted-foreground">Active promotions are visible to customers.</p>
                  </div>
                  <button type="button" role="switch" aria-checked={editingPromo.is_active}
                    onClick={() => { togglePromo.mutate({ id: editingPromo.id, is_active: !editingPromo.is_active }); setEditingPromo({ ...editingPromo, is_active: !editingPromo.is_active }) }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${editingPromo.is_active ? "bg-primary" : "bg-muted"}`}>
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg transition-transform ${editingPromo.is_active ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setPromoDialog(null)}>Cancel</Button>
              <Button onClick={handleSavePromo} disabled={!pf.name||savePromo.isPending}>
                {savePromo.isPending?<Loader2 className="mr-2 size-4 animate-spin"/>:<Save className="mr-2 size-4"/>}
                {promoDialog==="create"?"Create":"Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bundle Create/Edit */}
        <Dialog open={!!bundleDialog} onOpenChange={o=>!o&&setBundleDialog(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{bundleDialog==="create"?"Create Bundle":"Edit Bundle"}</DialogTitle>
              <DialogDescription>{bundleDialog==="create"?"Add a new product bundle with selected products.":"Update bundle configuration and products."}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Bundle Name</Label>
                <Input required value={bf.name} onChange={e=>setBf({...bf,name:e.target.value})} placeholder="e.g. The Essentials"/>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={bf.description} onChange={e=>setBf({...bf,description:e.target.value})} placeholder="e.g. Core cleaning products"/>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Discount (%)</Label>
                  <Input type="number" value={bf.discount_percent} onChange={e=>setBf({...bf,discount_percent:e.target.value})} placeholder="10"/>
                </div>
                <div className="space-y-2">
                  <Label>Min Products (bundle size)</Label>
                  <Input type="number" min="2" value={bf.min_products} onChange={e=>{
                    const newMin = e.target.value
                    setBf({...bf,min_products:newMin})
                    // If reducing min below current selection, trim selection
                    const minVal = parseInt(newMin) || 2
                    if (selectedProductIds.length > minVal) {
                      setSelectedProductIds(selectedProductIds.slice(0, minVal))
                    }
                  }} placeholder="3"/>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Badge Text</Label>
                <Input value={bf.badge_text} onChange={e=>setBf({...bf,badge_text:e.target.value})} placeholder="e.g. 10% OFF"/>
              </div>
              {/* Active/Inactive Toggle */}
              {bundleDialog === "edit" && editingBundle && (
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-muted/10 px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">Bundle Status</Label>
                    <p className="text-xs text-muted-foreground">Inactive bundles are hidden from customers.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editingBundle.is_active}
                    onClick={() => {
                      toggleBundle.mutate({ id: editingBundle.id, is_active: !editingBundle.is_active })
                      setEditingBundle({ ...editingBundle, is_active: !editingBundle.is_active })
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      editingBundle.is_active ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg transition-transform ${
                      editingBundle.is_active ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              )}
              {/* Product Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Bundle Products</Label>
                  <span className={cn(
                    "text-xs font-medium",
                    selectedProductIds.length === (parseInt(bf.min_products) || 2) ? "text-primary" : "text-muted-foreground"
                  )}>
                    {selectedProductIds.length} / {parseInt(bf.min_products) || 2} selected
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select exactly {parseInt(bf.min_products) || 2} products for this bundle. To select more, increase the &quot;Min Products&quot; value above first.
                </p>
                <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-white/5 bg-muted/10 p-2">
                  {allProducts?.map(product => {
                    const isSelected = selectedProductIds.includes(product.id)
                    const maxReached = selectedProductIds.length >= (parseInt(bf.min_products) || 2)
                    const isDisabled = !isSelected && maxReached
                    return (
                      <button
                        key={product.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedProductIds(selectedProductIds.filter(id => id !== product.id))
                          } else if (!maxReached) {
                            setSelectedProductIds([...selectedProductIds, product.id])
                          }
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                          isSelected ? "bg-primary/10 text-foreground" : isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "flex size-5 items-center justify-center rounded border text-[10px] font-bold transition-colors",
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-white/20"
                          )}>
                            {isSelected && "✓"}
                          </div>
                          <span className={isSelected ? "font-medium" : ""}>{product.name}</span>
                        </div>
                        <span className="text-xs">${product.price.toFixed(2)}/{product.unit}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setBundleDialog(null)}>Cancel</Button>
              <Button onClick={handleSaveBundle} disabled={!bf.name||saveBundle.isPending}>
                {saveBundle.isPending?<Loader2 className="mr-2 size-4 animate-spin"/>:<Save className="mr-2 size-4"/>}
                {bundleDialog==="create"?"Create":"Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rebate Create/Edit */}
        <Dialog open={!!rebateDialog} onOpenChange={o=>!o&&setRebateDialog(null)}><DialogContent><DialogHeader><DialogTitle>{rebateDialog==="create"?"Create Rebate Tier":"Edit Rebate Tier"}</DialogTitle><DialogDescription>Configure annual spend thresholds and rebate percentages.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Rebate Percentage (%)</Label><Input type="number" step="0.5" value={rf.rebate_percent} onChange={e=>setRf({...rf,rebate_percent:e.target.value})} placeholder="e.g. 5"/></div><div className="space-y-2"><Label>Min Annual Spend ($)</Label><Input type="number" value={rf.min_annual_spend} onChange={e=>setRf({...rf,min_annual_spend:e.target.value})} placeholder="e.g. 25000"/></div><div className="space-y-2"><Label>Max Annual Spend ($) - leave empty for no limit</Label><Input type="number" value={rf.max_annual_spend} onChange={e=>setRf({...rf,max_annual_spend:e.target.value})} placeholder="e.g. 49999"/></div></div><DialogFooter><Button variant="outline" onClick={()=>setRebateDialog(null)}>Cancel</Button><Button onClick={()=>{const payload:Record<string,unknown>={min_annual_spend:parseFloat(rf.min_annual_spend)||0,max_annual_spend:rf.max_annual_spend?parseFloat(rf.max_annual_spend):null,rebate_percent:parseFloat(rf.rebate_percent)||0};if(rebateDialog==="edit"&&editingRebate)payload.id=editingRebate.id;saveRebate.mutate(payload)}} disabled={!rf.rebate_percent||!rf.min_annual_spend||saveRebate.isPending}>{saveRebate.isPending?<Loader2 className="mr-2 size-4 animate-spin"/>:<Save className="mr-2 size-4"/>}{rebateDialog==="create"?"Create":"Save"}</Button></DialogFooter></DialogContent></Dialog>

        {/* Stamp Add */}
        <Dialog open={stampDialog} onOpenChange={o=>!o&&setStampDialog(false)}><DialogContent><DialogHeader><DialogTitle>Add Stamp</DialogTitle><DialogDescription>Add a loyalty stamp for a customer. Select the customer and number of stamps.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Customer</Label><Select value={sf.user_id} onValueChange={v=>setSf({...sf,user_id:v})}><SelectTrigger><SelectValue placeholder="Select customer"/></SelectTrigger><SelectContent>{customerRewards?.map(c=><SelectItem key={c.user_id} value={c.user_id}>{c.contact_name||c.company_name||c.user_id.slice(0,8)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Stamps to Add</Label><Input type="number" min="1" value={sf.stamps_earned} onChange={e=>setSf({...sf,stamps_earned:e.target.value})}/></div><div className="space-y-2"><Label>Notes (optional)</Label><Input value={sf.notes} onChange={e=>setSf({...sf,notes:e.target.value})} placeholder="e.g. IBC order #ORD-123456"/></div></div><DialogFooter><Button variant="outline" onClick={()=>setStampDialog(false)}>Cancel</Button><Button onClick={()=>addStamp.mutate({user_id:sf.user_id,stamps_earned:parseInt(sf.stamps_earned)||1,notes:sf.notes||null})} disabled={!sf.user_id||addStamp.isPending}>{addStamp.isPending?<Loader2 className="mr-2 size-4 animate-spin"/>:<Save className="mr-2 size-4"/>}Add Stamp</Button></DialogFooter></DialogContent></Dialog>

        {/* Notify Launch */}
        <Dialog open={notifyDialog} onOpenChange={o=>!o&&setNotifyDialog(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Notify Early Access Customers</DialogTitle>
              <DialogDescription>
                Select the product that has launched. The first {earlyAccessLimit} signups will receive an email with their free 200L drum reward details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Launched Product</Label>
                <Select value={notifyProductId} onValueChange={setNotifyProductId}>
                  <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                  <SelectContent>
                    {allProducts?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {notifyProductId && (
                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 space-y-1">
                  <p className="text-sm font-medium">What will be sent:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>- Email to the first {Math.min(earlyAccess?.length ?? 0, earlyAccessLimit)} customers</li>
                    <li>- Subject: &quot;{allProducts?.find(p=>p.id===notifyProductId)?.name} is Now Available&quot;</li>
                    <li>- Includes: Free 200L drum reward claim instructions</li>
                    <li>- Link to the product page</li>
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotifyDialog(false)}>Cancel</Button>
              <Button
                disabled={!notifyProductId || notifyMutation.isPending}
                onClick={() => {
                  const product = allProducts?.find(p => p.id === notifyProductId)
                  if (!product) return
                  notifyMutation.mutate({
                    product_id: product.id,
                    product_name: product.name,
                    product_slug: product.slug,
                  })
                }}
              >
                {notifyMutation.isPending ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" />Sending...</>
                ) : (
                  <><Mail className="mr-2 size-4" />Send Notifications</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stamp Edit */}
        <Dialog open={!!editingStamp} onOpenChange={o=>!o&&setEditingStamp(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Stamp Record</DialogTitle>
              <DialogDescription>
                Update or correct the stamp count for this record.
              </DialogDescription>
            </DialogHeader>
            {editingStamp && (
              <div className="space-y-4">
                <div className="rounded-lg border border-white/5 bg-muted/10 p-3">
                  <p className="text-sm font-medium">{editingStamp.contact_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{editingStamp.email || ""}</p>
                  {editingStamp.company_name && <p className="text-xs text-muted-foreground">{editingStamp.company_name}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Added: {new Date(editingStamp.created_at).toLocaleDateString()}</p>
                </div>
                <div className="space-y-2">
                  <Label>Stamps</Label>
                  <Input type="number" min="0" value={esf.stamps_earned} onChange={e=>setEsf({...esf,stamps_earned:e.target.value})}/>
                  <p className="text-xs text-muted-foreground">Set to 0 to effectively remove this stamp without deleting the record.</p>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={esf.notes} onChange={e=>setEsf({...esf,notes:e.target.value})} placeholder="e.g. Adjusted - reason"/>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={()=>setEditingStamp(null)}>Cancel</Button>
              <Button onClick={()=>updateStamp.mutate({id:editingStamp?.id,stamps_earned:parseInt(esf.stamps_earned)||0,notes:esf.notes||null})} disabled={updateStamp.isPending}>
                {updateStamp.isPending?<Loader2 className="mr-2 size-4 animate-spin"/>:<Save className="mr-2 size-4"/>}Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
