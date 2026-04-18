/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { toast } from "sonner";
/**
 * PortalTeamAccept.tsx — Accept a team invite and set password.
 * Public page — no auth required.
 * URL: /portal/team/accept?token=<inviteToken>
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RefreshCw, CheckCircle, AlertCircle, Lock } from "lucide-react";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

export default function PortalTeamAccept() {
  const [, navigate] = useLocation();
  

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const { data: invite, isLoading, error } = trpc.portalTeam.getInvite.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const accept = trpc.portalTeam.acceptInvite.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(() => navigate("/portal/dashboard"), 2000);
    },
    onError: (e) => toast.error("Error", { description: e.message }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password too short", { description: "Minimum 8 characters." });
      return;
    }
    accept.mutate({ token, password });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={LOGO} alt="Solvr" className="h-8 mx-auto mb-2 object-contain" />
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8">
          {!token ? (
            <div className="text-center text-red-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-3" />
              <p className="font-semibold">Invalid invite link</p>
              <p className="text-sm text-slate-500 mt-1">This link is missing a token. Please check your email.</p>
            </div>
          ) : isLoading ? (
            <div className="text-center text-slate-400 py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p>Checking invite...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-3" />
              <p className="font-semibold">Invite not found or expired</p>
              <p className="text-sm text-slate-500 mt-1">Ask your team owner to resend the invite.</p>
            </div>
          ) : done ? (
            <div className="text-center text-green-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3" />
              <p className="font-semibold text-white text-lg">You're in!</p>
              <p className="text-slate-400 text-sm mt-1">Redirecting to your dashboard...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white">Accept your invite</h1>
                <p className="text-slate-400 text-sm mt-1">
                  You've been invited to join <strong className="text-white">{invite?.businessName}</strong> as a{" "}
                  <strong className="text-amber-400">{invite?.role === "admin" ? "Admin" : "Viewer"}</strong>.
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  Hi <strong className="text-slate-300">{invite?.name}</strong> — set a password to access the portal.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300 text-sm">Email</Label>
                  <Input
                    className="mt-1 bg-slate-800 border-slate-600 text-slate-400"
                    value={invite?.email ?? ""}
                    disabled
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Password</Label>
                  <Input
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Confirm password</Label>
                  <Input
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold mt-2"
                  disabled={accept.isPending}
                >
                  {accept.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  Set Password & Join
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
