"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  UserPlus,
  Users,
  Loader2,
  Trash2,
  Clock,
  Mail,
  Crown,
  Shield,
} from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  name: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

interface StaffData {
  members: StaffMember[];
  invites: PendingInvite[];
}

export default function StaffPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "member" | "invite"; id: string; name: string } | null>(null);

  const isOwner = session?.user?.role === "TENANT_OWNER" || session?.user?.role === "SUPER_ADMIN";

  const { data, isLoading, error } = useQuery<{ success: boolean; data: StaffData }>({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string }) => {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to send invite");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteError("");
    },
    onError: (err: Error) => {
      setInviteError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: { type: "member" | "invite"; id: string }) => {
      const param = target.type === "member" ? `userId=${target.id}` : `inviteId=${target.id}`;
      const res = await fetch(`/api/staff?${param}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to remove");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setDeleteTarget(null);
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    inviteMutation.mutate({ name: inviteName.trim(), email: inviteEmail.trim().toLowerCase() });
  }

  const members = data?.data?.members || [];
  const invites = data?.data?.invites || [];

  if (!isOwner) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Shield className="h-10 w-10" />}
          title="Access Restricted"
          description="Only the business owner can manage team members."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Failed to load team"
          description="Something went wrong. Please try again."
          action={
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["staff"] })}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team members and invitations
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Members ({members.length})</CardTitle>
          <CardDescription>Active members of your business</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No team members yet.</p>
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                      {member.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        {member.role === "TENANT_OWNER" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
                            <Crown className="h-3 w-3" /> Owner
                          </span>
                        )}
                        {member.role === "TENANT_STAFF" && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">
                            Staff
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                  {member.role === "TENANT_STAFF" && member.id !== session?.user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setDeleteTarget({ type: "member", id: member.id, name: member.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Invitations ({invites.length})</CardTitle>
            <CardDescription>Invitations waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {invites.map((invite) => {
                const isExpired = new Date(invite.expiresAt) < new Date();
                return (
                  <div key={invite.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{invite.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{invite.email}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={`text-[11px] ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                            {isExpired
                              ? "Expired"
                              : `Expires ${new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setDeleteTarget({ type: "invite", id: invite.id, name: invite.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) { setInviteError(""); setInviteName(""); setInviteEmail(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an email invitation to join your business. They&apos;ll create a password to access the dashboard.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="space-y-4 py-2">
              {inviteError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{inviteError}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="invite-name">Full Name</Label>
                <Input
                  id="invite-name"
                  placeholder="e.g. John Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="john@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === "member" ? "Remove Team Member" : "Cancel Invitation"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "member"
                ? `Are you sure you want to remove ${deleteTarget.name} from your team? They will lose access to the dashboard immediately.`
                : `Are you sure you want to cancel the invitation for ${deleteTarget?.name}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id });
                }
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleteTarget?.type === "member" ? "Remove" : "Cancel Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
