/**
 * PortalStaff — Staff management page for tradies.
 * Add, edit, and deactivate staff members. Each staff member can be
 * assigned to job schedule entries and check in/out via GPS.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserCog, Plus, Pencil, Trash2, Phone, Wrench, Hash, DollarSign, Users, KeyRound, Link2, Copy, Check, Download, Calendar } from "lucide-react";
import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type StaffMember = {
  id: number;
  name: string;
  mobile: string | null;
  trade: string | null;
  licenceNumber: string | null;
  hourlyRate: string | null;
  isActive: boolean;
};

type StaffFormData = {
  name: string;
  mobile: string;
  trade: string;
  licenceNumber: string;
  hourlyRate: string;
};

const emptyForm: StaffFormData = {
  name: "",
  mobile: "",
  trade: "",
  licenceNumber: "",
  hourlyRate: "",
};

export default function PortalStaff() {
  const utils = trpc.useUtils();

  const { data: staffList, isLoading } = trpc.portal.listStaff.useQuery();
  const { data: me } = trpc.portal.me.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [pinTarget, setPinTarget] = useState<StaffMember | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const staffLoginUrl = me?.clientId
    ? `${window.location.origin}/staff?c=${me.clientId}`
    : null;

  function copyStaffLink() {
    if (!staffLoginUrl) return;
    navigator.clipboard.writeText(staffLoginUrl).then(() => {
      setCopied(true);
      toast.success("Staff login link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }
  const [pinConfirm, setPinConfirm] = useState("");

  // Timesheet export state
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportEnabled, setExportEnabled] = useState(false);

  const { data: timesheetData, isFetching: exportLoading } = trpc.portal.exportTimesheets.useQuery(
    { from: exportFrom, to: exportTo },
    { enabled: exportEnabled }
  );

  // Trigger CSV download when data arrives
  useEffect(() => {
    if (!exportEnabled || !timesheetData?.csv) return;
    setExportEnabled(false);
    if (timesheetData.count === 0) {
      toast.info("No time entries found for the selected period.");
      return;
    }
    const blob = new Blob([timesheetData.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheets-${exportFrom}-to-${exportTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${timesheetData.count} time entries.`);
  }, [timesheetData, exportEnabled]);

  function handleExport() {
    if (!exportFrom || !exportTo) { toast.error("Please select a date range."); return; }
    setExportEnabled(true);
    setShowExport(false);
    toast.info("Generating timesheet CSV…");
  }

  const createMutation = trpc.portal.createStaff.useMutation({
    onSuccess: () => {
      utils.portal.listStaff.invalidate();
      setShowForm(false);
      setForm(emptyForm);
      toast.success(`${form.name} has been added to your team.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.portal.updateStaff.useMutation({
    onSuccess: () => {
      utils.portal.listStaff.invalidate();
      setEditingStaff(null);
      setForm(emptyForm);
      toast.success("Staff member updated.");
    },
    onError: (err) => toast.error(err.message),
  });

  const setPinMutation = trpc.portal.setStaffPin.useMutation({
    onSuccess: () => {
      setPinTarget(null);
      setPinValue("");
      setPinConfirm("");
      toast.success("PIN set successfully.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.portal.deleteStaff.useMutation({
    onSuccess: () => {
      utils.portal.listStaff.invalidate();
      setDeleteTarget(null);
      toast.success("Staff member removed.");
    },
    onError: (err) => toast.error(err.message),
  });

  function openCreate() {
    setEditingStaff(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(member: StaffMember) {
    setEditingStaff(member);
    setForm({
      name: member.name,
      mobile: member.mobile ?? "",
      trade: member.trade ?? "",
      licenceNumber: member.licenceNumber ?? "",
      hourlyRate: member.hourlyRate ?? "",
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const hourlyRate = form.hourlyRate ? parseFloat(form.hourlyRate) : undefined;
    if (form.hourlyRate && isNaN(hourlyRate!)) {
      toast.error("Hourly rate must be a number.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      mobile: form.mobile.trim() || undefined,
      trade: form.trade.trim() || undefined,
      licenceNumber: form.licenceNumber.trim() || undefined,
      hourlyRate,
    };
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <PortalLayout activeTab="staff">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <UserCog className="w-5 h-5" style={{ color: "#F5A623" }} />
              Staff
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Manage your team members — assign them to jobs and track their hours.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {staffLoginUrl && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowQr(true)}
                  style={{ color: "rgba(245,166,35,0.8)", border: "1px solid rgba(245,166,35,0.3)" }}
                  title="Staff Login QR Code"
                >
                  <Link2 className="w-4 h-4 mr-1" />
                  Staff Link
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowExport(true)}
              style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}
              title="Export Timesheets"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={openCreate}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Staff
            </Button>
          </div>
        </div>

        {/* Staff list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
          </div>
        ) : !staffList || staffList.length === 0 ? (
          <div
            className="rounded-2xl border p-10 text-center"
            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="text-white font-medium mb-1">No staff members yet</p>
            <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              Add your first team member to start scheduling and tracking hours.
            </p>
            <Button
              size="sm"
              onClick={openCreate}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add First Staff Member
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {staffList.map((member) => (
              <div
                key={member.id}
                className="rounded-2xl border p-4 flex items-center gap-4"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{member.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {member.trade && (
                      <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                        <Wrench className="w-3 h-3" /> {member.trade}
                      </span>
                    )}
                    {member.mobile && (
                      <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                        <Phone className="w-3 h-3" /> {member.mobile}
                      </span>
                    )}
                    {member.licenceNumber && (
                      <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                        <Hash className="w-3 h-3" /> {member.licenceNumber}
                      </span>
                    )}
                    {member.hourlyRate && (
                      <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                        <DollarSign className="w-3 h-3" /> ${member.hourlyRate}/hr
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setPinTarget(member); setPinValue(""); setPinConfirm(""); }}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: "rgba(245,166,35,0.6)" }}
                    title="Set Staff PIN"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(member)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(member)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: "rgba(255,100,100,0.5)" }}
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingStaff(null); setForm(emptyForm); } }}>
        <DialogContent style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "white" }}>
              {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Full Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Jake Smith"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Mobile</Label>
                <Input
                  value={form.mobile}
                  onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))}
                  placeholder="04xx xxx xxx"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Trade</Label>
                <Input
                  value={form.trade}
                  onChange={(e) => setForm(f => ({ ...f, trade: e.target.value }))}
                  placeholder="e.g. Plumber"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Licence Number</Label>
                <Input
                  value={form.licenceNumber}
                  onChange={(e) => setForm(f => ({ ...f, licenceNumber: e.target.value }))}
                  placeholder="e.g. PL12345"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Hourly Rate ($)</Label>
                <Input
                  value={form.hourlyRate}
                  onChange={(e) => setForm(f => ({ ...f, hourlyRate: e.target.value }))}
                  placeholder="e.g. 45"
                  type="number"
                  min="0"
                  step="0.50"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setShowForm(false); setEditingStaff(null); setForm(emptyForm); }}
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingStaff ? "Save Changes" : "Add Staff Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Login Link / QR Code Dialog */}
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "white" }}>Staff Login Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 flex flex-col items-center">
            <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
              Share this link or QR code with your staff. They select their name and enter their PIN to log in.
            </p>
            {staffLoginUrl && (
              <div className="p-3 rounded-xl" style={{ background: "white" }}>
                <QRCodeSVG value={staffLoginUrl} size={180} />
              </div>
            )}
            <div
              className="w-full rounded-lg px-3 py-2 text-xs font-mono break-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {staffLoginUrl}
            </div>
            <Button
              onClick={copyStaffLink}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold w-full"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            {/* Web Share API — shows native iOS share sheet (iMessage, WhatsApp, AirDrop etc.) */}
            {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
              <Button
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: "Staff Login — Solvr",
                      text: "Tap the link to log in to your Solvr staff portal.",
                      url: staffLoginUrl ?? "",
                    });
                  } catch (e) {
                    // User cancelled share — not an error
                    if (e instanceof Error && e.name !== "AbortError") {
                      toast.error("Share failed — try copying the link instead.");
                    }
                  }
                }}
                variant="outline"
                className="w-full font-semibold"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "white", background: "transparent" }}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Share via iMessage / WhatsApp
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Timesheets Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "white" }} className="flex items-center gap-2">
              <Download className="w-4 h-4" style={{ color: "#F5A623" }} />
              Export Timesheets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Download a CSV of all staff check-in/out records for the selected date range. Ready for payroll.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>From</Label>
                <Input
                  type="date"
                  value={exportFrom}
                  onChange={e => setExportFrom(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>To</Label>
                <Input
                  type="date"
                  value={exportTo}
                  onChange={e => setExportTo(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Columns: Staff Name, Job, Date, Check-in, Check-out, Duration (mins), Duration (hrs), Check-in GPS, Check-out GPS
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowExport(false)} style={{ color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
            <Button
              onClick={handleExport}
              disabled={exportLoading}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold"
            >
              {exportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {exportLoading ? "Generating…" : "Download CSV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set PIN Dialog */}
      <Dialog open={!!pinTarget} onOpenChange={(open) => { if (!open) { setPinTarget(null); setPinValue(""); setPinConfirm(""); } }}>
        <DialogContent style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "white" }}>
              Set PIN — {pinTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Staff use this PIN to log in at <span className="text-amber-400 font-mono text-xs">solvr.com.au/staff?c={/* clientId */}</span>.
              Use 4–8 digits.
            </p>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>New PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 1234"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Confirm PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="Re-enter PIN"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
              />
            </div>
            {pinValue && pinConfirm && pinValue !== pinConfirm && (
              <p className="text-red-400 text-xs">PINs don't match.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setPinTarget(null); setPinValue(""); setPinConfirm(""); }}
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => pinTarget && setPinMutation.mutate({ id: pinTarget.id, pin: pinValue })}
              disabled={!pinValue || pinValue.length < 4 || pinValue !== pinConfirm || setPinMutation.isPending}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold"
            >
              {setPinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "white" }}>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
              This will deactivate them from your team. Their historical time entries will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              style={{ background: "#ef4444", color: "white" }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
