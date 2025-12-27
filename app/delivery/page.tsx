"use client";

// --- KONFIGURASI BUILD ---
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient, PostgrestError } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamicImport from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HistoryLocationPicker from "./HistoryLocationPicker";
import ManualLocationPicker from "./ManualLocationPicker";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MapPin,
  Loader2,
  CheckCircle2,
  Save,
  Search,
  Plus,
  Minus,
  ChevronDown,
  LogOut,
  Lock,
  History,
  ShoppingBag,
  Bike,
  ExternalLink,
  Trash2,
  Utensils,
  Sun,
  Moon,
  X,
  CreditCard,
  Banknote,
  UploadCloud,
  Image as ImageIcon,
  Clock,
  Navigation,
  Timer,
  XCircle,
  Package,
  ThumbsUp,
} from "lucide-react";
import { toast, Toaster } from "sonner";

// Load Map secara dinamis (Client-side Only) agar tidak error SSR
const OrderMap = dynamicImport(() => import("@/app/OrderMap"), {
  ssr: false,
  loading: () => (
    <div className="h-48 w-full bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl flex items-center justify-center text-xs text-neutral-400">
      Memuat Peta...
    </div>
  ),
});

// --- INITIALIZATION ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- TYPES / INTERFACES ---
interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface CartItem extends Product {
  qty: number;
}

interface DeliveryForm {
  nama: string;
  telepon: string;
  alamat_detail: string;
  lat: number | null;
  lng: number | null;
  googleMapUrl: string;
  paymentMethod: "COD" | "TRANSFER";
  buktiTransferUrl?: string;
}

interface UserSession {
  name: string;
  phone: string; // Menggunakan phone sesuai sistem login baru
  role?: string;
}

interface MyOrder {
  id: number;
  created_at: string;
  nama: string;
  telepon: string;
  alamat_detail: string;
  latitude: number;
  longitude: number;
  kurir_lat?: number | null;
  kurir_lng?: number | null;
  google_map_url: string;
  items: CartItem[];
  subtotal: number;
  ongkir: number;
  total_bayar: number;
  status:
    | "menunggu"
    | "diterima"
    | "diproses"
    | "dikirim"
    | "selesai"
    | "ditolak";
  metode_pembayaran: string;
  gambar: string | null;
}

// --- DATA PRODUK ---
const products: Product[] = [
  { id: 1, name: "Cilok Ayam Suwir", price: 7000, category: "Premium" },
];

const categories = ["Semua", ...new Set(products.map((p) => p.category))];

