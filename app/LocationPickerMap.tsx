"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, History } from "lucide-react";

// --- TYPES ---
interface LocationData {
  id: number;
  lat: number;
  lng: number;
  address: string;
  date: string;
}

interface LocationPickerMapProps {
  locations: LocationData[];
  onSelect: (loc: LocationData) => void;
}

// --- SUB-COMPONENTS ---

// Auto-fit map to show all markers
function FitBounds({ locations }: { locations: LocationData[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [locations, map]);

  return null;
}

export default function LocationPickerMap({
  locations,
  onSelect,
}: LocationPickerMapProps) {
  // Icon configuration
  const markerIcon = useMemo(
    () =>
      L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -32],
      }),
    []
  );

  // If no locations, center on Grobogan/Default
  const defaultCenter: [number, number] =
    locations.length > 0
      ? [locations[0].lat, locations[0].lng]
      : [-7.0268, 110.9227];

  return (
    <div className="h-full w-full relative">
      {/* Legend / Info Overlay */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 dark:bg-neutral-900/90 py-1.5 px-4 rounded-full border border-neutral-200 dark:border-neutral-800 shadow-sm text-xs font-semibold flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-blue-500" />
        <span>Pilih titik dari riwayat pesanan Anda</span>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={markerIcon}>
            <Popup>
              <div className="p-1 max-w-[200px] space-y-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                    {new Date(loc.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs font-medium text-neutral-800 line-clamp-2 leading-relaxed">
                    {loc.address}
                  </p>
                </div>
                <Button
                  onClick={() => onSelect(loc)}
                  size="sm"
                  className="w-full h-8 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1.5" /> GUNAKAN LOKASI
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBounds locations={locations} />
      </MapContainer>
    </div>
  );
}
