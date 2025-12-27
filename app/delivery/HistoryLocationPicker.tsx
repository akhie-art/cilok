"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, History, X } from "lucide-react";

// Dynamic import for the Map component to avoid SSR issues
const LocationPickerMap = dynamic(() => import("@/app/LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-neutral-100 dark:bg-neutral-800 animate-pulse flex items-center justify-center text-xs text-neutral-400">
      Memuat Peta Riwayat...
    </div>
  ),
});

interface HistoryLocationPickerProps {
  myOrders: any[];
  onSelect: (lat: number, lng: number, address: string) => void;
}

export default function HistoryLocationPicker({
  myOrders,
  onSelect,
}: HistoryLocationPickerProps) {
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Filter unique locations from history
  const historyLocations = useMemo(() => {
    const locs = myOrders
      .filter((o) => o.latitude && o.longitude)
      .map((o) => ({
        id: o.id,
        lat: o.latitude,
        lng: o.longitude,
        address: o.alamat_detail,
        date: o.created_at,
      }));

    // Deduplicate by loose lat/lng (rounding) to avoid clutter
    const unique: typeof locs = [];
    const seen = new Set();
    locs.forEach((l) => {
      const key = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(l);
      }
    });
    return unique;
  }, [myOrders]);

  const handleSelect = (loc: any) => {
    onSelect(loc.lat, loc.lng, loc.address);
    setShowLocationPicker(false);
  };

  if (historyLocations.length === 0) return null;

  return (
    <>
      <Button
        onClick={() => setShowLocationPicker(true)}
        variant="outline"
        className="h-11 px-3 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 dark:text-neutral-300"
        title="Pilih dari Riwayat Pesanan"
      >
        <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </Button>

      <Dialog open={showLocationPicker} onOpenChange={setShowLocationPicker}>
        <DialogContent className="bg-white dark:bg-neutral-900 w-[95vw] h-[80vh] sm:max-w-3xl sm:rounded-3xl overflow-hidden p-0 flex flex-col fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border border-neutral-200 dark:border-neutral-800">
          <DialogHeader className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex flex-col gap-3 shrink-0 bg-white dark:bg-neutral-900">
            <div className="flex flex-row items-center justify-between w-full">
              <DialogTitle className="text-base font-bold flex items-center gap-3 dark:text-neutral-100">
                <MapPin className="h-5 w-5 text-blue-600" /> Pilih dari Riwayat
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 rounded-full dark:text-neutral-400"
                onClick={() => setShowLocationPicker(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* View Toggles */}
            <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg w-full">
              <button
                onClick={() => setViewMode("list")}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                }`}
              >
                Daftar Lokasi
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${
                  viewMode === "map"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                }`}
              >
                Peta Sebaran
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 bg-neutral-50 dark:bg-neutral-950 relative overflow-hidden flex flex-col">
            {viewMode === "list" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {historyLocations.map((loc) => (
                  <div
                    key={loc.id}
                    onClick={() => handleSelect(loc)}
                    className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all group shadow-sm hover:shadow-md"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2">
                        {loc.address || "Alamat tidak tersedia"}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                          {new Date(loc.date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Pilih Lokasi &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <LocationPickerMap
                locations={historyLocations}
                onSelect={handleSelect}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}