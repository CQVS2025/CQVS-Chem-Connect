import type { Metadata } from "next"
import {
  Star,
  ShoppingCart,
  Users,
  MessageSquare,
  Gift,
  Truck,
  Headphones,
  Trophy,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Rewards - Chem Connect",
  description: "View your loyalty points and available rewards.",
}

const earnMethods = [
  {
    title: "Place Orders",
    description: "Earn 1 point for every $10 spent on qualifying orders.",
    icon: ShoppingCart,
    highlight: "1 pt / $10",
  },
  {
    title: "Refer a Business",
    description: "Get 500 bonus points when a referred business places their first order.",
    icon: Users,
    highlight: "500 pts",
  },
  {
    title: "Write Reviews",
    description: "Share your experience with a product and earn points per approved review.",
    icon: MessageSquare,
    highlight: "50 pts",
  },
]

const rewardsHistory = [
  {
    date: "2026-03-20",
    description: "Order ORD-2026-001 - purchase points",
    points: 1016,
  },
  {
    date: "2026-03-18",
    description: "Order ORD-2026-002 - purchase points",
    points: 690,
  },
  {
    date: "2026-03-10",
    description: "Product review - Green Acid Replacement",
    points: 50,
  },
  {
    date: "2026-03-01",
    description: "Referral bonus - AquaPure Industries",
    points: 500,
  },
  {
    date: "2026-02-15",
    description: "Order ORD-2026-005 - purchase points",
    points: 194,
  },
]

const availableRewards = [
  {
    title: "$50 Account Credit",
    description: "Apply a $50 credit to your next order.",
    cost: 2000,
    icon: Gift,
  },
  {
    title: "Free Shipping",
    description: "Free delivery on your next order, any size.",
    cost: 1000,
    icon: Truck,
  },
  {
    title: "Priority Support",
    description: "Dedicated account manager for 30 days.",
    cost: 3000,
    icon: Headphones,
  },
]

const currentPoints = 2450
const currentTier = "Silver"
const nextTier = "Gold"
const nextTierThreshold = 5000
const progress = Math.round((currentPoints / nextTierThreshold) * 100)

export default function RewardsPage() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Rewards & Loyalty
        </h1>
        <p className="mt-1 text-muted-foreground">
          Earn points on every purchase and redeem them for exclusive perks.
        </p>
      </div>

      {/* Hero card - points and tier */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <CardContent className="relative py-8">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            {/* Points display */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Star className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Your Points Balance
                </p>
                <p className="text-5xl font-bold tracking-tight">
                  {currentPoints.toLocaleString()}
                </p>
              </div>
              {/* Tier and progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">{currentTier}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {nextTierThreshold - currentPoints} pts to {nextTier}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentPoints.toLocaleString()} / {nextTierThreshold.toLocaleString()} points
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How to earn */}
      <div>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">
          How to Earn Points
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {earnMethods.map((method) => {
            const Icon = method.icon
            return (
              <Card key={method.title}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {method.title}
                      </CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        {method.highlight}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {method.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Points history */}
      <Card>
        <CardHeader>
          <CardTitle>Points History</CardTitle>
          <CardDescription>
            Recent points earned from your activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewardsHistory.map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-500">
                    +{entry.points.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Available rewards */}
      <div>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">
          Redeem Rewards
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableRewards.map((reward) => {
            const Icon = reward.icon
            const canAfford = currentPoints >= reward.cost
            return (
              <Card key={reward.title}>
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="mt-2 text-base">
                    {reward.title}
                  </CardTitle>
                  <CardDescription>{reward.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      {reward.cost.toLocaleString()} pts
                    </Badge>
                    <Button
                      size="sm"
                      variant={canAfford ? "default" : "outline"}
                      disabled={!canAfford}
                    >
                      {canAfford ? "Redeem" : "Not enough pts"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
