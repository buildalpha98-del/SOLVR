import { getSolvrOrigin } from "@/const";
/**
 * Console Portal Clients — Admin page for managing client portal access.
 *
 * Features:
 * - Add New Client (creates CRM record + portal session in one step)
 *   - Auto-send toggle: if checked, opens Gmail compose immediately after creation
 * - Table of all active CRM clients with portal status
 * - Expiry warning badge: amber "Expires in Xd" for sessions expiring within 48 hours
 * - Generate magic link (copy to clipboard)
 * - Send magic link via Gmail compose
 * - Bulk send to selected clients
 * - Email sent timestamp column
 * - Revoke portal access
 * - Status badges: No Access / Link Sent / Active Session
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Link2,
  Mail,
  ShieldOff,
  Copy,
  Check,
  RefreshCw,
  Users,
  ExternalLink,
  Clock,
  Wifi,
  WifiOff,
  UserPlus,
  SendHorizonal,
  AlertTriangle,
  KeyRound,
  FileUser,
  Star,
} from "lucide-react";

type Client = {
  id: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  businessName: string;
  tradeType: string | null;
  stage: string;
  package: string | null;
  mrr: number | null;
  isActive: boolean;
  createdAt: Date;
  portal: {
    hasAccess: boolean;
    accessToken: string | null;
    lastAccessedAt: Date | null;
    lastEmailSentAt: Date | null;
    sessionActive: boolean;
    sessionExpiresAt: Date | null;
    portalCreatedAt: Date | null;
  };
  reviewsSent: number;
};

const packageLabels: Record<string, string> = {
  "setup-only": "Setup Only",
  "setup-monthly": "Starter",
  "full-managed": "Professional",
};

/** Returns hours until expiry, or null if no expiry */
function hoursUntilExpiry(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 ? diff / 3600000 : 0;
}

function PortalStatusBadge({ portal }: { portal: Client["portal"] }) {
  if (!portal.hasAccess) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1">
        <WifiOff className="w-3 h-3" />
        No Access
      </Badge>
    );
  }
  if (portal.sessionActive) {
    const hours = hoursUntilExpiry(portal.sessionExpiresAt);
    // Show expiry warning if session expires within 48 hours
    if (hours !== null && hours <= 48) {
      const days = Math.ceil(hours / 24);
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
            <Wifi className="w-3 h-3" />
            Active Session
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-[10px]">
            <AlertTriangle className="w-2.5 h-2.5" />
            {hours <= 0 ? "Expired" : days <= 1 ? "Expires today" : `Expires in ${days}d`}
          </Badge>
        </div>
      );
    }
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
        <Wifi className="w-3 h-3" />
        Active Session
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1">
      <Link2 className="w-3 h-3" />
      Link Sent
    </Badge>
  );
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function buildGmailUrl(client: Client, magicLink: string): string {
  const isResend = client.portal.hasAccess;
  const subject = encodeURIComponent(
    isResend
      ? `Your Solvr portal access — ${client.businessName}`
      : `Welcome to your Solvr dashboard — ${client.businessName}`
  );
  const body = encodeURIComponent(
    `Hi ${client.contactName},\n\n` +
    (isResend
      ? `Here's your updated access link to your Solvr client portal.`
      : `Your AI Receptionist is live and your client portal is ready.`) +
    `\n\nClick the link below to access your dashboard:\n${magicLink}\n\nThis link is unique to you — please don't share it. It gives you access to:\n• Live call logs from your AI Receptionist\n• Job pipeline and booking status\n• Performance metrics and revenue tracking\n• Calendar and upcoming appointments\n\nIf you have any questions, reply to this email or call us on 0400 000 000.\n\nStop doing admin. Start doing work.\n— The Solvr Team\nsolvr.com.au`
  );
  const to = encodeURIComponent(client.contactEmail ?? "");
  return `https://mail.google.com/mail/?view=cm&to=${to}&su=${subject}&body=${body}`;
}

