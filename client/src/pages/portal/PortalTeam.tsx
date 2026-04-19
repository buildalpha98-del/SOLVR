/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
/**
 * PortalTeam.tsx — Multi-staff account management (Sprint 9)
 *
 * Allows the portal owner to:
 *   - View all team members (active + pending)
 *   - Invite a new team member (admin or viewer)
 *   - Change a member's role
 *   - Remove a member
 *   - Resend an invite to a pending member
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  UserPlus,
  Mail,
  Trash2,
  RefreshCw,
  Shield,
  Eye,
  Crown,
  Users,
} from "lucide-react";
import { usePortalRole } from "@/hooks/usePortalRole";
import { ViewerBanner } from "@/components/portal/ViewerBanner";

type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "viewer";
  isActive: boolean;
  createdAt: Date;
};

export default function PortalTeam() {
  const { canWrite } = usePortalRole();
  const utils = trpc.useUtils();

  const { data: members = [], isLoading } = trpc.portalTeam.list.useQuery();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "viewer" as "admin" | "viewer" });

  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  const invite = trpc.portalTeam.invite.useMutation({
    onSuccess: () => {
      toast.success("Invite sent!", { description: `${inviteForm.name} will receive an email with their invite link.` });
      setShowInvite(false);
      setInviteForm({ name: "", email: "", role: "viewer" });
      utils.portalTeam.list.invalidate();
    },
    onError: (e) => toast.error("Invite failed", { description: e.message }),
  });

  const updateRole = trpc.portalTeam.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.portalTeam.list.invalidate();
    },
    onError: (e) => toast.error("Update failed", { description: e.message }),
  });

  const remove = trpc.portalTeam.remove.useMutation({
    onSuccess: () => {
      toast.success("Team member removed");
      setConfirmRemoveId(null);
      utils.portalTeam.list.invalidate();
    },
    onError: (e) => toast.error("Remove failed", { description: e.message }),
  });

  const resendInvite = trpc.portalTeam.resendInvite.useMutation({
    onSuccess: () => { hapticSuccess(); toast.success("Invite resent", { description: "A fresh invite link has been sent." }); },
    onError: (e) => toast.error("Resend failed", { description: e.message }),
  });

  const roleIcon = (role: "admin" | "viewer") =>
    role === "admin" ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />;

  const roleLabel = (role: "admin" | "viewer") =>
    role === "admin" ? "Admin" : "Viewer";

  const roleColor = (role: "admin" | "viewer") =>
    role === "admin"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-blue-500/20 text-blue-300 border-blue-500/30";

  const memberToRemove = members.find((m) => m.id === confirmRemoveId);

  return (
    <PortalLayout>
      <div className="sm:max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-400" />
              Team Members
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Invite your office admin or apprentice to access the portal.
            </p>
          </div>
          <Button
            onClick={() => setShowInvite(true)}
            disabled={!canWrite}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold disabled:opacity-40"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        </div>

        {!canWrite && <ViewerBanner />}

        {/* Pro plan note */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 mb-6 text-sm text-slate-400">
          <span className="text-amber-400 font-semibold">Pro plan</span> — up to 5 team members. Each member gets their own login with a role-based access level.
        </div>

        {/* Member list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-slate-800/40 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No team members yet</p>
            <p className="text-sm mt-1">Invite your office admin or apprentice to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Owner row (you) */}
            <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">You (Owner)</p>
                  <p className="text-slate-500 text-xs">Full access</p>
                </div>
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">Owner</Badge>
            </div>

            {/* Team members */}
            {members.map((member: TeamMember) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-slate-800/40 border border-slate-700 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white font-semibold text-sm uppercase">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm">{member.name}</p>
                      {!member.isActive && (
                        <Badge className="bg-slate-600/60 text-slate-400 border-slate-600 text-xs">Pending</Badge>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role selector */}
                  <Select
                    value={member.role}
                    onValueChange={(val) =>
                      updateRole.mutate({ memberId: member.id, role: val as "admin" | "viewer" })
                    }
                  >
                    <SelectTrigger className={`h-7 text-xs px-2 border rounded-md w-24 ${roleColor(member.role)}`}>
                      <div className="flex items-center gap-1">
                        {roleIcon(member.role)}
                        <SelectValue>{roleLabel(member.role)}</SelectValue>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3 h-3" /> Admin
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-2">
                          <Eye className="w-3 h-3" /> Viewer
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Resend invite (pending only) */}
                  {!member.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-amber-400"
                      title="Resend invite"
                      onClick={() => resendInvite.mutate({ memberId: member.id })}
                      disabled={resendInvite.isPending || !canWrite}
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Remove */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                    title="Remove member"
                    onClick={() => setConfirmRemoveId(member.id)}
                    disabled={!canWrite}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Role guide */}
        <div className="mt-8 bg-slate-800/40 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-300 font-semibold text-sm mb-3">Role permissions</p>
          <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
            <div>
              <div className="flex items-center gap-1 text-amber-300 font-semibold mb-1">
                <Shield className="w-3 h-3" /> Admin
              </div>
              <ul className="space-y-1">
                <li>✓ View & manage jobs</li>
                <li>✓ Create & send quotes</li>
                <li>✓ View customers & invoices</li>
                <li>✗ Change subscription or billing</li>
                <li>✗ Manage team members</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-1 text-blue-300 font-semibold mb-1">
                <Eye className="w-3 h-3" /> Viewer
              </div>
              <ul className="space-y-1">
                <li>✓ View jobs and calendar</li>
                <li>✓ View quotes and invoices</li>
                <li>✗ Create or edit records</li>
                <li>✗ Access financial data</li>
                <li>✗ Manage team members</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white w-[calc(100vw-2rem)] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              Invite Team Member
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              They'll receive an email with a link to set their password and access the portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-300 text-sm">Full name</Label>
              <Input
                className="mt-1 bg-slate-800 border-slate-600 text-white"
                placeholder="e.g. Sarah Johnson"
                value={inviteForm.name}
                onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Email address</Label>
              <Input
                className="mt-1 bg-slate-800 border-slate-600 text-white"
                placeholder="sarah@example.com"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v as "admin" | "viewer" }))}
              >
                <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3" /> Admin — can manage jobs & quotes
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="w-3 h-3" /> Viewer — read-only access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowInvite(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
              onClick={() => invite.mutate(inviteForm)}
              disabled={invite.isPending || !inviteForm.name || !inviteForm.email}
            >
              {invite.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm remove dialog */}
      <Dialog open={confirmRemoveId !== null} onOpenChange={() => setConfirmRemoveId(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white w-[calc(100vw-2rem)] max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription className="text-slate-400">
              {memberToRemove
                ? `${memberToRemove.name} (${memberToRemove.email}) will lose access immediately.`
                : "This member will lose access immediately."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemoveId(null)} className="text-slate-400">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRemoveId && remove.mutate({ memberId: confirmRemoveId })}
              disabled={remove.isPending}
            >
              {remove.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
