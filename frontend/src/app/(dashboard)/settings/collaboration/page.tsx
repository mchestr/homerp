"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Users, UserPlus, Mail, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { apiRequest } from "@/lib/api/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type CollaboratorRole = "viewer" | "editor";
type CollaboratorStatus = "pending" | "accepted" | "declined";

interface CollaboratorUserInfo {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}

interface Collaborator {
  id: string;
  owner_id: string;
  collaborator_id: string | null;
  invited_email: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  collaborator: CollaboratorUserInfo | null;
}

interface SharedInventory {
  id: string;
  owner_id: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  accepted_at: string | null;
  owner: CollaboratorUserInfo;
}

interface PendingInvitation {
  id: string;
  owner_id: string;
  role: CollaboratorRole;
  invited_email: string;
  created_at: string;
  owner: CollaboratorUserInfo;
}

interface InventoryContext {
  own_inventory: CollaboratorUserInfo;
  shared_inventories: SharedInventory[];
  pending_invitations: PendingInvitation[];
}

export default function CollaborationSettingsPage() {
  const t = useTranslations("collaboration");
  const tCommon = useTranslations("common");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>("viewer");

  // Fetch inventory context (shared inventories and pending invitations)
  const {
    data: contextData,
    isLoading: contextLoading,
    error: contextError,
  } = useQuery({
    queryKey: ["collaboration", "context"],
    queryFn: async () => {
      return apiRequest<InventoryContext>("/api/v1/collaboration/context");
    },
  });

  // Fetch my collaborators (people I've invited)
  const {
    data: collaboratorsData,
    isLoading: collaboratorsLoading,
    error: collaboratorsError,
  } = useQuery({
    queryKey: ["collaboration", "collaborators"],
    queryFn: async () => {
      return apiRequest<Collaborator[]>("/api/v1/collaboration/collaborators");
    },
  });

  // Invite collaborator mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: CollaboratorRole }) => {
      return apiRequest<Collaborator>("/api/v1/collaboration/collaborators", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration"] });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("viewer");
      toast({
        title: tCommon("success"),
        description: t("invitationSent"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tCommon("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest(
        `/api/v1/collaboration/invitations/${invitationId}/accept`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration"] });
      toast({
        title: tCommon("success"),
        description: t("invitationAccepted"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tCommon("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Decline invitation mutation
  const declineMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest(
        `/api/v1/collaboration/invitations/${invitationId}/decline`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration"] });
      toast({
        title: tCommon("success"),
        description: t("invitationDeclined"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tCommon("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove collaborator mutation
  const removeMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      return apiRequest(
        `/api/v1/collaboration/collaborators/${collaboratorId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration"] });
      toast({
        title: tCommon("success"),
        description: t("collaboratorRemoved"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tCommon("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Leave shared inventory mutation
  const leaveMutation = useMutation({
    mutationFn: async (ownerId: string) => {
      return apiRequest(`/api/v1/collaboration/shared/${ownerId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration"] });
      toast({
        title: tCommon("success"),
        description: t("leftInventory"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tCommon("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInvite = () => {
    if (inviteEmail.trim()) {
      inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
    }
  };

  const isLoading = contextLoading || collaboratorsLoading;
  const hasError = contextError || collaboratorsError;

  const sharedInventories = contextData?.shared_inventories ?? [];
  const pendingInvitations = contextData?.pending_invitations ?? [];
  const collaborators = collaboratorsData ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <Tabs defaultValue="collaborators" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="collaborators" data-testid="tab-collaborators">
            {t("myCollaborators")}
          </TabsTrigger>
          <TabsTrigger value="shared" data-testid="tab-shared">
            {t("sharedWithMe")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collaborators" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">
                  {t("myCollaborators")}
                </CardTitle>
                <CardDescription>
                  {t("noCollaboratorsDescription")}
                </CardDescription>
              </div>
              <Dialog
                open={inviteDialogOpen}
                onOpenChange={setInviteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button data-testid="invite-collaborator-button">
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t("inviteCollaborator")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("inviteCollaborator")}</DialogTitle>
                    <DialogDescription>{t("subtitle")}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("email")}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        data-testid="invite-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">{t("role")}</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(v) =>
                          setInviteRole(v as CollaboratorRole)
                        }
                      >
                        <SelectTrigger data-testid="invite-role-select">
                          <SelectValue placeholder={t("selectRole")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">
                            <div className="flex flex-col">
                              <span>{t("viewer")}</span>
                              <span className="text-xs text-muted-foreground">
                                {t("viewerDescription")}
                              </span>
                            </div>
                          </SelectItem>
                          <SelectItem value="editor">
                            <div className="flex flex-col">
                              <span>{t("editor")}</span>
                              <span className="text-xs text-muted-foreground">
                                {t("editorDescription")}
                              </span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setInviteDialogOpen(false)}
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || inviteMutation.isPending}
                      data-testid="send-invitation-button"
                    >
                      {inviteMutation.isPending
                        ? tCommon("loading")
                        : t("sendInvitation")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  {tCommon("loading")}
                </div>
              ) : hasError ? (
                <div className="py-8 text-center text-destructive">
                  {tCommon("error")}
                </div>
              ) : collaborators.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {t("noCollaborators")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                      data-testid={`collaborator-${collab.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {collab.collaborator?.avatar_url ? (
                          <img
                            src={collab.collaborator.avatar_url}
                            alt=""
                            className="h-10 w-10 rounded-full"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {collab.collaborator?.name || collab.invited_email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {collab.invited_email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            collab.status === "accepted"
                              ? "default"
                              : collab.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {t(collab.status)}
                        </Badge>
                        <Badge variant="outline">{t(collab.role)}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMutation.mutate(collab.id)}
                          disabled={removeMutation.isPending}
                          data-testid={`remove-collaborator-${collab.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shared" className="space-y-4">
          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("pendingInvitations")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                    data-testid={`pending-invitation-${invitation.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {invitation.owner.avatar_url ? (
                        <img
                          src={invitation.owner.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">
                          {invitation.owner.name || invitation.owner.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("role")}: {t(invitation.role)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => declineMutation.mutate(invitation.id)}
                        disabled={declineMutation.isPending}
                        data-testid={`decline-invitation-${invitation.id}`}
                      >
                        <X className="mr-1 h-4 w-4" />
                        {t("decline")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => acceptMutation.mutate(invitation.id)}
                        disabled={acceptMutation.isPending}
                        data-testid={`accept-invitation-${invitation.id}`}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        {t("accept")}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Shared Inventories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("sharedWithMe")}</CardTitle>
              <CardDescription>
                {t("noSharedInventoriesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  {tCommon("loading")}
                </div>
              ) : sharedInventories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {t("noSharedInventories")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sharedInventories.map((shared) => (
                    <div
                      key={shared.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                      data-testid={`shared-inventory-${shared.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {shared.owner.avatar_url ? (
                          <img
                            src={shared.owner.avatar_url}
                            alt=""
                            className="h-10 w-10 rounded-full"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Users className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {shared.owner.name || shared.owner.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {shared.owner.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{t(shared.role)}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => leaveMutation.mutate(shared.owner_id)}
                          disabled={leaveMutation.isPending}
                          data-testid={`leave-inventory-${shared.id}`}
                        >
                          {t("leave")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
