import { getSolvrOrigin } from "@/const";
/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalStaff — Staff management page for tradies.
 * Tabs: Team (staff list + PIN management) | Labour Costs (monthly cost report)
 */
import { useState, useMemo } from "react";
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
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import {
  UserCog, Plus, Pencil, Trash2, Phone, Wrench, Hash, DollarSign,
  Users, KeyRound, Link2, Copy, Check, Download, ChevronLeft, ChevronRight,
  TrendingDown, Clock, AlertCircle, Settings2,
} from "lucide-react";
import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Labour Costs Tab ─────────────────────────────────────────────────────────
function LabourCostsTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const { data, isLoading } = trpc.portal.getLabourCostReport.useQuery(
    { year, month },
    { staleTime: 60_000 }
  );

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  const totals = useMemo(() => {
    if (!data?.rows) return { hours: 0, cost: 0, staffWithRate: 0, staffWithoutRate: 0 };
    return data.rows.reduce((acc, r) => ({
      hours: acc.hours + r.totalHours,
      cost: acc.cost + (r.labourCost ?? 0),
      staffWithRate: acc.staffWithRate + (r.hourlyRate ? 1 : 0),
      staffWithoutRate: acc.staffWithoutRate + (!r.hourlyRate ? 1 : 0),
    }), { hours: 0, cost: 0, staffWithRate: 0, staffWithoutRate: 0 });
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-white font-semibold">{MONTH_NAMES[month - 1]} {year}</p>
          {isCurrentMonth && <p className="text-xs" style={{ color: "#F5A623" }}>Current month</p>}
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg transition-colors disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl p-4"
              style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.15)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" style={{ color: "#F5A623" }} />
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Total Hours</span>
              </div>
              <p className="text-2xl font-bold text-white">{totals.hours.toFixed(1)}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>hrs worked</p>
            </div>
            <div
              className="rounded-2xl p-4"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4" style={{ color: "#22c55e" }} />
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Labour Cost</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {totals.cost > 0 ? `$${totals.cost.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                {totals.staffWithoutRate > 0 ? `${totals.staffWithoutRate} staff missing rate` : "all rates set"}
              </p>
            </div>
          </div>

          {/* Missing hourly rate warning */}
          {totals.staffWithoutRate > 0 && (
            <div
              className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                <span className="text-amber-400 font-medium">{totals.staffWithoutRate} staff member{totals.staffWithoutRate > 1 ? "s" : ""}</span> {totals.staffWithoutRate > 1 ? "don't" : "doesn't"} have an hourly rate set.
                Edit their profile to include a rate for accurate cost reporting.
              </p>
            </div>
          )}

          {/* Per-staff breakdown */}
          {data.rows.length === 0 ? (
            <div
              className="rounded-2xl border p-8 text-center"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <TrendingDown className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.2)" }} />
              <p className="text-white font-medium mb-1">No time entries</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                No completed check-ins for {MONTH_NAMES[month - 1]} {year}.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* Table header */}
              <div
                className="grid grid-cols-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}
              >
                <span className="col-span-2">Staff Member</span>
                <span className="text-right">Hours</span>
                <span className="text-right">Cost</span>
              </div>
              {/* Rows */}
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {data.rows.map((row) => (
                  <div
                    key={row.staffId}
                    className="grid grid-cols-4 px-4 py-3 items-center"
                    style={{ background: "rgba(255,255,255,0.01)" }}
                  >
                    <div className="col-span-2 flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                      >
                        {row.staffName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{row.staffName}</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {row.hourlyRate ? `$${row.hourlyRate}/hr` : <span style={{ color: "rgba(245,166,35,0.6)" }}>No rate set</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-semibold">{row.totalHours.toFixed(1)}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{row.entryCount} entries</p>
                    </div>
                    <div className="text-right">
                      {row.labourCost != null ? (
                        <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>
                          ${row.labourCost.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      ) : (
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>—</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Totals footer */}
              <div
                className="grid grid-cols-4 px-4 py-3 border-t"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div className="col-span-2">
                  <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>TOTAL</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-bold">{totals.hours.toFixed(1)}</p>
                </div>
                <div className="text-right">
                  {totals.cost > 0 ? (
                    <p className="text-sm font-bold" style={{ color: "#22c55e" }}>
                      ${totals.cost.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  ) : (
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>—</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            Based on completed check-in/out entries. Partial hours rounded to 2 decimal places.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalStaff() {
  const utils = trpc.useUtils();

  const { data: staffList, isLoading } = trpc.portal.listStaff.useQuery();
  const { data: me } = trpc.portal.me.useQuery();

  const [activeTab, setActiveTab] = useState<"team" | "labour">("team");

  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [pinTarget, setPinTarget] = useState<StaffMember | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const staffLoginUrl = me?.clientId
    ? `${getSolvrOrigin()}/staff?c=${me.clientId}`
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
  // Manage drawer state
  const [manageTarget, setManageTarget] = useState<StaffMember | null>(null);

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
      <div className="sm:max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <UserCog className="w-5 h-5" style={{ color: "#F5A623" }} />
              Staff
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Manage your team and track labour costs.
            </p>
          </div>
          {activeTab === "team" && (
            <div className="flex items-center gap-2">
              {staffLoginUrl && (
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
          )}
        </div>

        {/* Tab switcher */}
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {(["team", "labour"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={activeTab === tab
                ? { background: "#F5A623", color: "#0F1F3D" }
                : { color: "rgba(255,255,255,0.45)" }
              }
            >
              {tab === "team" ? "Team" : "Labour Costs"}
            </button>
          ))}
        </div>

        {/* ── Team Tab ── */}
        {activeTab === "team" && (
          <>
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

                    {/* Single Manage button — opens bottom drawer */}
                    <button
                      onClick={() => setManageTarget(member)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors"
                      style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.25)" }}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Labour Costs Tab ── */}
        {activeTab === "labour" && <LabourCostsTab />}
      </div>

      {/* ── Manage Staff Drawer ─────────────────────────────────────────── */}
      <Drawer open={!!manageTarget} onOpenChange={(open) => { if (!open) setManageTarget(null); }}>
        <DrawerContent style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-white text-base">
              {manageTarget?.name}
            </DrawerTitle>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              {manageTarget?.trade ?? "Staff member"}
            </p>
          </DrawerHeader>
          <div className="px-4 pb-8 space-y-3">
            <button
              onClick={() => { if (manageTarget) openEdit(manageTarget); setManageTarget(null); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Pencil className="w-5 h-5 flex-shrink-0" style={{ color: "#F5A623" }} />
              <div>
                <p className="text-white text-sm font-semibold">Edit Details</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Update name, trade, mobile, hourly rate</p>
              </div>
            </button>
            <button
              onClick={() => { if (manageTarget) { setPinTarget(manageTarget); setPinValue(""); setPinConfirm(""); } setManageTarget(null); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <KeyRound className="w-5 h-5 flex-shrink-0" style={{ color: "#F5A623" }} />
              <div>
                <p className="text-white text-sm font-semibold">Set PIN</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Change the 4-digit PIN this staff member uses to log in</p>
              </div>
            </button>
            <button
              onClick={() => { if (manageTarget) setDeleteTarget(manageTarget); setManageTarget(null); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors"
              style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}
            >
              <Trash2 className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>Remove Staff Member</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>This will remove them from your team permanently</p>
              </div>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

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
              Staff use this PIN to log in at <span className="text-amber-400 font-mono text-xs">solvr.com.au/staff</span>. Use 4–8 digits.
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
