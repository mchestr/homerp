"use client";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import {
  adminApi,
  CreditPackAdmin,
  CreditPackCreate,
  CreditPackUpdate,
} from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type PackFormData = {
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string;
  is_active: boolean;
  sort_order: number;
};

// Internal form state that allows empty strings for number inputs
type PackFormState = {
  name: string;
  credits: string;
  price_cents: string;
  stripe_price_id: string;
  is_active: boolean;
  sort_order: string;
};

function PackFormDialog({
  open,
  onClose,
  pack,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  pack?: CreditPackAdmin;
  onSave: (data: PackFormData) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<PackFormState>({
    name: pack?.name ?? "",
    credits: pack?.credits.toString() ?? "25",
    price_cents: pack?.price_cents.toString() ?? "300",
    stripe_price_id: pack?.stripe_price_id ?? "",
    is_active: pack?.is_active ?? true,
    sort_order: pack?.sort_order.toString() ?? "0",
  });

  useEffect(() => {
    if (pack) {
      setFormData({
        name: pack.name,
        credits: pack.credits.toString(),
        price_cents: pack.price_cents.toString(),
        stripe_price_id: pack.stripe_price_id,
        is_active: pack.is_active,
        sort_order: pack.sort_order.toString(),
      });
    } else {
      setFormData({
        name: "",
        credits: "25",
        price_cents: "300",
        stripe_price_id: "",
        is_active: true,
        sort_order: "0",
      });
    }
  }, [pack, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert string values to numbers, using defaults if empty
    const numericData: PackFormData = {
      name: formData.name,
      credits: parseInt(formData.credits) || 0,
      price_cents: parseInt(formData.price_cents) || 0,
      stripe_price_id: formData.stripe_price_id,
      is_active: formData.is_active,
      sort_order: parseInt(formData.sort_order) || 0,
    };
    onSave(numericData);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pack ? "Edit Credit Pack" : "Create Credit Pack"}
          </DialogTitle>
          <DialogDescription>
            {pack
              ? "Update the credit pack details"
              : "Create a new credit pack for users to purchase"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Starter Pack"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credits">Credits</Label>
                <Input
                  id="credits"
                  type="number"
                  min={1}
                  value={formData.credits}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({
                      ...formData,
                      credits: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (cents)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={formData.price_cents}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({
                      ...formData,
                      price_cents: e.target.value,
                    })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formatPrice(parseInt(formData.price_cents) || 0)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
              <Input
                id="stripe_price_id"
                value={formData.stripe_price_id}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, stripe_price_id: e.target.value })
                }
                placeholder="price_..."
                required
              />
              <p className="text-xs text-muted-foreground">
                Get this from your Stripe Dashboard under Products
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({
                      ...formData,
                      sort_order: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pack ? "Save Changes" : "Create Pack"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPacksPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editingPack, setEditingPack] = useState<CreditPackAdmin | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletePackId, setDeletePackId] = useState<string | null>(null);

  const { data: packs, isLoading: packsLoading } = useQuery({
    queryKey: ["admin-packs"],
    queryFn: adminApi.listPacks,
    enabled: !!user?.is_admin,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreditPackCreate) => adminApi.createPack(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packs"] });
      setIsCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreditPackUpdate }) =>
      adminApi.updatePack(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packs"] });
      setEditingPack(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packs"] });
      setDeletePackId(null);
    },
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleCreate = (data: PackFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: PackFormData) => {
    if (editingPack) {
      updateMutation.mutate({ id: editingPack.id, data });
    }
  };

  const handleDelete = () => {
    if (deletePackId) {
      deleteMutation.mutate(deletePackId);
    }
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
            Credit Packs
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage credit pack options available for purchase
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Pack
        </Button>
      </div>

      {packsLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stripe Price ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packs?.map((pack) => (
                <tr key={pack.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{pack.name}</td>
                  <td className="px-4 py-3">{pack.credits}</td>
                  <td className="px-4 py-3">{formatPrice(pack.price_cents)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {pack.stripe_price_id}
                  </td>
                  <td className="px-4 py-3">
                    {pack.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        <X className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{pack.sort_order}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingPack(pack)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePackId(pack.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!packs || packs.length === 0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No credit packs yet. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <PackFormDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreate}
        isSaving={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <PackFormDialog
        open={!!editingPack}
        onClose={() => setEditingPack(null)}
        pack={editingPack ?? undefined}
        onSave={handleUpdate}
        isSaving={updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletePackId}
        onOpenChange={() => setDeletePackId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credit Pack</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the credit pack. Existing purchases will not
              be affected. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
