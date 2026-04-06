/**
 * Console Portal Clients — Admin page for managing client portal access.
 *
 * Features:
 * - Table of all active CRM clients with portal status
 * - Generate magic link (copy to clipboard)
 * - Send magic link via email
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
    sessionActive: boolean;
    portalCreatedAt: Date | null;
  };
};

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

export default function ConsolePortalClients() {
  const utils = trpc.useUtils();

  const { data: clients, isLoading, refetch } = trpc.adminPortal.listClients.useQuery();

  const generateLink = trpc.adminPortal.generateMagicLink.useMutation({
    onSuccess: () => utils.adminPortal.listClients.invalidate(),
  });

  const sendLink = trpc.adminPortal.generateMagicLink.useMutation({
    onSuccess: (data) => {
      utils.adminPortal.listClients.invalidate();
      // Open Gmail compose with pre-filled email body
      if (selectedClient) {
        const isResend = selectedClient.portal.hasAccess;
        const subject = encodeURIComponent(
          isResend
            ? `Your Solvr portal access — ${selectedClient.businessName}`
            : `Welcome to your Solvr dashboard — ${selectedClient.businessName}`
        );
        const body = encodeURIComponent(
          `Hi ${selectedClient.contactName},\n\n` +
          (isResend
            ? `Here's your updated access link to your Solvr client portal.`
            : `Your AI Receptionist is live and your client portal is ready.`) +
          `\n\nClick the link below to access your dashboard:\n${data.magicLink}\n\nThis link is unique to you — please don't share it. It gives you access to:\n• Live call logs from your AI Receptionist\n• Job pipeline and booking status\n• Performance metrics and revenue tracking\n• Calendar and upcoming appointments\n\nIf you have any questions, reply to this email or call us on 0400 000 000.\n\nStop doing admin. Start doing work.\n— The Solvr Team\nsolvr.com.au`
        );
        const to = encodeURIComponent(selectedClient.contactEmail ?? "");
        window.open(`https://mail.google.com/mail/?view=cm&to=${to}&su=${subject}&body=${body}`, "_blank");
        toast.success("Gmail compose opened — review and send.");
      }
      setSendDialogOpen(false);
    },
    onError: (err) => {
      toast.error(`Failed to generate link: ${err.message}`);
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
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const baseUrl = window.location.origin;

  const filteredClients = (clients ?? []).filter((c: Client) => {
    const q = searchQuery.toLowerCase();
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      (c.contactEmail?.toLowerCase().includes(q) ?? false)
    );
  });

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

  const packageLabels: Record<string, string> = {
    "setup-only": "Setup Only",
    "setup-monthly": "Starter",
    "full-managed": "Professional",
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-400" />
              Client Portal Access
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Generate and send magic links to give clients access to their Solvr portal.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Stats bar */}
        {clients && (
          <div className="grid grid-cols-3 gap-4">
              {([
              {
                label: "Total Clients",
                value: clients.length,
                color: "text-foreground",
              },
              {
                label: "Portal Access Granted",
                value: clients.filter((c: Client) => c.portal.hasAccess).length,
                color: "text-amber-400",
              },
              {
                label: "Active Sessions",
                value: clients.filter((c: Client) => c.portal.sessionActive).length,
                color: "text-emerald-400",
              },
            ] as { label: string; value: number; color: string }[]).map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-border bg-card p-4"
              >
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
                <TableHead>Business</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Portal Status</TableHead>
                <TableHead>Last Accessed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Loading clients...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {searchQuery ? "No clients match your search." : "No active clients found."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client: Client) => (
                  <TableRow key={client.id} className="hover:bg-muted/20">
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
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          {/* Generate link */}
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

                          {/* Send email */}
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
                            <TooltipContent>
                              {client.contactEmail
                                ? "Send portal access email"
                                : "No email on file"}
                            </TooltipContent>
                          </Tooltip>

                          {/* Revoke */}
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

      {/* Generate Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-amber-400" />
              Magic Link Generated
            </DialogTitle>
            <DialogDescription>
              Share this link with <strong>{selectedClient?.contactName}</strong> at{" "}
              <strong>{selectedClient?.businessName}</strong>. It grants direct access to their
              portal — no password required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={generatedLink ?? ""}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This link is single-use per session. Once the client logs in, a 7-day session cookie
              is set. Generating a new link invalidates the previous one.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedClient) handleSendEmail(selectedClient);
                setLinkDialogOpen(false);
              }}
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              Send via Email
            </Button>
            <Button
              onClick={() => {
                if (generatedLink) window.open(generatedLink, "_blank");
              }}
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
              This will generate a fresh magic link and send it to{" "}
              <strong>{selectedClient?.contactEmail}</strong>. Any existing link will be
              invalidated.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span>{selectedClient?.contactName} &lt;{selectedClient?.contactEmail}&gt;</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subject</span>
              <span>
                {selectedClient?.portal.hasAccess
                  ? `Your Solvr portal access — ${selectedClient?.businessName}`
                  : `Welcome to your Solvr dashboard — ${selectedClient?.businessName}`}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedClient) return;
                sendLink.mutate({
                  clientId: selectedClient.id,
                  baseUrl,
                });
              }}
              disabled={sendLink.isPending}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black"
            >
              <Mail className="w-4 h-4" />
              {sendLink.isPending ? "Sending..." : "Send Email"}
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
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
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
    </DashboardLayout>
  );
}
