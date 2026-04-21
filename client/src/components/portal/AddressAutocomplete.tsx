/**
 * AddressAutocomplete — Google Places Autocomplete for Australian addresses.
 * Uses the Manus Maps proxy (same as Map.tsx) so no API key is needed from the user.
 * Falls back to a plain text input if the script fails to load.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { loadMapScript } from "@/components/Map";
import { MapPin } from "lucide-react";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing an address…",
  className = "",
  style,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);

  const initAutocomplete = useCallback(async () => {
    try {
      await loadMapScript();
      if (!inputRef.current || !window.google?.maps?.places) return;

      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "au" },
        types: ["address"],
        fields: ["formatted_address", "geometry"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place?.formatted_address) {
          onChange(place.formatted_address);
        }
      });

      autocompleteRef.current = ac;
      setReady(true);
    } catch {
      // Script failed — plain input still works
      console.warn("Google Places autocomplete unavailable");
    }
  }, [onChange]);

  useEffect(() => {
    initAutocomplete();
    return () => {
      // Clean up pac-container elements Google injects into the DOM
      document.querySelectorAll(".pac-container").forEach(el => el.remove());
    };
  }, [initAutocomplete]);

  return (
    <div className="relative">
      <MapPin
        className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        style={{ color: ready ? "#F5A623" : "rgba(255,255,255,0.3)" }}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none ${className}`}
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          ...style,
        }}
      />
    </div>
  );
}
