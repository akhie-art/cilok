"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useMemo, useRef, useEffect } from "react";

interface InteractiveMapProps {
  initialLat: number;
  initialLng: number;
  onPositionChange: (lat: number, lng: number) => void;
}

// Component to handle map view updates
function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 16);
    }
  }, [lat, lng, map]);
  return null;
}

// Komponen untuk menangani event klik pada peta
function LocationMarker({
  position,
  setPosition,
  onPositionChange,
}: {
  position: L.LatLng;
  setPosition: (pos: L.LatLng) => void;
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onPositionChange(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          setPosition(newPos);
          onPositionChange(newPos.lat, newPos.lng);
        }
      },
    }),
    [onPositionChange, setPosition]
  );

  const customIcon = useMemo(
    () =>
      L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
        shadowUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
        shadowSize: [41, 41],
      }),
    []
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={customIcon}
    />
  );
}

export default function InteractiveMap({
  initialLat,
  initialLng,
  onPositionChange,
}: InteractiveMapProps) {
  // Default ke Grobogan jika 0 atau null
  const defaultLat = initialLat || -7.0268;
  const defaultLng = initialLng || 110.9227;

  const [position, setPosition] = useState<L.LatLng>(
    new L.LatLng(defaultLat, defaultLng)
  );

  // Update internal state if props change (e.g. from search)
  useEffect(() => {
    if (initialLat && initialLng) {
      const newPos = new L.LatLng(initialLat, initialLng);
      setPosition(newPos);
    }
  }, [initialLat, initialLng]);

  return (
    <div className="h-full w-full relative group">
      <MapContainer
        center={[defaultLat, defaultLng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater lat={initialLat} lng={initialLng} />
        <LocationMarker
          position={position}
          setPosition={setPosition}
          onPositionChange={onPositionChange}
        />
      </MapContainer>

      {/* Hint Text */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-1000 bg-white/90 dark:bg-neutral-900/90 px-4 py-2 rounded-full shadow-sm border border-neutral-200 dark:border-neutral-800 text-xs font-semibold backdrop-blur-sm pointer-events-none text-center w-max max-w-[90%]">
        <span className="block sm:inline">Klik peta atau geser marker</span>
        <span className="hidden sm:inline"> untuk menentukan titik</span>
      </div>
    </div>
  );
}