export default function ConsolePortalClients() {
  const utils = trpc.useUtils();

  const { data: clients, isLoading, refetch } = trpc.adminPortal.listClients.useQuery();

  const generateLink = trpc.adminPortal.generateMagicLink.useMutation({
    onSuccess: () => utils.adminPortal.listClients.invalidate(),
  });

  const sendLink = trpc.adminPortal.generateMagicLink.useMutation({
    onSuccess: (data, variables) => {
      utils.adminPortal.listClients.invalidate();
      const client = (clients ?? []).find((c: Client) => c.id === variables.clientId);
      if (client) {
        window.open(buildGmailUrl(client, data.magicLink), "_blank");
        toast.success("Gmail compose opened — review and send.");
      }
      setSendDialogOpen(false);
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to generate link: ${err.message}`);
    },
  });

  const createClient = trpc.adminPortal.createClientWithPortal.useMutation({
    onSuccess: (data, variables) => {
      utils.adminPortal.listClients.invalidate();
      setAddDialogOpen(false);

      // If auto-send is checked, open Gmail compose immediately
      if (autoSendEmail) {
        // Build a temporary client object for the Gmail URL builder
        const tempClient: Client = {
          id: data.clientId,
          contactName: variables.contactName,
          contactEmail: variables.contactEmail,
          contactPhone: variables.contactPhone ?? null,
          businessName: variables.businessName,
          tradeType: variables.tradeType ?? null,
          stage: "active",
          package: variables.packageType ?? null,
          mrr: null,
          isActive: true,
          createdAt: new Date(),
          portal: {
            hasAccess: false, // brand new client
            accessToken: data.accessToken,
            lastAccessedAt: null,
            lastEmailSentAt: null,
            sessionActive: false,
            sessionExpiresAt: null,
            portalCreatedAt: new Date(),
          },
          reviewsSent: 0,
        };
        window.open(buildGmailUrl(tempClient, data.magicLink), "_blank");
        toast.success("Client created — Gmail compose opened.");
      } else {
        setGeneratedLink(data.magicLink);
        setSelectedClient(null);
        setLinkDialogOpen(true);
        toast.success("Client created — portal access link ready.");
      }

      resetNewClient();
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const revokeAccess = trpc.adminPortal.revokeAccess.useMutation({
    onSuccess: () => {
      utils.adminPortal.listClients.invalidate();
      toast.success("Client portal access has been revoked.");
      setRevokeDialogOpen(false);
    },
  });

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [setPasswordDialogOpen, setSetPasswordDialogOpen] = useState(false);
  const [setPasswordValue, setSetPasswordValue] = useState("");

  // ── Profile modal ──────────────────────────────────────────────────────────
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileClientId, setProfileClientId] = useState<number | null>(null);
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({}); // field → value

  const { data: profileData, isLoading: profileLoading } = trpc.adminPortal.adminGetClientProfile.useQuery(
    { clientId: profileClientId! },
    { enabled: profileClientId !== null && profileDialogOpen }
  );

  const updateProfile = trpc.adminPortal.adminUpdateClientProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated.");
      setProfileDialogOpen(false);
      setProfileDraft({});
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  function openProfileModal(client: Client) {
    setProfileClientId(client.id);
    setProfileDraft({});
    setProfileDialogOpen(true);
  }

  function profileField(key: string, fallback?: string | null): string {
    if (key in profileDraft) return profileDraft[key];
    const val = profileData?.profile?.[key as keyof typeof profileData.profile];
    return val != null ? String(val) : (fallback ?? "");
  }

  function setProfileField(key: string, value: string) {
    setProfileDraft(prev => ({ ...prev, [key]: value }));
  }

  function handleSaveProfile() {
    if (!profileClientId) return;
    const payload: Record<string, string | number | null> = { clientId: profileClientId };
    for (const [k, v] of Object.entries(profileDraft)) {
      const numFields = ["yearsInBusiness", "teamSize", "validityDays"];
      if (numFields.includes(k)) {
        payload[k] = v === "" ? null : Number(v);
      } else {
        payload[k] = v;
      }
    }
    updateProfile.mutate(payload as Parameters<typeof updateProfile.mutate>[0]);
  }

  const adminSetPassword = trpc.adminPortal.adminSetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password set successfully. Client can now log in with email + password.");
      setSetPasswordDialogOpen(false);
      setSetPasswordValue("");
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to set password: ${err.message}`);
    },
  });
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [autoSendEmail, setAutoSendEmail] = useState(true);

  const emptyNewClient = {
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    businessName: "",
    tradeType: "",
    packageType: "setup-monthly" as "setup-only" | "setup-monthly" | "full-managed",
  };
  const [newClient, setNewClient] = useState(emptyNewClient);
  function resetNewClient() {
    setNewClient(emptyNewClient);
  }

  const baseUrl = getSolvrOrigin();

  const filteredClients = (clients ?? []).filter((c: Client) => {
    const q = searchQuery.toLowerCase();
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      (c.contactEmail?.toLowerCase().includes(q) ?? false)
    );
  });

  const clientsWithoutAccess = (clients ?? []).filter((c: Client) => !c.portal.hasAccess);

  const stats = clients
    ? [
        { label: "Total Clients", value: clients.length, color: "text-foreground" },
        { label: "Portal Access", value: clients.filter((c: Client) => c.portal.hasAccess).length, color: "text-amber-400" },
        { label: "Active Sessions", value: clients.filter((c: Client) => c.portal.sessionActive).length, color: "text-emerald-400" },
        { label: "No Access", value: clientsWithoutAccess.length, color: "text-muted-foreground" },
      ]
    : [];

  async function handleGenerateLink(client: Client) {
    setSelectedClient(client);
    const result = await generateLink.mutateAsync({ clientId: client.id, baseUrl });
    setGeneratedLink(result.magicLink);
    setLinkDialogOpen(true);
  }

  async function handleCopyLink() {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Magic link copied to clipboard.");
  }

  function handleSendEmail(client: Client) {
    setSelectedClient(client);
    setSendDialogOpen(true);
  }

  function handleRevoke(client: Client) {
    setSelectedClient(client);
    setRevokeDialogOpen(true);
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map((c: Client) => c.id)));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkSend() {
    const targets = (clients ?? []).filter((c: Client) => selectedIds.has(c.id));
    if (targets.length === 0) return;
    setBulkSending(true);
    let sent = 0;
    for (const client of targets) {
      try {
        const result = await generateLink.mutateAsync({ clientId: client.id, baseUrl });
        window.open(buildGmailUrl(client, result.magicLink), "_blank");
        sent++;
        await new Promise((r) => setTimeout(r, 700));
      } catch {
        toast.error(`Failed for ${client.businessName}`);
      }
    }
    setBulkSending(false);
    setSelectedIds(new Set());
    utils.adminPortal.listClients.invalidate();
    toast.success(`${sent} Gmail compose windows opened.`);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-400" />
              Client Portal Access
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage client portal access — generate magic links, send onboarding emails, and track logins.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            {clientsWithoutAccess.length > 0 && selectedIds.size === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set(clientsWithoutAccess.map((c: Client) => c.id)))}
                className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              >
                <SendHorizonal className="w-4 h-4" />
                Select {clientsWithoutAccess.length} without access
              </Button>
            )}
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={handleBulkSend}
                disabled={bulkSending}
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-black"
              >
                <SendHorizonal className="w-4 h-4" />
                {bulkSending ? "Sending..." : `Send to ${selectedIds.size} clients`}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black"
            >
              <UserPlus className="w-4 h-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Stats */}
        {!isLoading && stats.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <Input
          placeholder="Search by business name, contact, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredClients.length > 0 && selectedIds.size === filteredClients.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Portal Status</TableHead>
                <TableHead>Last Accessed</TableHead>
                <TableHead>Email Sent</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    Loading clients...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    {searchQuery ? "No clients match your search." : "No active clients found. Add your first client above."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client: Client) => (
                  <TableRow
                    key={client.id}
                    className={`hover:bg-muted/20 ${selectedIds.has(client.id) ? "bg-amber-500/5" : ""}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(client.id)}
                        onCheckedChange={() => toggleSelect(client.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{client.businessName}</div>
                      <div className="text-xs text-muted-foreground">{client.tradeType ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{client.contactName}</div>
                      <div className="text-xs text-muted-foreground">{client.contactEmail}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {client.package ? packageLabels[client.package] ?? client.package : "—"}
                      </span>
                      {client.mrr ? (
                        <div className="text-xs text-muted-foreground">
                          ${(client.mrr / 100).toFixed(0)}/mo
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <PortalStatusBadge portal={client.portal} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(client.portal.lastAccessedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {formatRelativeTime(client.portal.lastEmailSentAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.reviewsSent > 0 ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400" />
                          <span className="text-sm font-medium text-amber-400">{client.reviewsSent}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleGenerateLink(client)}
                                disabled={generateLink.isPending}
                              >
                                <Link2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generate magic link</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleSendEmail(client)}
                                disabled={!client.contactEmail}
                              >
                                <Mail className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send access email</TooltipContent>
                          </Tooltip>
                          {client.portal.hasAccess && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleRevoke(client)}
                                >
                                  <ShieldOff className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Revoke access</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => { setSelectedClient(client); setSetPasswordValue(""); setSetPasswordDialogOpen(true); }}
                              >
                                <KeyRound className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Set portal password</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-400 hover:text-blue-300"
                                onClick={() => openProfileModal(client)}
                              >
                                <FileUser className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View / Edit Memory File</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Client Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              Add New Client
            </DialogTitle>
            <DialogDescription>
              Creates a CRM record and generates a portal access link in one step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  placeholder="Thompson Plumbing"
                  value={newClient.businessName}
                  onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tradeType">Trade / Industry</Label>
                <Input
                  id="tradeType"
                  placeholder="Plumber"
                  value={newClient.tradeType}
                  onChange={(e) => setNewClient({ ...newClient, tradeType: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Contact Name *</Label>
              <Input
                id="contactName"
                placeholder="Jake Thompson"
                value={newClient.contactName}
                onChange={(e) => setNewClient({ ...newClient, contactName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Email Address *</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="jake@thompsonplumbing.com.au"
                value={newClient.contactEmail}
                onChange={(e) => setNewClient({ ...newClient, contactEmail: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input
                id="contactPhone"
                placeholder="0412 000 000"
                value={newClient.contactPhone}
                onChange={(e) => setNewClient({ ...newClient, contactPhone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="packageType">Package</Label>
              <Select
                value={newClient.packageType}
                onValueChange={(v) =>
                  setNewClient({ ...newClient, packageType: v as typeof newClient.packageType })
                }
              >
                <SelectTrigger id="packageType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setup-only">Setup Only</SelectItem>
                  <SelectItem value="setup-monthly">Starter ($197/mo)</SelectItem>
                  <SelectItem value="full-managed">Professional ($397/mo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Auto-send toggle */}
            <div className="flex items-center gap-3 pt-1 rounded-lg border border-border bg-muted/20 p-3">
              <Checkbox
                id="autoSend"
                checked={autoSendEmail}
                onCheckedChange={(v) => setAutoSendEmail(!!v)}
              />
              <div>
                <Label htmlFor="autoSend" className="cursor-pointer font-medium text-sm">
                  Send email immediately
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opens Gmail compose pre-filled with the portal access link after creation.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetNewClient(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newClient.contactName || !newClient.contactEmail || !newClient.businessName) {
                  toast.error("Business name, contact name, and email are required.");
                  return;
                }
                createClient.mutate({
                  ...newClient,
                  contactPhone: newClient.contactPhone || undefined,
                  tradeType: newClient.tradeType || undefined,
                  baseUrl,
                });
              }}
              disabled={createClient.isPending}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black"
            >
              <UserPlus className="w-4 h-4" />
              {createClient.isPending
                ? "Creating..."
                : autoSendEmail
                  ? "Create & Send Email"
                  : "Create & Generate Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-amber-400" />
              Portal Access Link
            </DialogTitle>
            <DialogDescription>
              {selectedClient
                ? `Magic link for ${selectedClient.contactName} at ${selectedClient.businessName}.`
                : "Client created — magic link generated below."}
              {" "}This link is single-use per session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={generatedLink ?? ""} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopyLink} className="shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Once the client logs in, a 30-day session cookie is set. Generating a new link invalidates the previous one.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedClient && generatedLink) {
                  window.open(buildGmailUrl(selectedClient, generatedLink), "_blank");
                  toast.success("Gmail compose opened.");
                }
                setLinkDialogOpen(false);
              }}
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              Send via Gmail
            </Button>
            <Button
              onClick={() => { if (generatedLink) window.open(generatedLink, "_blank"); }}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black"
            >
              <ExternalLink className="w-4 h-4" />
              Open Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-400" />
              Send Portal Access Email
            </DialogTitle>
            <DialogDescription>
              Generates a fresh magic link and opens Gmail compose pre-filled for{" "}
              <strong>{selectedClient?.contactEmail}</strong>. Any existing link will be invalidated.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span>{selectedClient?.contactName} &lt;{selectedClient?.contactEmail}&gt;</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subject</span>
              <span className="text-right max-w-[260px] truncate">
                {selectedClient?.portal.hasAccess
                  ? `Your Solvr portal access — ${selectedClient?.businessName}`
                  : `Welcome to your Solvr dashboard — ${selectedClient?.businessName}`}
              </span>
            </div>
            {selectedClient?.portal.lastEmailSentAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last sent</span>
                <span className="text-amber-400">{formatRelativeTime(selectedClient.portal.lastEmailSentAt)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedClient) return;
                sendLink.mutate({ clientId: selectedClient.id, baseUrl });
              }}
              disabled={sendLink.isPending}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black"
            >
              <Mail className="w-4 h-4" />
              {sendLink.isPending ? "Generating..." : "Open Gmail Compose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={setPasswordDialogOpen} onOpenChange={setSetPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              Set Portal Password
            </DialogTitle>
            <DialogDescription>
              Set a password for <strong>{selectedClient?.contactName}</strong> at{" "}
              <strong>{selectedClient?.businessName}</strong>. They will log in with their email and this password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Min. 8 characters"
                value={setPasswordValue}
                onChange={(e) => setSetPasswordValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && selectedClient && setPasswordValue.length >= 8) {
                    adminSetPassword.mutate({ clientId: selectedClient.id, newPassword: setPasswordValue });
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The client's email is <strong>{selectedClient?.contactEmail}</strong>. They can change their password from the portal settings.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetPasswordDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedClient || setPasswordValue.length < 8) {
                  toast.error("Password must be at least 8 characters.");
                  return;
                }
                adminSetPassword.mutate({ clientId: selectedClient.id, newPassword: setPasswordValue });
              }}
              disabled={adminSetPassword.isPending || setPasswordValue.length < 8}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black"
            >
              <KeyRound className="w-4 h-4" />
              {adminSetPassword.isPending ? "Setting..." : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="w-5 h-5 text-destructive" />
              Revoke Portal Access
            </DialogTitle>
            <DialogDescription>
              This will immediately revoke <strong>{selectedClient?.contactName}</strong>'s access
              to the portal. They will need a new magic link to log in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!selectedClient) return;
                revokeAccess.mutate({ clientId: selectedClient.id });
              }}
              disabled={revokeAccess.isPending}
            >
              {revokeAccess.isPending ? "Revoking..." : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / Edit Memory File Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={(open) => { setProfileDialogOpen(open); if (!open) setProfileDraft({}); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUser className="w-5 h-5 text-blue-400" />
              Memory File — {(clients ?? []).find((c: Client) => c.id === profileClientId)?.businessName ?? "Client"}
            </DialogTitle>
            <DialogDescription>
              Edit the AI memory file for this client. Changes are reflected immediately in the voice agent and quote extraction.
            </DialogDescription>
          </DialogHeader>

          {profileLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading profile…</div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Section 1: Business Basics */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Business Basics</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Trading Name</Label>
                    <Input value={profileField("tradingName")} onChange={e => setProfileField("tradingName", e.target.value)} placeholder="Thompson Plumbing" />
                  </div>
                  <div className="space-y-1">
                    <Label>ABN</Label>
                    <Input value={profileField("abn")} onChange={e => setProfileField("abn", e.target.value)} placeholder="12 345 678 901" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={profileField("phone")} onChange={e => setProfileField("phone", e.target.value)} placeholder="0412 345 678" />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={profileField("email")} onChange={e => setProfileField("email", e.target.value)} placeholder="info@business.com.au" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Address</Label>
                    <Input value={profileField("address")} onChange={e => setProfileField("address", e.target.value)} placeholder="123 Main St, Sydney NSW 2000" />
                  </div>
                  <div className="space-y-1">
                    <Label>Website</Label>
                    <Input value={profileField("website")} onChange={e => setProfileField("website", e.target.value)} placeholder="https://business.com.au" />
                  </div>
                  <div className="space-y-1">
                    <Label>Service Area</Label>
                    <Input value={profileField("serviceArea")} onChange={e => setProfileField("serviceArea", e.target.value)} placeholder="Sydney metro, up to 50km" />
                  </div>
                </div>
              </div>

              {/* Section 2: Pricing */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Call-out Fee ($)</Label>
                    <Input type="number" value={profileField("callOutFee")} onChange={e => setProfileField("callOutFee", e.target.value)} placeholder="120" />
                  </div>
                  <div className="space-y-1">
                    <Label>Hourly Rate ($)</Label>
                    <Input type="number" value={profileField("hourlyRate")} onChange={e => setProfileField("hourlyRate", e.target.value)} placeholder="150" />
                  </div>
                  <div className="space-y-1">
                    <Label>Minimum Charge ($)</Label>
                    <Input type="number" value={profileField("minimumCharge")} onChange={e => setProfileField("minimumCharge", e.target.value)} placeholder="200" />
                  </div>
                  <div className="space-y-1">
                    <Label>Payment Terms</Label>
                    <Input value={profileField("paymentTerms")} onChange={e => setProfileField("paymentTerms", e.target.value)} placeholder="14 days" />
                  </div>
                </div>
              </div>

              {/* Section 3: AI Context */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">AI Context (Memory)</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>AI Context Notes</Label>
                    <Textarea
                      rows={3}
                      value={profileField("aiContext")}
                      onChange={e => setProfileField("aiContext", e.target.value)}
                      placeholder="Key things the AI should know about this business…"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Booking Instructions</Label>
                    <Textarea
                      rows={2}
                      value={profileField("bookingInstructions")}
                      onChange={e => setProfileField("bookingInstructions", e.target.value)}
                      placeholder="How customers book: ServiceM8, Tradify, phone…"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Escalation Instructions</Label>
                    <Textarea
                      rows={2}
                      value={profileField("escalationInstructions")}
                      onChange={e => setProfileField("escalationInstructions", e.target.value)}
                      placeholder="When to transfer to owner vs take a message…"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Competitor Notes</Label>
                    <Textarea
                      rows={2}
                      value={profileField("competitorNotes")}
                      onChange={e => setProfileField("competitorNotes", e.target.value)}
                      placeholder="What makes this business different…"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Quote Defaults */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quote Defaults</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Validity (days)</Label>
                    <Input type="number" value={profileField("validityDays")} onChange={e => setProfileField("validityDays", e.target.value)} placeholder="30" />
                  </div>
                  <div className="space-y-1">
                    <Label>Tagline</Label>
                    <Input value={profileField("tagline")} onChange={e => setProfileField("tagline", e.target.value)} placeholder="Quality work, guaranteed." />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Default Quote Notes</Label>
                    <Textarea
                      rows={2}
                      value={profileField("defaultNotes")}
                      onChange={e => setProfileField("defaultNotes", e.target.value)}
                      placeholder="Standard terms, warranty info, etc."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setProfileDialogOpen(false); setProfileDraft({}); }}>Cancel</Button>
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending || Object.keys(profileDraft).length === 0}
            >
              {updateProfile.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
