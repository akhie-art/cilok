'use client'

// --- KONFIGURASI BUILD ---
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image' 
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription
} from '@/components/ui/dialog'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { 
  Moon, Sun, ShoppingCart, Plus, Minus, Search, Loader2, Utensils, 
  List, QrCode, Wallet, CalendarDays, Filter, ChevronDown, 
  Printer, Download, X, Camera, Upload, 
  ChevronUp, CheckCircle2, Bell, Bike, User, MapPin, 
  Phone, ExternalLink, Ban, Check, Package, Clock, Navigation, ArrowRight
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

// --- INITIALIZATION ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// --- TYPES ---
interface Product {
  id: number
  name: string
  price: number
  category: string
}

interface CartItem extends Product {
  qty: number
}

interface Transaction {
  id: number
  created_at: string
  total: number
  subtotal: number
  bayar: number
  kembalian: number
  items: CartItem[]
  metode_pembayaran: string
  gambar?: string | null
}

interface DeliveryOrder {
  id: number
  created_at: string
  nama: string
  telepon: string
  alamat_detail: string
  google_map_url: string
  items: CartItem[]
  total_bayar: number
  subtotal: number
  ongkir: number
  status: string
  gambar?: string | null
  kurir_lat?: number | null
  kurir_lng?: number | null
}

const products: Product[] = [
  { id: 1, name: 'Cilok Ayam Suwir', price: 7000, category: 'Premium' },
]

const categories = ["Semua", ...new Set(products.map(p => p.category))]

export default function POS() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [bayar, setBayar] = useState('')
  const [metode, setMetode] = useState('tunai')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState("Semua")
  
  const [openHistory, setOpenHistory] = useState(false)
  const [openSuccess, setOpenSuccess] = useState(false)
  const [openScanner, setOpenScanner] = useState(false)
  const [openOrders, setOpenOrders] = useState(false) 
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [dark, setDark] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cameraError, setCameraError] = useState('')
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [orders, setOrders] = useState<DeliveryOrder[]>([]) 
  const [filter, setFilter] = useState('hari')
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null)

  const [notificationCount, setNotificationCount] = useState(0)
  const notifiedOrderIds = useRef<Set<number>>(new Set())
  const watchIdRef = useRef<number | null>(null)

  const inputBayarRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const total = subtotal 
  const kembalian = metode === 'tunai' ? (bayar ? Number(bayar) - total : 0) : 0

  const startTracking = useCallback((orderId: number) => {
    if (!navigator.geolocation) return toast.error("GPS tidak didukung")
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current)

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        await supabase
          .from('deliveries')
          .update({ kurir_lat: latitude, kurir_lng: longitude })
          .eq('id', orderId)
      },
      (error) => console.error("GPS Error:", error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    )
    toast.info("Sistem Tracking Aktif", { description: "Lokasi Anda dikirim ke pelanggan." })
  }, [])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const quickAmounts = useMemo(() => {
    if (total === 0) return []
    const amounts = [total]
    if (total < 10000) amounts.push(10000)
    if (total < 20000) amounts.push(20000)
    if (total < 50000) amounts.push(50000)
    if (total < 100000) amounts.push(100000)
    const rounded = Math.ceil(total / 5000) * 5000
    if (!amounts.includes(rounded)) amounts.push(rounded)
    return [...new Set(amounts)].sort((a, b) => a - b)
  }, [total])

  const stats = useMemo(() => {
    const totalOmzet = transactions.reduce((acc, curr) => acc + (curr.total || 0), 0)
    const count = transactions.length
    const avg = count > 0 ? totalOmzet / count : 0
    return { totalOmzet, count, avg }
  }, [transactions])

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .in('status', ['menunggu', 'diterima', 'diproses', 'dikirim']) 
        .order('created_at', { ascending: false })

    if (error) { 
        console.error("Error fetching orders:", error.message); 
        return; 
    }

    if (data) {
        const parsedOrders = data.map((order) => {
             let parsedItems: CartItem[] = []
             if (typeof order.items === 'string') {
                try { parsedItems = JSON.parse(order.items) } catch { parsedItems = [] }
             } else if (Array.isArray(order.items)) {
                parsedItems = order.items
             } else {
                 parsedItems = [order.items] as unknown as CartItem[]
             }
             return { ...order, items: parsedItems } as DeliveryOrder
        })
        setOrders(parsedOrders)

        let newItemsCount = 0
        parsedOrders.forEach(order => {
            if (order.status === 'menunggu' && !notifiedOrderIds.current.has(order.id)) {
                newItemsCount++
                notifiedOrderIds.current.add(order.id)
            }
        })

        if (newItemsCount > 0) {
            setNotificationCount(prev => prev + newItemsCount)
            toast("Pesanan delivery baru masuk!", { 
                icon: <Bike className="h-5 w-5 text-green-600" />, 
                position: 'top-center',
                duration: 3000
            })
        }
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    let query = supabase.from('transactions').select('*').order('created_at', { ascending: false })
    const now = new Date(); now.setHours(0, 0, 0, 0) 

    if (filter === 'hari') query = query.gte('created_at', now.toISOString())
    else if (filter === 'minggu') {
      const day = now.getDay(); const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      query = query.gte('created_at', new Date(now.setDate(diff)).toISOString())
    } 
    else if (filter === 'bulan') query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
    else if (filter === 'tahun') query = query.gte('created_at', new Date(now.getFullYear(), 0, 1).toISOString())
    else query = query.limit(50)
    
    const { data, error } = await query
    if (error) return
    
    if (data) {
        const parsedData = data.map((item) => {
            let parsedItems: CartItem[] = []
            if (typeof item.items === 'string') {
                try { parsedItems = JSON.parse(item.items) } catch { parsedItems = [] }
            } else if (Array.isArray(item.items)) {
                parsedItems = item.items
            }
            return { ...item, items: parsedItems } as Transaction
        })
        setTransactions(parsedData)
    }
  }, [filter])

  // --- UPDATED FLOW HANDLER ---
  const handleProcessOrder = async (id: number, nextStatus: string) => {
    const order = orders.find(o => o.id === id)
    if (!order) return

    let toastMsg = `Status diperbarui ke ${nextStatus}`

    // Logic khusus per tahapan
    if (nextStatus === 'dikirim') {
        startTracking(id)
        toastMsg = 'Pesanan dikirim. GPS Aktif!'
    } else if (nextStatus === 'selesai') {
        stopTracking()
        toastMsg = 'Pesanan selesai & masuk laporan.'
        
        const transactionPayload = {
            total: Number(order.total_bayar),
            subtotal: Number(order.subtotal || order.total_bayar),
            bayar: Number(order.total_bayar),
            kembalian: 0,
            items: order.items,
            metode_pembayaran: 'delivery',
            gambar: order.gambar || null,
            created_at: new Date().toISOString()
        }
        await supabase.from('transactions').insert([transactionPayload])
    } else if (nextStatus === 'ditolak') {
        stopTracking()
        toastMsg = 'Pesanan telah dibatalkan.'
    }
    
    const { error } = await supabase
        .from('deliveries')
        .update({ status: nextStatus })
        .eq('id', id)

    if (error) {
        toast.error("Gagal memperbarui status")
        return
    }

    toast.success(toastMsg)
    loadOrders() 
    if (nextStatus === 'selesai') loadTransactions()
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const found = prev.find(p => p.id === product.id)
      toast.success(found ? `${product.name} diperbarui` : `${product.name} masuk keranjang`, {
        description: `Harga: Rp ${product.price.toLocaleString('id-ID')}`,
        icon: <div className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 p-1 rounded-full"><Plus className="h-3 w-3" /></div>,
        duration: 1500,
      })
      if (found) return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p)
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(p => {
      if (p.id === id) {
        const newQty = p.qty + delta
        return newQty > 0 ? { ...p, qty: newQty } : p
      }
      return p
    }).filter(p => p.qty > 0))
  }

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id))
    toast.info("Item dihapus dari keranjang", { duration: 1500 })
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
      setCameraError('')
    } catch {
      setCameraError("Gagal akses kamera.")
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const handleQRISClick = () => {
    if (cart.length === 0) return toast.error("Keranjang kosong!")
    setMetode('qris')
    setBayar(total.toString())
    setOpenScanner(true) 
  }

  const handleCaptureAndPay = async () => {
    if (!videoRef.current) return;
    setUploading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Gagal inisialisasi canvas");
      ctx.drawImage(videoRef.current, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) throw new Error("Gagal membuat gambar");
      const fileName = `qris_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('buktiQris').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('buktiQris').getPublicUrl(fileName);
      await handleBayar(publicUrl);
      setOpenScanner(false);
    } catch {
      toast.error("Gagal Upload");
    } finally {
      setUploading(false);
    }
  }

  const handleBayar = async (imageUrl: string | null = null) => {
    if (metode === 'tunai' && kembalian < 0) return toast.error("Pembayaran Kurang!")
    if (cart.length === 0) return
    if (!imageUrl) setLoading(true)
    const transactionPayload = { 
      total: Number(total), 
      subtotal: Number(subtotal), 
      bayar: Number(bayar) || total, 
      kembalian: Number(kembalian), 
      items: cart, 
      metode_pembayaran: metode,
      gambar: imageUrl,
      created_at: new Date().toISOString()
    }
    try {
      const { data, error } = await supabase.from('transactions').insert([transactionPayload]).select()
      if (error) throw error;
      if (data && data.length > 0) setLastTransaction(data[0] as Transaction)
      setOpenSuccess(true)
      setCart([])
      setBayar('')
      setMetode('tunai')
      setShowMobileCart(false)
      loadTransactions()
    } catch {
      toast.error("Transaksi Gagal");
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (transactions.length === 0) return
    const headers = ["ID", "Waktu", "Total", "Metode", "Bukti", "Items"]
    const rows = transactions.map(t => [t.id, new Date(t.created_at).toLocaleString(), t.total, t.metode_pembayaran, t.gambar || "-", t.items.map(i => i.name).join('; ')])
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "Laporan.csv"); link.click()
  }

  const handlePrint = () => { window.print() }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus() }
      if (e.key === 'F8' && cart.length > 0) { e.preventDefault(); inputBayarRef.current?.focus() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart])

  useEffect(() => {
    if (openScanner) startCamera(); else stopCamera()
  }, [openScanner])

  useEffect(() => {
    const root = window.document.documentElement
    if (dark) root.classList.add('dark'); else root.classList.remove('dark')
    if (openHistory) loadTransactions()
  }, [dark, openHistory, loadTransactions])

  useEffect(() => {
    loadOrders()
    const interval = setInterval(loadOrders, 10000)
    return () => clearInterval(interval)
  }, [loadOrders])

  const glassEffect = { WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)' }
  const cardBase = "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 transition-all duration-200"
  const textMuted = "text-neutral-500 dark:text-neutral-500"
  const textMain = "text-neutral-900 dark:text-neutral-100"
  const inputBase = "bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-neutral-900 dark:focus:border-neutral-700 focus:ring-0 transition-colors placeholder:text-neutral-400 dark:text-neutral-100"

  const MemoizedCheckoutPanel = useMemo(() => {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden">
             <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
                <div className="flex items-center gap-2">
                    <div className="bg-neutral-200 dark:bg-neutral-800 p-1.5 rounded">
                        <ShoppingCart className={`h-4 w-4 ${textMain}`} />
                    </div>
                    <h2 className={`text-sm font-semibold ${textMain}`}>Pesanan ({cart.length})</h2>
                </div>
                {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="text-[10px] font-semibold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors">
                    Hapus Semua
                    </button>
                )}
                <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-2 -mr-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"><ChevronDown className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 min-h-0 bg-white dark:bg-neutral-900 relative shadow-none">
                <ScrollArea className="h-full w-full">
                    <div className="px-4 py-4 pb-20 lg:pb-4">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-neutral-400 dark:text-neutral-600 text-xs text-center space-y-2 shadow-none">
                        <ShoppingCart className="h-8 w-8 opacity-20 shadow-none" />
                        <p className="shadow-none">Belum ada menu dipilih</p>
                        </div>
                    ) : (
                        <div className="space-y-0 divide-y divide-neutral-100 dark:divide-neutral-800 shadow-none">
                        {cart.map(item => (
                            <div key={item.id} className="flex gap-3 items-center group py-3 shadow-none">
                            <button onClick={() => removeItem(item.id)} className="h-6 w-6 flex items-center justify-center rounded text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0 shadow-none"><X className="h-4 w-4 shadow-none" /></button>
                            <div className="flex-1 min-w-0 shadow-none">
                                <p className={`text-sm font-semibold ${textMain} capitalize truncate shadow-none`}>{item.name}</p>
                                <p suppressHydrationWarning className={`text-[11px] shadow-none ${textMuted}`}>@ {item.price.toLocaleString('id-ID')}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 shadow-none">
                                <div className="flex items-center border border-neutral-200 dark:border-neutral-800 rounded-md bg-white dark:bg-neutral-950 shadow-none">
                                    <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-l shadow-none"><Minus className="h-3 w-3 shadow-none dark:text-neutral-400"/></button>
                                    <span className="w-6 text-center text-xs font-semibold tabular-nums shadow-none dark:text-neutral-200">{item.qty}</span>
                                    <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-r shadow-none"><Plus className="h-3 w-3 shadow-none dark:text-neutral-400"/></button>
                                </div>
                                <p suppressHydrationWarning className={`text-sm font-semibold w-16 text-right tabular-nums shadow-none ${textMain}`}>{(item.price * item.qty).toLocaleString('id-ID')}</p>
                            </div>
                            </div>
                        ))}
                        </div>
                    )}
                    </div>
                </ScrollArea>
            </div>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-900 mt-auto border-t border-neutral-200 dark:border-neutral-800 space-y-4 shrink-0 z-10 shadow-none">
                <div className="space-y-1 shadow-none">
                    <div className="flex justify-between items-end shadow-none">
                    <span className={`text-xs font-medium shadow-none ${textMuted} uppercase tracking-wider`}>Total Tagihan</span>
                    <span suppressHydrationWarning className={`text-2xl font-bold shadow-none ${textMain} tracking-tight`}>Rp {total.toLocaleString('id-ID')}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 shadow-none">
                    <button onClick={() => { setMetode('tunai'); setBayar(''); }} className={`flex items-center justify-center gap-2 h-10 rounded-lg text-xs font-semibold border transition-all shadow-none ${metode === 'tunai' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-transparent' : 'bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}><Wallet className="h-3.5 w-3.5 shadow-none" /> TUNAI</button>
                    <button onClick={handleQRISClick} className={`flex items-center justify-center gap-2 h-10 rounded-lg text-xs font-semibold border transition-all shadow-none ${metode === 'qris' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-transparent border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}><QrCode className="h-3.5 w-3.5 shadow-none" /> QRIS</button>
                </div>
                <div className="space-y-3 shadow-none">
                    <Input 
                        ref={inputBayarRef} 
                        type="number" 
                        value={bayar} 
                        onChange={e => setBayar(e.target.value)} 
                        className={`h-12 text-xl font-bold text-center shadow-none ${inputBase} ${metode === 'qris' ? 'hidden' : ''}`} 
                        placeholder="Input Pembayaran (F8)" 
                    />
                    {metode === 'tunai' && cart.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 shadow-none">
                        {quickAmounts.map(amt => (
                        <button key={amt} onClick={() => setBayar(amt.toString())} className="h-9 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[10px] font-semibold hover:border-neutral-400 dark:hover:border-neutral-500 dark:text-neutral-300 transition-colors shadow-none">{amt === total ? 'Pas' : (amt/1000) + 'k'}</button>
                        ))}
                    </div>
                    )}
                    <Button onClick={() => handleBayar()} disabled={loading || (metode === 'tunai' && (kembalian < 0 || !bayar)) || cart.length === 0} className="w-full h-12 text-base font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white border-none shadow-none disabled:bg-neutral-200 dark:disabled:bg-neutral-800">
                    {loading ? <Loader2 className="animate-spin h-5 w-5 shadow-none" /> : <span suppressHydrationWarning className="shadow-none">BAYAR: Rp {total.toLocaleString('id-ID')}</span>}
                    </Button>
                </div>
            </div>
        </div>
      )
  }, [cart, bayar, metode, total, loading, subtotal, quickAmounts, kembalian, textMain, textMuted, inputBase]);

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans tracking-tight bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 pb-24 lg:pb-0 shadow-none`}>
      <Toaster position="top-center" theme={dark ? 'dark' : 'light'} />
      <header style={glassEffect} className={`sticky top-0 z-40 w-full h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 lg:px-6 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md print:hidden shadow-none`}>
        <div className="flex items-center gap-3">
          <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 p-2 rounded-lg shadow-none">
            <Utensils className="h-5 w-5 shadow-none" />
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight block leading-none">HANS Food</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-500 font-medium uppercase tracking-wider">Kasir</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={openOrders} onOpenChange={(open) => { if(!open) setOpenOrders(false); setNotificationCount(0); }}>
             <div className="relative" onClick={() => { setOpenOrders(true); setNotificationCount(0); }}>
                <Button variant="ghost" size="sm" className={`h-10 px-3 gap-2 rounded-xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 ${orders.length > 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-900 dark:text-neutral-300'}`}>
                  <Bike className="h-4 w-4" /> 
                  <span className="hidden sm:inline">Pesanan</span>
                </Button>
                {notificationCount > 0 && (<span className="absolute top-1 right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 shadow-none"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] text-white font-bold items-center justify-center shadow-none">{notificationCount}</span></span>)}
             </div>
             <DialogContent className="bg-white dark:bg-neutral-900 border-none sm:border sm:border-neutral-200 sm:dark:border-neutral-800 w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-xl overflow-hidden p-0 gap-0 flex flex-col shadow-none">
                 <DialogHeader className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50 dark:bg-neutral-900/50">
                    <div className="flex items-center justify-between w-full">
                        <div className="space-y-1">
                            <DialogTitle className="text-lg font-semibold flex items-center gap-2 dark:text-neutral-100">
                                <Bell className="h-5 w-5 text-green-600 dark:text-green-500 shadow-none"/> 
                                Pesanan Masuk 
                                {orders.length > 0 && <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full shadow-none">{orders.length} Aktif</span>}
                            </DialogTitle>
                            <DialogDescription className="dark:text-neutral-400 text-xs sm:text-sm">Daftar pesanan delivery yang perlu diproses.</DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="h-10 w-10 -mr-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400" onClick={() => setOpenOrders(false)}>
                            <X className="h-5 w-5"/>
                        </Button>
                    </div>
                 </DialogHeader>
                 <div className="flex-1 overflow-y-auto bg-neutral-100/50 dark:bg-neutral-950 p-4 shadow-none">
                     <div className="space-y-4 shadow-none">
                        {orders.length === 0 ? (<div className="flex flex-col items-center justify-center h-64 text-neutral-400 dark:text-neutral-600 gap-3 shadow-none"><Bike className="h-8 w-8 opacity-20 shadow-none" /><p className="text-sm font-medium shadow-none">Tidak ada pesanan aktif</p></div>) : (
                            orders.map((order) => (
                                <div key={order.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-none">
                                    <div className={`p-3 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center ${order.status === 'menunggu' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : order.status === 'dikirim' ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-green-50/50 dark:bg-green-900/10'}`}>
                                        <div className="flex items-center gap-2 shadow-none">
                                            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest shadow-none ${
                                                order.status === 'menunggu' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500' : 
                                                order.status === 'diterima' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                order.status === 'diproses' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                                order.status === 'dikirim' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>{order.status}</span>
                                            <span suppressHydrationWarning className="text-xs text-neutral-500 dark:text-neutral-500 font-mono shadow-none">{new Date(order.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <span suppressHydrationWarning className="text-xs font-semibold dark:text-neutral-200 shadow-none">Total: Rp {order.total_bayar.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 shadow-none">
                                        <div className="space-y-2 text-sm shadow-none">
                                            <div className="flex items-start gap-2 shadow-none"><div className="mt-0.5 shadow-none"><User className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-600 shadow-none" /></div><div className="shadow-none"><p className="font-semibold text-neutral-900 dark:text-neutral-100 shadow-none">{order.nama}</p><a href={`https://wa.me/${order.telepon.replace(/^0/, '62')}`} target="_blank" className="text-green-600 dark:text-green-400 flex items-center gap-1 text-xs hover:underline mt-0.5 shadow-none"><Phone className="h-3 w-3 shadow-none" /> {order.telepon}</a></div></div>
                                            <div className="flex items-start gap-2 shadow-none"><div className="mt-0.5 shadow-none"><MapPin className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-600 shadow-none" /></div><div className="shadow-none"><p className="text-neutral-600 dark:text-neutral-400 leading-tight text-xs shadow-none">{order.alamat_detail}</p><a href={order.google_map_url} target="_blank" className="text-blue-600 dark:text-blue-400 flex items-center gap-1 text-xs hover:underline mt-1 shadow-none"><ExternalLink className="h-3.5 w-3.5 shadow-none" /> Buka Maps</a></div></div>
                                            {order.gambar && (<div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 mt-2 shadow-none"><p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase mb-2 shadow-none">Bukti Pembayaran:</p><a href={order.gambar} target="_blank" rel="noreferrer" className="group block relative w-full h-32 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 shadow-none"><Image src={order.gambar} alt="Bukti" fill className="object-cover transition-transform group-hover:scale-105 shadow-none" unoptimized /></a></div>)}
                                        </div>
                                        <div className="bg-neutral-50 dark:bg-neutral-950 rounded-lg p-3 text-xs space-y-1 shadow-none">
                                            <p className="font-semibold text-neutral-500 dark:text-neutral-500 uppercase text-[10px] mb-2 shadow-none">Daftar Menu</p>
                                            {order.items.map((item, idx) => (<div key={idx} className="flex justify-between dark:text-neutral-300 shadow-none"><span>{item.qty}x {item.name}</span><span suppressHydrationWarning className="font-medium text-neutral-500 dark:text-neutral-500 shadow-none">{item.price.toLocaleString('id-ID')}</span></div>))}
                                            <div className="border-t border-dashed border-neutral-300 dark:border-neutral-800 my-2 pt-1 flex justify-between font-semibold dark:text-neutral-100 shadow-none"><span>Ongkir</span><span suppressHydrationWarning className="shadow-none">{order.ongkir.toLocaleString('id-ID')}</span></div>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 shadow-none">
                                        <div className="flex flex-col gap-2">
                                            {order.status === 'menunggu' && (
                                                <div className="grid grid-cols-2 gap-3 shadow-none">
                                                    <Button variant="outline" onClick={() => handleProcessOrder(order.id, 'ditolak')} className="h-9 text-xs border-red-200 text-red-600 hover:bg-red-50 shadow-none"><Ban className="h-3.5 w-3.5 mr-2" /> Tolak</Button>
                                                    <Button onClick={() => handleProcessOrder(order.id, 'diterima')} className="h-9 text-xs bg-green-600 hover:bg-green-700 text-white shadow-none"><CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Terima</Button>
                                                </div>
                                            )}
                                            {order.status === 'diterima' && (
                                                <Button onClick={() => handleProcessOrder(order.id, 'diproses')} className="w-full h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-none"><Package className="h-3.5 w-3.5 mr-2" /> Proses Masak</Button>
                                            )}
                                            {order.status === 'diproses' && (
                                                <Button onClick={() => handleProcessOrder(order.id, 'dikirim')} className="w-full h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-none"><Bike className="h-3.5 w-3.5 mr-2" /> Kirim Pesanan</Button>
                                            )}
                                            {order.status === 'dikirim' && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 animate-pulse px-1 uppercase tracking-widest"><Navigation className="h-3 w-3" /> GPS Tracking Aktif...</div>
                                                    <Button onClick={() => handleProcessOrder(order.id, 'selesai')} className="w-full h-9 text-xs bg-green-700 hover:bg-green-800 text-white shadow-none"><Check className="h-3.5 w-3.5 mr-2" /> Tandai Selesai</Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                     </div>
                 </div>
             </DialogContent>
          </Dialog>

          <Dialog open={openHistory} onOpenChange={setOpenHistory}>
            <div onClick={() => setOpenHistory(true)}>
              <Button variant="ghost" size="sm" className="h-10 rounded-xl px-3 gap-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 dark:text-neutral-300 shadow-none">
                <List className="h-4 w-4 shadow-none" /> 
                <span className="hidden sm:inline">Riwayat</span>
              </Button>
            </div>
            <DialogContent className={`bg-white dark:bg-neutral-900 border-none sm:border sm:border-neutral-200 sm:dark:border-neutral-800 w-[90vw] h-[85vh] sm:max-w-5xl sm:rounded-2xl overflow-hidden p-0 gap-0 shadow-none flex flex-col fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}>
              <DialogHeader className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900">
                <div className="flex items-start justify-between w-full gap-4">
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded-xl"><CalendarDays className="h-6 w-6 text-neutral-600 dark:text-neutral-400"/></div>
                    <div>
                        <DialogTitle className="text-lg sm:text-xl font-semibold dark:text-neutral-100">Laporan Penjualan</DialogTitle>
                        <DialogDescription className="text-[10px] sm:text-xs dark:text-neutral-500">Rekapitulasi data transaksi pelanggan.</DialogDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleExportCSV} className="hidden sm:flex h-9 text-xs gap-2 font-semibold border-neutral-200 dark:border-neutral-800 dark:text-neutral-300 rounded-lg hover:bg-neutral-50"><Download className="h-4 w-4"/> Ekspor</Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400" onClick={() => setOpenHistory(false)}>
                        <X className="h-6 w-6 sm:h-5 sm:w-5"/>
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50/30 dark:bg-neutral-950/30 shadow-none">
                 <div className="p-4 sm:p-5 flex flex-col gap-1.5 border-r border-neutral-200 dark:border-neutral-800 shadow-none"><span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-500 font-semibold tracking-widest shadow-none">Total Omzet</span><div suppressHydrationWarning className="flex items-center gap-1.5 text-neutral-900 dark:text-neutral-100 font-semibold text-lg sm:text-2xl italic tracking-tight shadow-none">Rp {stats.totalOmzet.toLocaleString('id-ID')}</div></div>
                 <div className="p-4 sm:p-5 flex flex-col gap-1.5 border-r border-neutral-200 dark:border-neutral-800 shadow-none"><span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-500 font-semibold tracking-widest shadow-none">Transaksi</span><div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100 font-semibold text-lg sm:text-2xl italic tracking-tight shadow-none">{stats.count} <span className="text-[10px] not-italic font-semibold text-neutral-400 shadow-none">Order</span></div></div>
                 <div className="p-4 sm:p-5 flex flex-col gap-1.5 border-r border-neutral-200 dark:border-neutral-800 shadow-none"><span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-500 font-semibold tracking-widest shadow-none">Rata-Rata</span><div suppressHydrationWarning className="flex items-center gap-1.5 text-neutral-900 dark:text-neutral-100 font-semibold text-lg sm:text-2xl italic tracking-tight shadow-none">Rp {Math.round(stats.avg).toLocaleString('id-ID')}</div></div>
                 <div className="p-4 sm:p-5 flex flex-col justify-center bg-white dark:bg-neutral-900 shadow-none"><div className="relative w-full shadow-none"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 z-10 shadow-none" /><select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full h-10 pl-10 pr-8 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none dark:text-neutral-200 appearance-none cursor-pointer transition-all shadow-none"><option value="hari">Hari Ini</option><option value="minggu">Minggu Ini</option><option value="bulan">Bulan Ini</option><option value="tahun">Tahun Ini</option><option value="semua">Semua</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none shadow-none" /></div></div>
              </div>
              <div className="flex-1 min-h-0 bg-neutral-50/50 dark:bg-neutral-950 overflow-hidden relative shadow-none"><ScrollArea className="h-full w-full shadow-none"><div className="w-full overflow-x-auto shadow-none"><table className="w-full text-left border-collapse min-w-200 shadow-none"><thead className="sticky top-0 bg-white dark:bg-neutral-900 z-10 text-[10px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800 shadow-none"><tr><th className="px-6 py-4 shadow-none">Status & Waktu</th><th className="px-6 py-4 shadow-none">Item</th><th className="px-6 py-4 text-center shadow-none">Metode</th><th className="px-6 py-4 text-center shadow-none">Bukti</th><th className="px-6 py-4 text-right shadow-none">Total</th></tr></thead><tbody className="divide-y divide-neutral-100 dark:divide-neutral-900 bg-white dark:bg-neutral-900 shadow-none">{transactions.length === 0 ? (<tr><td colSpan={5} className="py-32 text-center shadow-none"><div className="flex flex-col items-center gap-3 text-neutral-400 dark:text-neutral-600 shadow-none"><Package className="h-10 w-10 opacity-20 shadow-none" /><p className="text-sm font-medium italic shadow-none">Tidak ada transaksi.</p></div></td></tr>) : (transactions.map((t) => (<tr key={t.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition-all group shadow-none"><td className="px-6 py-5 whitespace-nowrap shadow-none"><div className="flex items-center gap-4 shadow-none"><div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded-lg shadow-none"><Clock className="h-4 w-4 text-neutral-500 shadow-none"/></div><div className="flex flex-col shadow-none"><span suppressHydrationWarning className={`text-sm font-semibold shadow-none ${textMain}`}>{new Date(t.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span><span suppressHydrationWarning className={`text-[10px] font-mono tracking-tighter uppercase shadow-none ${textMuted}`}>{new Date(t.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} WIB</span></div></div></td><td className="px-6 py-5 shadow-none"><div className="flex flex-wrap gap-1.5 max-w-75 shadow-none">{t.items?.map((item, idx) => (<span key={idx} className={`px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold rounded-md shadow-none ${textMain}`}>{item.qty}x {item.name}</span>))}</div></td><td className="px-6 py-5 text-center whitespace-nowrap shadow-none"><div className="flex flex-col items-center gap-1.5 shadow-none"><span className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border shadow-none ${t.metode_pembayaran === 'qris' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'}`}>{t.metode_pembayaran}</span></div></td><td className="px-6 py-5 text-center whitespace-nowrap shadow-none">{t.gambar ? (<a href={t.gambar} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors shadow-none"><Camera className="h-4 w-4 text-neutral-600 dark:text-neutral-400 shadow-none" /></a>) : (<span className="text-[10px] font-semibold text-neutral-300 dark:text-neutral-700 uppercase shadow-none">No File</span>)}</td><td className="px-6 py-5 text-right whitespace-nowrap shadow-none"><div suppressHydrationWarning className={`text-base font-semibold italic tracking-tight shadow-none ${textMain}`}>Rp {t.total.toLocaleString('id-ID')}</div></td></tr>)))}</tbody></table></div><ScrollBar orientation="horizontal" className="shadow-none" /></ScrollArea></div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} className="h-10 w-10 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 dark:text-neutral-300 shadow-none">{dark ? <Sun className="h-5 w-5 shadow-none" /> : <Moon className="h-5 w-5 shadow-none" />}</Button>
        </div>
      </header>

      <main className="container mx-auto p-4 lg:p-6 max-w-7xl print:hidden shadow-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start shadow-none">
          <div className="lg:col-span-7 space-y-4 shadow-none">
            <div style={glassEffect} className={`space-y-4 bg-white/80 dark:bg-neutral-900/80 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 sticky top-20 z-30 shadow-none`}><div className="flex gap-2 shadow-none"><div className="relative flex-1 shadow-none"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 shadow-none ${textMuted}`} /><Input ref={searchInputRef} placeholder="Cari menu (F2)..." className={`h-11 pl-10 text-sm shadow-none ${inputBase}`} value={search} onChange={(e) => setSearch(e.target.value)} /></div></div><div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shadow-none">{categories.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shadow-none ${selectedCategory === cat ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-transparent shadow-none' : 'bg-transparent text-neutral-500 dark:text-neutral-400 border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>{cat}</button>))}</div></div>
            <ScrollArea className="h-[75vh] lg:h-[calc(100vh-240px)] pr-2 shadow-none"><div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-24 shadow-none">{products.filter(p => (selectedCategory === "Semua" || p.category === selectedCategory)).filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (<div key={p.id} onClick={() => addToCart(p)} className={`group cursor-pointer ${cardBase} rounded-xl p-4 flex flex-col justify-between h-32 hover:border-neutral-400 dark:hover:border-neutral-600 relative overflow-hidden active:scale-[0.98] shadow-none`}><div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-none"><div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 p-1 rounded-full shadow-none"><Plus className="h-3 w-3 shadow-none"/></div></div><div className="shadow-none"><span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 mb-1 block shadow-none">{p.category}</span><h3 className={`text-sm font-semibold leading-tight shadow-none ${textMain}`}>{p.name}</h3></div><p suppressHydrationWarning className={`text-base font-semibold shadow-none ${textMain}`}>Rp {p.price.toLocaleString('id-ID')}</p></div>))}</div></ScrollArea>
          </div>
          <div className="hidden lg:block lg:col-span-5 relative shadow-none"><div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col h-[calc(100vh-100px)] sticky top-20 overflow-hidden shadow-none`}>{MemoizedCheckoutPanel}</div></div>
        </div>
      </main>

      {/* MOBILE BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 shadow-none p-4"><div className="flex items-center justify-between mb-0 shadow-none"><div onClick={() => setShowMobileCart(!showMobileCart)} className="flex flex-col cursor-pointer shadow-none"><span className="text-[10px] text-neutral-500 dark:text-neutral-500 font-semibold uppercase tracking-wider flex items-center gap-1 shadow-none">{cart.length} Item <ChevronUp className={`h-3 w-3 transition-transform shadow-none ${showMobileCart ? 'rotate-180' : ''}`} /></span><span suppressHydrationWarning className={`text-lg font-bold shadow-none ${textMain}`}>Rp {total.toLocaleString('id-ID')}</span></div><Button onClick={() => setShowMobileCart(true)} className="bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white font-semibold h-10 px-6 shadow-none">Bayar</Button></div></div>
      
      <Dialog open={showMobileCart} onOpenChange={setShowMobileCart}>
         <DialogContent className="lg:hidden fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] border-none bg-white dark:bg-neutral-900 p-0 shadow-none rounded-2xl h-[85vh] overflow-hidden">
            <DialogHeader className="sr-only"><DialogTitle>Keranjang Belanja</DialogTitle></DialogHeader>
            {MemoizedCheckoutPanel}
         </DialogContent>
      </Dialog>

      <Dialog open={openScanner} onOpenChange={setOpenScanner}>
        <DialogContent className="sm:max-w-md p-0 bg-black text-white border-neutral-800 overflow-hidden shadow-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] rounded-2xl">
           <DialogHeader className="sr-only"><DialogTitle>Pindai QRIS</DialogTitle></DialogHeader>
           <div className="relative h-100 flex flex-col bg-black shadow-none"><div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-linear-to-b from-black/80 to-transparent shadow-none"><div className="flex items-center gap-2 shadow-none"><Camera className="h-5 w-5 text-white shadow-none" /><span className="font-semibold text-sm shadow-none">Scan QRIS</span></div><button onClick={() => setOpenScanner(false)} className="bg-white/10 p-1.5 rounded-full hover:bg-white/20 shadow-none"><X className="h-4 w-4 shadow-none" /></button></div><div className="flex-1 relative flex items-center justify-center overflow-hidden shadow-none">{cameraError ? (<div className="text-center p-6 text-red-400 text-sm shadow-none"><p className="shadow-none">{cameraError}</p><Button onClick={startCamera} size="sm" variant="outline" className="mt-4 border-red-500/50 text-red-400 shadow-none">Coba Lagi</Button></div>) : (<video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover shadow-none" />)}</div><div className="p-4 bg-neutral-900 shrink-0 flex flex-col gap-2 shadow-none"><Button onClick={handleCaptureAndPay} disabled={uploading || !!cameraError} className="w-full font-bold bg-green-600 hover:bg-green-700 text-white h-12 shadow-none">{uploading ? <Loader2 className="animate-spin h-5 w-5 mr-2 shadow-none" /> : <Upload className="h-5 w-5 mr-2 shadow-none" />}AMBIL FOTO & BAYAR</Button></div></div>
        </DialogContent>
      </Dialog>

      <Dialog open={openSuccess} onOpenChange={setOpenSuccess}>
        <DialogContent className="sm:max-w-100 p-0 overflow-hidden border-none shadow-none bg-transparent print:hidden focus:outline-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw]">
          <DialogHeader className="sr-only"><DialogTitle>Transaksi Berhasil</DialogTitle></DialogHeader>
          <div className="flex flex-col h-[85vh] w-full bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-none"><div className="bg-green-600 dark:bg-green-700 p-6 text-center text-white shrink-0 relative z-10 shadow-none"><div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm shadow-none"><Utensils className="h-6 w-6 shadow-none" /></div><h3 className="text-xl font-bold shadow-none">Berhasil!</h3><p suppressHydrationWarning className="text-green-100 dark:text-green-200 text-xs mt-1 font-mono shadow-none">{lastTransaction && new Date(lastTransaction.created_at).toLocaleString('id-ID')}</p></div><div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-6 w-full shadow-none"><div className="space-y-6 shadow-none">{lastTransaction?.gambar && (<div className="bg-white dark:bg-neutral-900 p-2 rounded border border-neutral-200 dark:border-neutral-800 shadow-none"><p className="text-[10px] text-neutral-500 dark:text-neutral-500 mb-2 text-center font-semibold uppercase shadow-none">Bukti Pembayaran</p><div className="relative w-full h-32 rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800 shadow-none"><Image src={lastTransaction.gambar} alt="Bukti" fill className="object-cover shadow-none" unoptimized /></div></div>)}<div className="space-y-3 shadow-none">{lastTransaction?.items.map((item, i) => (<div key={i} className="flex justify-between text-sm border-b border-dashed border-neutral-200 dark:border-neutral-800 pb-2 last:border-0 shadow-none"><div><span className="block font-medium text-neutral-700 dark:text-neutral-200 shadow-none">{item.name}</span><span className="text-[10px] text-neutral-400 dark:text-neutral-500 shadow-none">x{item.qty}</span></div><span suppressHydrationWarning className="font-bold text-neutral-900 dark:text-neutral-100 shadow-none">{(item.price * item.qty).toLocaleString('id-ID')}</span></div>))}</div><div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-none"><div className="flex justify-between text-lg font-black text-neutral-900 dark:text-neutral-100 mb-2 shadow-none"><span>Total</span><span suppressHydrationWarning className="shadow-none">Rp {lastTransaction?.total.toLocaleString('id-ID')}</span></div><div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1 shadow-none"><div className="flex justify-between shadow-none"><span>Metode</span><span className="uppercase shadow-none">{lastTransaction?.metode_pembayaran}</span></div>{lastTransaction?.metode_pembayaran === 'tunai' && (<div className="flex justify-between text-green-600 dark:text-green-400 font-bold shadow-none"><span>Kembalian</span><span suppressHydrationWarning className="shadow-none">{lastTransaction?.kembalian.toLocaleString('id-ID')}</span></div>)}</div></div></div></div><div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 shrink-0 z-10 shadow-none"><div className="grid grid-cols-2 gap-3 shadow-none"><Button onClick={handlePrint} variant="outline" className="h-11 border-neutral-300 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 dark:text-neutral-300 shadow-none"><Printer className="h-4 w-4 mr-2 shadow-none"/> Struk</Button><Button onClick={() => setOpenSuccess(false)} className="h-11 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 shadow-none">Menu Baru</Button></div></div></div></DialogContent></Dialog>
      <style jsx global>{`
        @media print {
            body { background: white !important; color: black !important; }
            .dark { color-scheme: light !important; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}