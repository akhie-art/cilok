"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";

// Icons will be initialized inside the component to avoid SSR issues

// Fungsi agar kamera peta mengikuti pergerakan kurir secara otomatis
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

export default function OrderMap({
  userLat,
  userLng,
  kurirLat,
  kurirLng,
}: {
  userLat: number;
  userLng: number;
  kurirLat: number;
  kurirLng: number;
}) {
  const kurirIcon = useMemo(
    () =>
      L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
        iconSize: [35, 35],
        iconAnchor: [17, 35],
      }),
    []
  );

  const userIcon = useMemo(
    () =>
      L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      }),
    []
  );

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[kurirLat, kurirLng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[kurirLat, kurirLng]} icon={kurirIcon}>
          <Popup>Lokasi Kurir</Popup>
        </Marker>
        <Marker position={[userLat, userLng]} icon={userIcon}>
          <Popup>Lokasi Anda</Popup>
        </Marker>
        <RecenterMap lat={kurirLat} lng={kurirLng} />
      </MapContainer>
    </div>
  );
}
