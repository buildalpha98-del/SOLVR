/**
 * Staff Login — PIN-based authentication for staff members.
 *
 * Flow:
 *  1. Staff enter their clientId (embedded in a QR code / URL param) OR
 *     owner shares a direct link like /staff?c=42
 *  2. Staff see a list of names — tap their name
 *  3. Enter their 4-digit PIN on a numeric keypad
 *  4. Redirect to /staff/today on success
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ChevronLeft, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

export default function StaffLogin() {
  const [, navigate] = useLocation();
  const [clientId, setClientId] = useState<number | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<{ id: number; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"select-name" | "enter-pin">("select-name");

  // Read clientId from URL query param ?c=42
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    if (c && !isNaN(Number(c))) {
      setClientId(Number(c));
    }
  }, []);

  const { data: staffList, isLoading: loadingStaff, error: staffError } = trpc.staffPortal.listStaffNames.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId }
  );

  const loginMutation = trpc.staffPortal.login.useMutation({
    onSuccess: () => {
      toast.success("Welcome! Loading your jobs...");
      setTimeout(() => { window.location.href = "/staff/today"; }, 800);
    },
    onError: (err) => {
      toast.error(err.message || "Incorrect PIN. Try again.");
      setPin("");
    },
  });

  // Check if already logged in
  const { data: me } = trpc.staffPortal.me.useQuery();
  useEffect(() => {
    if (me) {
      window.location.href = "/staff/today";
    }
  }, [me]);

  function handlePinKey(key: string) {
    if (key === "del") {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length >= 4 && selectedStaff) {
      // Auto-submit when 4 digits entered
      setTimeout(() => {
        loginMutation.mutate({ staffId: selectedStaff.id, pin: next });
      }, 200);
    }
  }

  function handleSelectStaff(s: { id: number; name: string }) {
    setSelectedStaff(s);
    setPin("");
    setStep("enter-pin");
  }

  const isLoading = loginMutation.isPending;

  return (
    <div className="min-h-screen bg-[#0F1F3D] flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <img src={LOGO} alt="Solvr" className="h-8 object-contain" />
        <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
          <HardHat size={16} />
          <span>Staff Portal</span>
        </div>
      </div>

      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6">
        {!clientId ? (
          <div className="text-center text-white/60 py-8">
            <p className="text-sm">No business code found.</p>
            <p className="text-xs mt-2 text-white/40">Ask your manager for the staff login link.</p>
          </div>
        ) : step === "select-name" ? (
          <>
            <h1 className="text-white font-semibold text-lg mb-1 text-center">Who are you?</h1>
            <p className="text-white/50 text-sm text-center mb-5">Tap your name to continue</p>

            {loadingStaff && (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-amber-400" size={24} />
              </div>
            )}
            {staffError && (
              <p className="text-red-400 text-sm text-center py-4">{staffError.message}</p>
            )}
            {staffList && staffList.length === 0 && (
              <p className="text-white/50 text-sm text-center py-4">No staff found. Ask your manager to add you.</p>
            )}
            <div className="space-y-2">
              {staffList?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectStaff(s)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white/8 hover:bg-amber-400/20 border border-white/10 hover:border-amber-400/40 transition-all"
                >
                  <span className="text-white font-medium">{s.name}</span>
                  {s.trade && <span className="text-white/40 text-xs ml-2">· {s.trade}</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => { setStep("select-name"); setPin(""); }}
              className="flex items-center gap-1 text-white/50 hover:text-white text-sm mb-4 transition-colors"
            >
              <ChevronLeft size={16} /> Back
            </button>

            <h1 className="text-white font-semibold text-lg mb-1 text-center">
              Hi, {selectedStaff?.name}
            </h1>
            <p className="text-white/50 text-sm text-center mb-6">Enter your PIN</p>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-7">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pin.length > i
                      ? "bg-amber-400 border-amber-400"
                      : "bg-transparent border-white/30"
                  }`}
                />
              ))}
            </div>

            {/* Numeric keypad */}
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-amber-400" size={28} />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {["1","2","3","4","5","6","7","8","9","","0","del"].map((key) => (
                  <button
                    key={key}
                    disabled={!key}
                    onClick={() => key && handlePinKey(key)}
                    className={`
                      h-14 rounded-xl text-lg font-semibold transition-all
                      ${!key ? "invisible" : ""}
                      ${key === "del"
                        ? "bg-white/5 text-white/50 hover:bg-white/10 text-sm"
                        : "bg-white/10 text-white hover:bg-amber-400/20 hover:text-amber-400 active:scale-95"
                      }
                    `}
                  >
                    {key === "del" ? "⌫" : key}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-white/20 text-xs mt-6">Powered by Solvr</p>
    </div>
  );
}
