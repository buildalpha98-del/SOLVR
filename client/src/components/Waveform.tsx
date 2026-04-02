/* ============================================================
   DESIGN: Solvr Brand
   Waveform visualiser — amber bars on navy bg
   Active when isSpeaking=true, idle pulse when active but silent
   ============================================================ */

interface WaveformProps {
  isActive: boolean;
  isSpeaking: boolean;
  className?: string;
}

export function Waveform({ isActive, isSpeaking, className = "" }: WaveformProps) {
  const bars = Array.from({ length: 12 });

  if (!isActive) {
    return (
      <div className={`flex items-center justify-center gap-[3px] ${className}`}>
        {bars.map((_, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-slate-700"
            style={{ height: "4px" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center gap-[3px] ${className}`}>
      {bars.map((_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full origin-center ${
            isSpeaking
              ? "waveform-bar bg-[#F5A623]"
              : "bg-[#F5A623]/40"
          }`}
          style={{
            height: isSpeaking ? "24px" : "6px",
            transition: isSpeaking ? "none" : "height 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}
