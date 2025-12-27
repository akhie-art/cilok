"use client";

import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useCallback } from "react";

interface InteractiveMapProps {
  initialLat: number;
  initialLng: number;
  onPositionChange: (lat: number, lng: number) => void;
}

// Komponen untuk menangani event pergerakan peta
function MapController({
  onMove,
  onMapReady,
}: {
  onMove: (lat: number, lng: number) => void;
  onMapReady: (map: L.Map) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMove(center.lat, center.lng);
    },
    dragend: () => {
      const center = map.getCenter();
      onMove(center.lat, center.lng);
    },
    zoomend: () => {
      const center = map.getCenter();
      onMove(center.lat, center.lng);
    },
  });

  useEffect(() => {
    onMapReady(map);
    // Panggil onMove sekali saat init untuk set posisi awal yang akurat
    const center = map.getCenter();
    onMove(center.lat, center.lng);
  }, [map, onMove, onMapReady]);

  return null;
}

export default function InteractiveMap({
  initialLat,
  initialLng,
  onPositionChange,
}: InteractiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  // Default ke Grobogan jika 0 atau null, tapi logic ini biasanya di handle parent
  const centerLat = initialLat || -7.0268;
  const centerLng = initialLng || 110.9227;

  return (
    <div className="h-full w-full relative group">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController onMove={onPositionChange} onMapReady={handleMapReady} />
      </MapContainer>

      {/* Center Pin Overlay - Fixed at center of container */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-1000 pointer-events-none pb-5.25">
        {/* Menggunakan Icon custom atau Lucide */}
        <div className="relative">
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-1.5 bg-black/20 rounded-[50%] blur-[2px]"></div>
          <img
            src="https://cdn-icons-png.flaticon.com/512/684/684908.png"
            alt="Center Pin"
            className="w-10 h-10 drop-shadow-md animate-bounce"
            style={{ animationIterationCount: 1 }}
          />
        </div>
      </div>

      {/* Hint Text */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-1000 bg-white/90 dark:bg-neutral-900/90 px-4 py-2 rounded-full shadow-sm border border-neutral-200 dark:border-neutral-800 text-xs font-semibold backdrop-blur-sm pointer-events-none">
        Geser peta untuk menentukan titik
      </div>
    </div>
  );
}
