"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { adminApi, UserAdmin, CreditAdjustment } from "@/lib/api/api-client";
import {
  Search,
  Loader2,
  ArrowLeft,
  Shield,
  ShieldOff,
  ChevronLeft,
  ChevronRight,
  Coins,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingAdminChange, setPendingAdminChange] = useState<{
    user: UserAdmin;
    newStatus: boolean;
  } | null>(null);
  const [creditAdjustment, setCreditAdjustment] = useState<{
    user: UserAdmin;
    amount: string;
    freeCreditsAmount: string;
    reason: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: () => adminApi.listUsers(page, 20, search || undefined),
    enabled: !!user?.is_admin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, is_admin }: { id: string; is_admin: boolean }) =>
      adminApi.updateUser(id, { is_admin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setPendingAdminChange(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      setPendingAdminChange(null);
    },
  });

  const creditMutation = useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: CreditAdjustment;
    }) => adminApi.adjustUserCredits(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreditAdjustment(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleAdminToggle = (targetUser: UserAdmin) => {
    setPendingAdminChange({
      user: targetUser,
      newStatus: !targetUser.is_admin,
    });
  };

  const confirmAdminChange = () => {
    if (pendingAdminChange) {
      updateMutation.mutate({
        id: pendingAdminChange.user.id,
        is_admin: pendingAdminChange.newStatus,
      });
    }
  };

  const openCreditAdjustment = (targetUser: UserAdmin) => {
    setCreditAdjustment({
      user: targetUser,
      amount: "",
      freeCreditsAmount: "",
      reason: "",
    });
  };

  const handleCreditSubmit = () => {
    if (!creditAdjustment) return;
    const amount = creditAdjustment.amount
      ? parseInt(creditAdjustment.amount, 10)
      : 0;
    const freeCreditsAmount = creditAdjustment.freeCreditsAmount
      ? parseInt(creditAdjustment.freeCreditsAmount, 10)
      : 0;

    if (isNaN(amount) || isNaN(freeCreditsAmount)) {
      setErrorMessage("Please enter valid numbers for credit amounts");
      return;
    }
    if (amount === 0 && freeCreditsAmount === 0) {
      setErrorMessage("Please enter at least one non-zero amount");
      return;
    }
    if (!creditAdjustment.reason.trim()) {
      setErrorMessage("Please enter a reason for this adjustment");
      return;
    }
    creditMutation.mutate({
      userId: creditAdjustment.user.id,
      data: {
        amount,
        free_credits_amount: freeCreditsAmount,
        reason: creditAdjustment.reason.trim(),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            User Management
          </h1>
          <p className="mt-1 text-muted-foreground">
            View and manage user accounts
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by email..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          className="pl-9"
        />
      </div>

      {usersLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden rounded-xl border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Credits</th>
                    <th className="px-4 py-3 font-medium">Free Credits</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium">Admin</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersData?.items.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                              {u.email[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{u.name || "No name"}</p>
                            <p className="text-sm text-muted-foreground">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{u.credit_balance}</td>
                      <td className="px-4 py-3">{u.free_credits_remaining}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                            <Shield className="h-3 w-3" /> Admin
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCreditAdjustment(u)}
                          >
                            <Coins className="mr-1 h-4 w-4" />
                            Adjust Credits
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAdminToggle(u)}
                            disabled={u.id === user.id}
                            title={
                              u.id === user.id
                                ? "Cannot change your own admin status"
                                : ""
                            }
                          >
                            {u.is_admin ? (
                              <>
                                <ShieldOff className="mr-1 h-4 w-4" />
                                Revoke Admin
                              </>
                            ) : (
                              <>
                                <Shield className="mr-1 h-4 w-4" />
                                Make Admin
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!usersData?.items || usersData.items.length === 0) && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {usersData?.items.map((u) => (
              <div key={u.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {u.email[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{u.name || "No name"}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  {u.is_admin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Credits</p>
                    <p className="font-medium">{u.credit_balance}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Free</p>
                    <p className="font-medium">{u.free_credits_remaining}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Joined</p>
                    <p className="font-medium">{formatDate(u.created_at)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openCreditAdjustment(u)}
                  >
                    <Coins className="mr-1 h-4 w-4" />
                    Adjust
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleAdminToggle(u)}
                    disabled={u.id === user.id}
                  >
                    {u.is_admin ? (
                      <>
                        <ShieldOff className="mr-1 h-4 w-4" />
                        Revoke
                      </>
                    ) : (
                      <>
                        <Shield className="mr-1 h-4 w-4" />
                        Admin
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
            {(!usersData?.items || usersData.items.length === 0) && (
              <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                No users found
              </div>
            )}
          </div>

          {/* Pagination */}
          {usersData && usersData.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {usersData.page} of {usersData.total_pages} (
                {usersData.total} users)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(usersData.total_pages, p + 1))
                  }
                  disabled={page === usersData.total_pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Admin Change Confirmation */}
      <AlertDialog
        open={!!pendingAdminChange}
        onOpenChange={() => setPendingAdminChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAdminChange?.newStatus
                ? "Grant Admin Access"
                : "Revoke Admin Access"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAdminChange?.newStatus
                ? `Are you sure you want to grant admin access to ${pendingAdminChange.user.email}? They will be able to manage credit packs and other users.`
                : `Are you sure you want to revoke admin access from ${pendingAdminChange?.user.email}? They will no longer be able to access the admin panel.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAdminChange}
              className={
                pendingAdminChange?.newStatus
                  ? ""
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {pendingAdminChange?.newStatus ? "Grant Admin" : "Revoke Admin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credit Adjustment Dialog */}
      <Dialog
        open={!!creditAdjustment}
        onOpenChange={(open) => !open && setCreditAdjustment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
            <DialogDescription>
              Adjust credits for {creditAdjustment?.user.email}. Current
              balance: {creditAdjustment?.user.credit_balance} purchased
              credits, {creditAdjustment?.user.free_credits_remaining} free
              credits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Purchased Credits</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount (positive to add, negative to remove)"
                value={creditAdjustment?.amount ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCreditAdjustment((prev) =>
                    prev ? { ...prev, amount: e.target.value } : null
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Adjust purchased credits (never expire). Use negative to remove.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="freeCreditsAmount">Free Credits</Label>
              <Input
                id="freeCreditsAmount"
                type="number"
                placeholder="Enter amount (positive to add, negative to remove)"
                value={creditAdjustment?.freeCreditsAmount ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCreditAdjustment((prev) =>
                    prev ? { ...prev, freeCreditsAmount: e.target.value } : null
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Adjust free monthly credits. Use negative to remove (e.g., -
                {creditAdjustment?.user.free_credits_remaining} to zero out).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for this adjustment"
                value={creditAdjustment?.reason ?? ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setCreditAdjustment((prev) =>
                    prev ? { ...prev, reason: e.target.value } : null
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditAdjustment(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreditSubmit}
              disabled={creditMutation.isPending}
            >
              {creditMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <AlertDialog
        open={!!errorMessage}
        onOpenChange={() => setErrorMessage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMessage(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
