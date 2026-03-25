"use client"

import { useState } from "react"
import {
  Search,
  MoreHorizontal,
  Eye,
  Ban,
  CheckCircle,
  Shield,
  ShieldOff,
} from "lucide-react"
import { toast } from "sonner"

import { useAdminUsers, useUpdateUser } from "@/lib/hooks/use-admin-users"
import { PageTransition } from "@/components/shared/page-transition"
import {
  Card,
  CardContent,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  TablePagination,
  paginateArray,
} from "@/components/shared/table-pagination"
import type { Profile } from "@/lib/supabase/types"

export default function AdminUsersPage() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [viewUser, setViewUser] = useState<Profile | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: users, isLoading } = useAdminUsers({
    search: search || undefined,
    role: roleFilter,
    status: statusFilter,
  })
  const updateUser = useUpdateUser()

  function handleToggleStatus(user: Profile) {
    const newStatus = user.status === "active" ? "suspended" : "active"
    updateUser.mutate(
      { id: user.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast.success(
            newStatus === "active"
              ? `${user.contact_name || user.email} has been reactivated.`
              : `${user.contact_name || user.email} has been suspended.`,
          )
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function handleToggleRole(user: Profile) {
    const newRole = user.role === "admin" ? "customer" : "admin"
    updateUser.mutate(
      { id: user.id, data: { role: newRole } },
      {
        onSuccess: () => {
          toast.success(
            `${user.contact_name || user.email} is now ${newRole === "admin" ? "an admin" : "a customer"}.`,
          )
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function openDetail(user: Profile) {
    setViewUser(user)
    setDetailOpen(true)
  }

  const userList = users ?? []

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage platform users and administrators.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users ({userList.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Company
                    </TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Joined
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginateArray(userList, page, pageSize).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.contact_name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {user.company_name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.role === "admin"
                              ? "bg-violet-500/10 text-violet-500 border-violet-500/20"
                              : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          }
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.status === "active"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-red-500/10 text-red-500 border-red-500/20"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {new Date(user.created_at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDetail(user)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleRole(user)}
                            >
                              {user.role === "admin" ? (
                                <>
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  Demote to Customer
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Promote to Admin
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleToggleStatus(user)}
                            >
                              {user.status === "active" ? (
                                <>
                                  <Ban className="mr-2 h-4 w-4" />
                                  Suspend User
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Reactivate User
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {userList.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            {!isLoading && userList.length > 0 && (
              <TablePagination
                page={page}
                pageSize={pageSize}
                totalItems={userList.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </CardContent>
        </Card>

        {/* User Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>
                Full profile information for this user.
              </DialogDescription>
            </DialogHeader>
            {viewUser && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {viewUser.contact_name
                      ? viewUser.contact_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "U"}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {viewUser.contact_name || "No name"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {viewUser.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Role
                    </Label>
                    <p className="text-sm font-medium capitalize">
                      {viewUser.role}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <p className="text-sm font-medium capitalize">
                      {viewUser.status}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Company
                    </Label>
                    <p className="text-sm font-medium">
                      {viewUser.company_name || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      ABN
                    </Label>
                    <p className="text-sm font-medium">
                      {viewUser.abn || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Phone
                    </Label>
                    <p className="text-sm font-medium">
                      {viewUser.phone || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Joined
                    </Label>
                    <p className="text-sm font-medium">
                      {new Date(viewUser.created_at).toLocaleDateString(
                        "en-AU",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </p>
                  </div>
                </div>

                {(viewUser.address_street || viewUser.address_city) && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Address
                    </Label>
                    <p className="text-sm font-medium">
                      {[
                        viewUser.address_street,
                        viewUser.address_city,
                        viewUser.address_state,
                        viewUser.address_postcode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                )}

                {viewUser.delivery_address && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Delivery Location
                    </Label>
                    <p className="text-sm font-medium">
                      {viewUser.delivery_address}
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
