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
import { collaborationApi, CollaboratorRole } from "@/lib/api/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
    queryFn: () => collaborationApi.getContext(),
  });

  // Fetch my collaborators (people I've invited)
  const {
    data: collaboratorsData,
    isLoading: collaboratorsLoading,
    error: collaboratorsError,
  } = useQuery({
    queryKey: ["collaboration", "collaborators"],
    queryFn: () => collaborationApi.listCollaborators(),
  });

  // Invite collaborator mutation
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: CollaboratorRole }) =>
      collaborationApi.invite(data.email, data.role),
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
    mutationFn: (invitationId: string) =>
      collaborationApi.acceptInvitationById(invitationId),
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
    mutationFn: (invitationId: string) =>
      collaborationApi.declineInvitation(invitationId),
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
    mutationFn: (collaboratorId: string) =>
      collaborationApi.remove(collaboratorId),
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
    mutationFn: (ownerId: string) =>
      collaborationApi.leaveSharedInventory(ownerId),
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
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
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
                              <span>{tCommon("viewer")}</span>
                              <span className="text-muted-foreground text-xs">
                                {t("viewerDescription")}
                              </span>
                            </div>
                          </SelectItem>
                          <SelectItem value="editor">
                            <div className="flex flex-col">
                              <span>{tCommon("editor")}</span>
                              <span className="text-muted-foreground text-xs">
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
                <div className="text-muted-foreground py-8 text-center">
                  {tCommon("loading")}
                </div>
              ) : hasError ? (
                <div className="text-destructive py-8 text-center">
                  {tCommon("error")}
                </div>
              ) : collaborators.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="text-muted-foreground mb-4 h-12 w-12" />
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
                          <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                            <Mail className="text-muted-foreground h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {collab.collaborator?.name || collab.invited_email}
                          </p>
                          <p className="text-muted-foreground text-sm">
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
                        <Badge variant="outline">{tCommon(collab.role)}</Badge>
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
                        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                          <Users className="text-muted-foreground h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">
                          {invitation.owner.name || invitation.owner.email}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {t("role")}: {tCommon(invitation.role)}
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
                <div className="text-muted-foreground py-8 text-center">
                  {tCommon("loading")}
                </div>
              ) : sharedInventories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="text-muted-foreground mb-4 h-12 w-12" />
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
                          <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                            <Users className="text-muted-foreground h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {shared.owner.name || shared.owner.email}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {shared.owner.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tCommon(shared.role)}</Badge>
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