export default function DeliveryPage() {
  const router = useRouter();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [user, setUser] = useState<UserSession | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // --- FORM STATE ---
  const [form, setForm] = useState<DeliveryForm>({
    nama: "",
    telepon: "",
    alamat_detail: "",
    lat: null,
    lng: null,
    googleMapUrl: "",
    paymentMethod: "COD",
  });

  // --- THEME LOGIC ---
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
  };

  // --- PERBAIKAN: AUTO-FILL SESSION LOGIC ---
  useEffect(() => {
    const sessionStr = localStorage.getItem("user_session");
    if (sessionStr) {
      try {
        const userData = JSON.parse(sessionStr);
        setUser(userData);
        // Mengisi otomatis form dari data session agar Nama dan WhatsApp terisi
        setForm((prev) => ({
          ...prev,
          nama: userData.name || "",
          telepon: userData.phone || "",
        }));
      } catch (e) {
        console.error("Gagal parse session", e);
      }
    }
  }, []);

  const parseOrderItems = (order: any): MyOrder => {
    let parsedItems: CartItem[] = [];
    if (typeof order.items === "string") {
      try {
        parsedItems = JSON.parse(order.items);
      } catch {
        parsedItems = [];
      }
    } else if (Array.isArray(order.items)) {
      parsedItems = order.items;
    } else {
      parsedItems = [order.items] as unknown as CartItem[];
    }
    return { ...order, items: parsedItems } as MyOrder;
  };

  const loadMyOrders = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("nama", user.name)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Gagal load history:", error);
      return;
    }

    if (data) {
      const parsedOrders = data.map(parseOrderItems);
      setMyOrders(parsedOrders);
    }
  }, [user]);

  // --- REALTIME & POLLING LOGIC ---
  useEffect(() => {
    if (!user) return;

    loadMyOrders();

    const channel = supabase
      .channel("realtime-orders")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deliveries",
          filter: `nama=eq.${user.name}`,
        },
        (payload) => {
          const updatedOrder = parseOrderItems(payload.new);
          setMyOrders((prev) =>
            prev.map((order) =>
              order.id === updatedOrder.id ? updatedOrder : order
            )
          );

          if (payload.old.status !== payload.new.status) {
            toast.info(
              `Status Pesanan #${
                payload.new.id
              }: ${payload.new.status.toUpperCase()}`
            );
          }
        }
      )
      .subscribe();

    const interval = setInterval(loadMyOrders, 7000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, loadMyOrders]);

  // --- CALCULATIONS ---
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const ongkir = 5000;
  const total = subtotal + (cart.length > 0 ? ongkir : 0);

  const handleLogout = () => {
    localStorage.removeItem("user_session");
    toast.success("Berhasil Keluar");
    setUser(null);
    router.push("/login");
  };

  // --- CART ACTIONS ---
  const addToCart = (product: Product) => {
    if (!user) {
      toast.error("Akses Dibatasi", {
        description: "Silakan login terlebih dahulu untuk memesan.",
        icon: <Lock className="h-4 w-4" />,
        action: { label: "Login", onClick: () => router.push("/login") },
      });
      return;
    }

    setCart((prev) => {
      const found = prev.find((p) => p.id === product.id);
      toast.success(
        found ? `${product.name} +1` : `${product.name} masuk keranjang`,
        {
          duration: 1500,
          icon: (
            <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 p-1 rounded-full">
              <Plus className="h-3 w-3" />
            </div>
          ),
        }
      );
      if (found)
        return prev.map((p) =>
          p.id === product.id ? { ...p, qty: p.qty + 1 } : p
        );
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((p) => {
          if (p.id === id) {
            const newQty = p.qty + delta;
            return newQty > 0 ? { ...p, qty: newQty } : p;
          }
          return p;
        })
        .filter((p) => p.qty > 0)
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    toast.info("Item dihapus", { duration: 1000 });
  };

  // --- LOCATION LOGIC ---
  const handleGetLocation = () => {
    if (!navigator.geolocation)
      return toast.error("Browser tidak mendukung Geolocation");
    setLoadingLoc(true);

    const successCallback = (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

      setForm((prev) => ({ ...prev, lat, lng, googleMapUrl: mapUrl }));
      setLoadingLoc(false);
      toast.success("Lokasi Terkunci", {
        icon: <MapPin className="h-4 w-4 text-green-600" />,
      });
    };

    const errorCallback = (
      error: GeolocationPositionError,
      isHighAccuracy: boolean
    ) => {
      if (isHighAccuracy) {
        // Retry with low accuracy
        toast.info("Mencoba mode hemat daya...", { duration: 2000 });
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (err) => errorCallback(err, false),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
        );
        return;
      }

      setLoadingLoc(false);
      console.error(error);
      let msg = "Gagal mengambil lokasi";
      if (error.code === 1) msg = "Izin lokasi ditolak";
      if (error.code === 2) msg = "Sinyal GPS lemah / tidak tersedia";
      if (error.code === 3) msg = "Waktu habis (Timeout)";

      toast.error(msg, {
        description: "Coba refresh atau pindah ke area terbuka.",
      });
    };

    // First attempt: High Accuracy
    navigator.geolocation.getCurrentPosition(
      successCallback,
      (err) => errorCallback(err, true),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // --- PAYMENT UPLOAD ---
  const handleUploadBukti = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `bukti-pembayaran/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("buktiQris")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("buktiQris")
        .getPublicUrl(filePath);
      setForm((prev) => ({ ...prev, buktiTransferUrl: data.publicUrl }));
      toast.success("Bukti transfer berhasil diunggah");
    } catch {
      toast.error("Gagal upload");
    } finally {
      setUploading(false);
    }
  };

  // --- ORDER SUBMISSION ---
  const handleSubmit = async () => {
    if (!user) return router.push("/login");
    if (cart.length === 0) return toast.error("Keranjang masih kosong!");
    if (!form.nama || !form.telepon || !form.lat)
      return toast.error("Data belum lengkap", {
        description: "Mohon isi Nama, WA, dan Kunci Lokasi GPS.",
      });

    if (form.paymentMethod === "TRANSFER" && !form.buktiTransferUrl) {
      return toast.error("Bukti transfer belum diunggah!");
    }

    setSending(true);
    try {
      const { error } = await supabase.from("deliveries").insert([
        {
          nama: form.nama,
          telepon: form.telepon,
          alamat_detail: form.alamat_detail,
          latitude: form.lat,
          longitude: form.lng,
          google_map_url: form.googleMapUrl,
          items: cart,
          subtotal: subtotal,
          ongkir: ongkir,
          total_bayar: total,
          status: "menunggu",
          metode_pembayaran: form.paymentMethod.toLowerCase(),
          gambar: form.buktiTransferUrl || null,
        },
      ]);

      if (error) throw error;
      toast.success("Pesanan Terkirim!", {
        description: "Resto akan segera mengkonfirmasi via WhatsApp.",
        duration: 5000,
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      });
      setCart([]);
      setForm((prev) => ({
        ...prev,
        alamat_detail: "",
        lat: null,
        lng: null,
        googleMapUrl: "",
        buktiTransferUrl: undefined,
        paymentMethod: "COD",
      }));
      setShowCheckoutModal(false);
      loadMyOrders();
      setShowHistoryModal(true);
    } catch (error: unknown) {
      const err = error as PostgrestError;
      toast.error("Gagal Memproses", {
        description: err.message || "Terjadi kesalahan",
      });
    } finally {
      setSending(false);
    }
  };

  // --- STYLE CONSTANTS (ORIGINAL UI) ---
  const glassEffect = {
    WebkitBackdropFilter: "blur(16px)",
    backdropFilter: "blur(16px)",
  };
  const inputBase =
    "bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-neutral-900 dark:focus:border-neutral-700 focus:ring-0 transition-colors placeholder:text-neutral-400 dark:text-neutral-100";

  // --- CART RENDERER (ORIGINAL UI) ---
  const renderCartContent = () => (
    <>
      <div className="flex-1 min-h-0 bg-white dark:bg-neutral-900 relative flex flex-col">
        <ScrollArea className="h-full w-full overscroll-contain">
          <div className="flex flex-col p-4 lg:p-5 pb-10">
            {cart.length > 0 ? (
              <div className="space-y-0 divide-y divide-neutral-100 dark:divide-neutral-800 bg-neutral-50/30 dark:bg-neutral-950/30 rounded-xl mb-6">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start py-3 px-3 text-xs group"
                  >
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center justify-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 overflow-hidden h-fit">
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="w-6 py-0.5 text-center font-bold text-[10px] bg-neutral-50 dark:bg-neutral-950 tabular-nums dark:text-neutral-200">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex flex-col pt-0.5">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm line-clamp-1">
                          {item.name}
                        </span>
                        <span
                          className="text-[10px] text-neutral-400 dark:text-neutral-500"
                          suppressHydrationWarning
                        >
                          @ {item.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className="font-semibold text-neutral-900 dark:text-white"
                        suppressHydrationWarning
                      >
                        {(item.price * item.qty).toLocaleString()}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-[10px] text-neutral-400 dark:text-neutral-600 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-neutral-400 dark:text-neutral-600 text-xs italic">
                Keranjang masih kosong
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-500 ml-1">
                    Nama Penerima
                  </label>
                  <Input
                    placeholder="Nama Anda"
                    className={`h-10 text-xs ${inputBase}`}
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-500 ml-1">
                    WhatsApp
                  </label>
                  <Input
                    type="tel"
                    placeholder="Contoh: 0812345678"
                    className={`h-10 text-xs ${inputBase}`}
                    value={form.telepon}
                    onChange={(e) =>
                      setForm({ ...form, telepon: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-500">
                    Lokasi GPS
                  </label>
                  {form.lat && (
                    <span className="text-[10px] text-green-600 dark:text-green-500 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="h-3 w-3" /> Terkunci
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleGetLocation}
                    disabled={loadingLoc}
                    variant="outline"
                    className={`flex-1 h-11 text-xs justify-between border-dashed transition-all ${
                      form.lat
                        ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800"
                        : "border-neutral-300 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    } border`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {loadingLoc ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                      {form.lat ? "Lokasi Terkunci" : "Ambil GPS"}
                    </span>
                    {form.lat ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                    ) : (
                      <span className="text-[10px] bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded font-bold dark:text-neutral-300">
                        WAJIB
                      </span>
                    )}
                  </Button>

                  <HistoryLocationPicker
                    myOrders={myOrders}
                    onSelect={(lat, lng, address) => {
                      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                      setForm((prev) => ({
                        ...prev,
                        lat,
                        lng,
                        googleMapUrl: mapUrl,
                        alamat_detail: address,
                      }));
                      toast.success("Lokasi dipilih dari riwayat", {
                        icon: <MapPin className="h-4 w-4 text-green-600" />,
                      });
                    }}
                  />

                  <ManualLocationPicker
                    initialLat={form.lat}
                    initialLng={form.lng}
                    onSelect={(lat, lng) => {
                      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                      setForm((prev) => ({
                        ...prev,
                        lat,
                        lng,
                        googleMapUrl: mapUrl,
                      }));
                      toast.success("Lokasi manual dipilih", {
                        icon: <MapPin className="h-4 w-4 text-purple-600" />,
                      });
                    }}
                  />
                </div>
              </div>

              {form.lat && form.lng && (
                <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 h-32 w-full relative group bg-neutral-100 dark:bg-neutral-900">
                  <a
                    href={form.googleMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 bg-black/10 z-10 group-hover:bg-black/0 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <span className="bg-white text-black text-[10px] px-3 py-1.5 rounded-full font-bold flex gap-2 items-center border shadow-none">
                      <ExternalLink className="h-3.5 w-3.5" /> Buka Google Maps
                    </span>
                  </a>
                  <iframe
                    title="GPS Preview"
                    className="w-full h-full grayscale-[0.3] opacity-90 hover:grayscale-0 transition-all duration-500"
                    src={`https://maps.google.com/maps?q=${form.lat},${form.lng}&z=15&output=embed`}
                    frameBorder="0"
                    scrolling="no"
                  ></iframe>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-500 ml-1">
                  Detail Alamat / Patokan
                </label>
                <Textarea
                  placeholder="Contoh: Rumah pagar hitam, depan masjid, atau nomor rumah..."
                  className={`min-h-20 text-xs resize-none ${inputBase} rounded-xl`}
                  value={form.alamat_detail}
                  onChange={(e) =>
                    setForm({ ...form, alamat_detail: e.target.value })
                  }
                />
              </div>

              {cart.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl flex items-center gap-4">
                  <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest">
                      Estimasi Sampai
                    </p>
                    <p className="text-xs font-bold text-blue-900 dark:text-blue-100">
                      15 - 30 Menit{" "}
                      <span className="font-normal text-[10px] opacity-60 ml-1">
                        (Tergantung Jarak)
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-500 ml-1">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paymentMethod: "COD" })}
                    className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                      form.paymentMethod === "COD"
                        ? "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700"
                        : "border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-neutral-400"
                    }`}
                  >
                    <Banknote className="h-5 w-5" />
                    <span className="text-xs font-bold">COD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, paymentMethod: "TRANSFER" })
                    }
                    className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                      form.paymentMethod === "TRANSFER"
                        ? "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700"
                        : "border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-neutral-400"
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-xs font-bold">TRANSFER</span>
                  </button>
                </div>

                {form.paymentMethod === "TRANSFER" && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="p-4 bg-neutral-100 dark:bg-neutral-950 rounded-xl space-y-1.5 border border-neutral-200 dark:border-neutral-800">
                      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
                        Rekening Pembayaran
                      </p>
                      <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                        Bank BCA: 1234567890
                      </p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-500 font-medium italic">
                        A/N HANS FOOD INDONESIA
                      </p>
                    </div>

                    <div className="relative">
                      <input
                        type="file"
                        id="upload-bukti"
                        className="hidden"
                        accept="image/*"
                        onChange={handleUploadBukti}
                        disabled={uploading}
                      />
                      <label
                        htmlFor="upload-bukti"
                        className="flex flex-col items-center justify-center gap-3 p-5 border-2 border-dashed border-neutral-300 dark:border-neutral-800 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition-all hover:border-neutral-400 group"
                      >
                        {uploading ? (
                          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
                        ) : form.buktiTransferUrl ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-20 w-20 relative rounded-xl overflow-hidden border-2 border-green-500/30">
                              <Image
                                src={form.buktiTransferUrl}
                                alt="Bukti"
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <span className="text-[10px] font-bold text-green-600 dark:text-green-500 flex items-center gap-2 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full border border-green-200 dark:border-green-800 transition-colors">
                              <CheckCircle2 className="h-3.5 w-3.5" /> GANTI
                              BUKTI
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full group-hover:scale-110 transition-transform">
                              <UploadCloud className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500 uppercase tracking-widest text-center">
                              Upload Bukti Transfer
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 shrink-0 z-20 space-y-4">
        <div className="space-y-1.5 w-full">
          <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-500 font-medium">
            <span>Subtotal Pesanan</span>
            <span suppressHydrationWarning>Rp {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-500 font-medium">
            <span>Biaya Kirim (Flat)</span>
            <span suppressHydrationWarning>
              Rp {cart.length > 0 ? ongkir.toLocaleString() : 0}
            </span>
          </div>
          <div className="flex justify-between items-end pt-3 border-t border-neutral-100 dark:border-neutral-800 mt-2">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-neutral-100">
              Total Bayar
            </span>
            <span
              className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tighter"
              suppressHydrationWarning
            >
              Rp {total.toLocaleString()}
            </span>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={
            sending ||
            cart.length === 0 ||
            (form.paymentMethod === "TRANSFER" && !form.buktiTransferUrl)
          }
          className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl transition-all active:scale-[0.98] text-base shadow-none disabled:bg-neutral-200 dark:disabled:bg-neutral-800"
        >
          {sending ? (
            <Loader2 className="animate-spin h-6 w-6" />
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Save className="h-5 w-5" /> <span>Pesan Sekarang</span>
            </div>
          )}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans selection:bg-neutral-200">
      <Toaster position="top-center" theme={isDarkMode ? "dark" : "light"} />

      <header
        style={glassEffect}
        className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-950/80 border-b border-neutral-200 dark:border-neutral-800 px-3 md:px-6 h-16 flex items-center justify-between transition-all backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 p-1.5 md:p-2 rounded-lg">
            <Utensils className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <div className=" xs:block">
            <span className="text-sm md:text-base font-semibold tracking-tight block leading-none">
              HANS Food
            </span>
            <span className="text-[9px] md:text-[10px] text-neutral-500 dark:text-neutral-500 font-medium uppercase tracking-wider">
              Delivery Pelanggan
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full h-9 w-9 dark:text-neutral-400"
          >
            {isDarkMode ? (
              <Sun className="h-4.5 w-4.5" />
            ) : (
              <Moon className="h-4.5 w-4.5" />
            )}
          </Button>

          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowHistoryModal(true);
                loadMyOrders();
              }}
              className="flex items-center gap-2 px-3 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-300 transition-colors"
            >
              <Navigation className="h-4 w-4" />
              <span className="text-xs font-bold hidden sm:inline">
                Riwayat & Tracking
              </span>
            </Button>
          )}

          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 py-1.5 px-2 rounded-full border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 transition-colors"
              >
                <div className="h-8 w-8 bg-neutral-900 dark:bg-neutral-100 rounded-full flex items-center justify-center">
                  <span className="font-bold text-xs text-white dark:text-neutral-900">
                    {user.name.charAt(0)}
                  </span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-300 dark:text-neutral-400 ${
                    showUserMenu ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowUserMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl py-1 z-40 shadow-none animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                      <p className="text-sm font-bold truncate dark:text-neutral-100">
                        {user.name}
                      </p>
                      <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                        {user.phone}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-5 py-3 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Keluar Akun
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/login">
              <Button
                size="sm"
                className="bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white h-9 px-4 text-xs font-bold rounded-xl shadow-none"
              >
                Masuk
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* --- MODAL RIWAYAT / TRACKING (ORIGINAL UI) --- */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="bg-white dark:bg-neutral-900 w-[95vw] h-[90vh] sm:max-w-xl sm:rounded-3xl overflow-hidden p-0 flex flex-col fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border border-neutral-200 dark:border-neutral-800">
          <DialogHeader className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-row items-center justify-between shrink-0 bg-white dark:bg-neutral-900">
            <DialogTitle className="text-base font-bold flex items-center gap-3 dark:text-neutral-100">
              <Bike className="h-5 w-5 text-green-600" /> Riwayat & Tracking
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 -mr-2 rounded-full dark:text-neutral-400"
                onClick={() => setShowHistoryModal(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Halaman untuk memantau status pesanan Anda secara real-time.
          </DialogDescription>
          <div className="flex-1 overflow-y-auto bg-neutral-100/30 dark:bg-neutral-950">
            <ScrollArea className="h-full w-full">
              <div className="p-4 space-y-5 pb-20">
                {myOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-neutral-400 dark:text-neutral-600 gap-4">
                    <History className="h-12 w-12 opacity-10" />
                    <p className="text-sm font-medium italic">
                      Belum ada pesanan aktif
                    </p>
                  </div>
                ) : (
                  myOrders.map((order) => {
                    // Logika Stepper Status
                    const steps = [
                      { label: "Menunggu", key: "menunggu", icon: Package },
                      { label: "Diterima", key: "diterima", icon: ThumbsUp },
                      { label: "Diproses", key: "diproses", icon: Timer },
                      { label: "Dikirim", key: "dikirim", icon: Bike },
                      { label: "Selesai", key: "selesai", icon: CheckCircle2 },
                    ];

                    const currentIndex = steps.findIndex(
                      (s) => s.key === order.status
                    );
                    const isRejected = order.status === "ditolak";

                    return (
                      <div
                        key={order.id}
                        className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm"
                      >
                        {/* PETA TRACKING (Muncul jika diproses) */}
                        {order.status === "diterima" && order.kurir_lat && (
                          <div className="h-52 w-full relative">
                            <OrderMap
                              userLat={order.latitude}
                              userLng={order.longitude}
                              kurirLat={order.kurir_lat}
                              kurirLng={order.kurir_lng!}
                            />
                            <div className="absolute top-3 left-3 z-[1000] bg-white/90 dark:bg-neutral-900/90 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-2 border border-neutral-200 dark:border-neutral-800">
                              <div className="h-2 w-2 bg-blue-500 rounded-full animate-ping"></div>{" "}
                              KURIR SEDANG MENUJU LOKASI
                            </div>
                          </div>
                        )}

                        <div className="p-4 border-b border-neutral-50 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800/20">
                          <div className="flex flex-col">
                            <span
                              className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase"
                              suppressHydrationWarning
                            >
                              {new Date(order.created_at).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              ID: #{order.id}
                            </span>
                          </div>
                          <span
                            className="text-sm font-black dark:text-neutral-100"
                            suppressHydrationWarning
                          >
                            Rp {Number(order.total_bayar).toLocaleString()}
                          </span>
                        </div>

                        <div className="p-5">
                          {isRejected ? (
                            <div className="flex items-center gap-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                              <XCircle className="h-8 w-8 text-red-600" />
                              <div>
                                <p className="text-xs font-bold text-red-700 dark:text-red-400">
                                  Pesanan Dibatalkan
                                </p>
                                <p className="text-[10px] text-red-600/70">
                                  Maaf, pesanan Anda tidak dapat diproses.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="relative flex justify-between items-start">
                              <div className="absolute top-4 left-0 right-0 h-0.5 bg-neutral-100 dark:bg-neutral-800 z-0">
                                <div
                                  className="h-full bg-green-500 transition-all duration-1000"
                                  style={{
                                    width: `${
                                      (currentIndex / (steps.length - 1)) * 100
                                    }%`,
                                  }}
                                />
                              </div>

                              {steps.map((step, idx) => {
                                const Icon = step.icon;
                                const isDone = idx <= currentIndex;
                                const isCurrent = idx === currentIndex;

                                return (
                                  <div
                                    key={idx}
                                    className="flex flex-col items-center gap-2 relative z-10"
                                  >
                                    <div
                                      className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                                        isDone
                                          ? "bg-green-500 border-green-500 text-white scale-110"
                                          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400"
                                      }`}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <span
                                      className={`text-[9px] font-bold uppercase tracking-tight ${
                                        isCurrent
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-neutral-400"
                                      }`}
                                    >
                                      {step.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="px-5 pb-5 space-y-3">
                          <div className="bg-neutral-50/50 dark:bg-neutral-950 p-3 rounded-xl space-y-2 border border-neutral-100 dark:border-neutral-800">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-xs dark:text-neutral-400"
                              >
                                <span className="font-medium text-[11px]">
                                  {item.qty}x {item.name}
                                </span>
                                <span
                                  className="font-bold"
                                  suppressHydrationWarning
                                >
                                  Rp {(item.price * item.qty).toLocaleString()}
                                </span>
                              </div>
                            ))}
                            <div className="pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800 flex justify-between items-center text-[10px] font-bold text-neutral-500">
                              <span>ONGKIR</span>
                              <span>
                                Rp {Number(order.ongkir).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-neutral-400 uppercase">
                              BAYAR: {order.metode_pembayaran}
                            </span>
                            {order.gambar && (
                              <a
                                href={order.gambar}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:underline"
                              >
                                <ImageIcon className="h-3.5 w-3.5" /> LIHAT
                                BUKTI
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- MODAL CHECKOUT MOBILE (ORIGINAL UI) --- */}
      <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
        <DialogContent className="bg-white dark:bg-neutral-900 w-[90vw] h-[85vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-3xl overflow-hidden p-0 flex flex-col fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border border-neutral-200 dark:border-neutral-800">
          <DialogHeader className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-row items-center justify-between shrink-0 bg-white dark:bg-neutral-900">
            <DialogTitle className="text-base font-bold flex items-center gap-3 dark:text-neutral-100">
              <Bike className="h-5 w-5 text-green-600" /> Checkout Pesanan
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 -mr-2 rounded-full dark:text-neutral-400"
              onClick={() => setShowCheckoutModal(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Form detail alamat dan pembayaran untuk pesanan Anda.
          </DialogDescription>
          {renderCartContent()}
        </DialogContent>
      </Dialog>

      {/* --- MOBILE CART BAR (ORIGINAL UI) --- */}
      {cart.length > 0 && !showCheckoutModal && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-neutral-950/95 border-t border-neutral-200 dark:border-neutral-800 p-4 lg:hidden backdrop-blur-md">
          <div className="flex items-center justify-between gap-5">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-widest">
                {cart.length} ITEM
              </span>
              <span
                className="text-xl font-bold dark:text-neutral-100 tracking-tight"
                suppressHydrationWarning
              >
                Rp {total.toLocaleString()}
              </span>
            </div>
            <Button
              onClick={() => setShowCheckoutModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 rounded-2xl h-12 flex-1 max-w-45 shadow-none transition-all active:scale-95"
            >
              Lanjut <Bike className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* --- CATALOG AREA (ORIGINAL UI) --- */}
      <main className="container mx-auto p-3 md:p-4 lg:p-6 max-w-7xl pb-24 lg:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
          <div className="lg:col-span-7 space-y-5 lg:space-y-8">
            <div className="bg-white/90 dark:bg-neutral-900/90 p-4 lg:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 sticky top-20 z-30 backdrop-blur-sm shadow-none">
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-neutral-400 dark:text-neutral-500" />
                <Input
                  placeholder="Cari menu Cilok Master..."
                  className={`pl-11 h-12 text-sm ${inputBase} rounded-xl border-neutral-200 dark:border-neutral-800`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      selectedCategory === cat
                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-transparent shadow-none"
                        : "text-neutral-500 border-transparent dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-5">
              {products
                .filter(
                  (p) =>
                    selectedCategory === "Semua" ||
                    p.category === selectedCategory
                )
                .filter((p) =>
                  p.name.toLowerCase().includes(search.toLowerCase())
                )
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 flex flex-col justify-between min-h-40 hover:border-neutral-400 dark:hover:border-neutral-700 active:scale-[0.98] cursor-pointer group transition-all shadow-none"
                  >
                    <div className="space-y-1.5">
                      <span className="text-[9px] lg:text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                        {p.category}
                      </span>
                      <h3 className="font-semibold leading-snug text-sm line-clamp-2 dark:text-neutral-100">
                        {p.name}
                      </h3>
                    </div>
                    <div className="flex justify-between items-end mt-4">
                      <p
                        suppressHydrationWarning
                        className="text-base font-bold dark:text-neutral-100"
                      >
                        Rp {p.price.toLocaleString()}
                      </p>
                      <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 p-2 rounded-xl group-hover:scale-110 transition-transform shadow-none">
                        <Plus className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-5 relative h-full">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl lg:sticky lg:top-24 flex flex-col lg:h-[calc(100vh-120px)] overflow-hidden w-full shadow-none">
              <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 shrink-0 z-10 flex items-center justify-between">
                <h2 className="font-bold text-sm flex items-center gap-3 dark:text-neutral-100">
                  <Bike className="h-5 w-5 text-green-600" /> Ringkasan
                  Pengiriman
                </h2>
                <span className="text-[10px] font-black bg-neutral-200 dark:bg-neutral-800 px-3 py-1 rounded-full dark:text-neutral-300 tracking-widest uppercase">
                  {cart.length} ITEM
                </span>
              </div>
              {renderCartContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
