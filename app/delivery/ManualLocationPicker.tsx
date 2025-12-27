"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, MousePointerClick, X, CheckCircle2 } from "lucide-react";

// Dynamic import untuk menghindari error SSR Leaflet
const InteractiveMap = dynamic(() => import("@/app/InteractiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-neutral-100 dark:bg-neutral-800 animate-pulse flex items-center justify-center text-xs text-neutral-400">
      Memuat Peta...
    </div>
  ),
});

import useSWR from "swr";

interface ManualLocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onSelect: (lat: number, lng: number) => void;
}

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ManualLocationPicker({
  initialLat,
  initialLng,
  onSelect,
}: ManualLocationPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // SWR Hook for Geocoding
  // Only fetch when debouncedQuery is not empty
  const {
    data: searchResults,
    error,
    isLoading,
  } = useSWR(
    debouncedQuery
      ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          debouncedQuery
        )}&limit=1`
      : null,
    fetcher,
    {
      revalidateOnFocus: false, // Don't revalidate on window focus to save requests
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  // Default coordinate (Grobogan) if none provided
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number }>({
    lat: initialLat || -7.0268,
    lng: initialLng || 110.9227,
  });

  const handlePositionChange = useCallback((lat: number, lng: number) => {
    setCurrentPos({ lat, lng });
  }, []);

  // Update position when SWR returns data
  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      const lat = parseFloat(searchResults[0].lat);
      const lng = parseFloat(searchResults[0].lon);
      setCurrentPos({ lat, lng });
    } else if (searchResults && searchResults.length === 0) {
      // Optional: Toast "Lokasi tidak ditemukan"
      alert("Lokasi tidak ditemukan");
    }
    if (error) {
      console.error("Search error:", error);
      alert("Gagal mencari lokasi");
    }
  }, [searchResults, error]);

  const handleSearch = () => {
    if (!searchQuery) return;
    // Trigger SWR fetch by updating the key dependency
    setDebouncedQuery(searchQuery);
  };

  const handleConfirm = () => {
    onSelect(currentPos.lat, currentPos.lng);
    setShowPicker(false);
  };

  return (
    <>
      <Button
        onClick={() => setShowPicker(true)}
        variant="outline"
        className="h-11 px-3 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 dark:text-neutral-300"
        title="Pilih Titik di Peta"
      >
        <MousePointerClick className="h-5 w-5 text-purple-600 dark:text-purple-400" />
      </Button>

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="bg-white dark:bg-neutral-900 w-[95vw] h-[85vh] sm:max-w-3xl sm:rounded-3xl overflow-hidden p-0 flex flex-col fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border border-neutral-200 dark:border-neutral-800">
          <DialogHeader className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex flex-row items-center justify-between shrink-0 bg-white dark:bg-neutral-900">
            <DialogTitle className="text-base font-bold flex items-center gap-3 dark:text-neutral-100">
              <MapPin className="h-5 w-5 text-purple-600" /> Tentukan Titik
              Lokasi
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2 rounded-full dark:text-neutral-400"
              onClick={() => setShowPicker(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>

          {/* Search Bar */}
          <div className="p-3 bg-neutral-100 dark:bg-neutral-950/50 border-b border-neutral-200 dark:border-neutral-800 flex gap-2">
            <input
              type="text"
              placeholder="Cari lokasi (cth: Simpang Lima, Semarang)..."
              className="flex-1 h-10 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-4 shadow-none"
            >
              {isLoading ? "..." : "Cari"}
            </Button>
          </div>

          <div className="flex-1 bg-neutral-100 dark:bg-neutral-950 relative">
            {showPicker && (
              <InteractiveMap
                initialLat={currentPos.lat}
                initialLng={currentPos.lng}
                onPositionChange={handlePositionChange}
              />
            )}
          </div>

          <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[10px] text-neutral-500 bg-neutral-50 dark:bg-neutral-800 p-2 rounded-lg border border-neutral-100 dark:border-neutral-700">
                <span className="font-mono bg-white dark:bg-neutral-900 px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                  {currentPos.lat.toFixed(6)}, {currentPos.lng.toFixed(6)}
                </span>
                <span className="truncate flex-1">
                  Pastikan titik sesuai dengan lokasi pengantaran.
                </span>
              </div>
              <Button
                onClick={handleConfirm}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-10 rounded-xl shadow-none dark:bg-purple-700 dark:hover:bg-purple-600"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Konfirmasi Titik Ini
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}