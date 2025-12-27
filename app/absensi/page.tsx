'use client'

import { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Camera, UserPlus, CheckCircle2, 
  History, LayoutDashboard, ShoppingCart, Truck 
} from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'

// Inisialisasi Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FaceProfile {
  id: number
  nama_karyawan: string
  face_image_url: string
  face_landmarks: any
  created_at?: string
}

interface AttendanceLog {
  id: number
  karyawan_id: number
  tipe_absen: string
  created_at: string
  face_profiles?: {
    nama_karyawan: string
  }
}

interface Transaction {
  id: number
  total: number
  metode_pembayaran: string
  created_at: string
}

export default function UnifiedSystemUI() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [labeledDescriptors, setLabeledDescriptors] = useState<faceapi.LabeledFaceDescriptors[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [recentSales, setRecentSales] = useState<Transaction[]>([])

  useEffect(() => {
    const initSystem = async () => {
      try {
        const MODEL_URL = '/models'
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
        ])
        await Promise.all([loadProfiles(), fetchLogs(), fetchSales()])
        setIsModelLoaded(true)
        startVideo()
      } catch (error) {
        console.error('Error initializing system:', error)
        toast.error("Gagal memuat sistem AI")
      }
    }
    initSystem()

    // Cleanup function
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      toast.error("Gagal mengakses kamera")
    }
  }

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('face_profiles')
        .select('*')
      
      if (error) throw error
      if (!data) return

      const descriptors = await Promise.all(
        data.map(async (p: FaceProfile) => {
          try {
            const img = await faceapi.fetchImage(p.face_image_url)
            const det = await faceapi
              .detectSingleFace(img)
              .withFaceLandmarks()
              .withFaceDescriptor()
            
            return det 
              ? new faceapi.LabeledFaceDescriptors(p.id.toString(), [det.descriptor]) 
              : null
          } catch (err) {
            console.error(`Error loading profile ${p.id}:`, err)
            return null
          }
        })
      )
      
      setLabeledDescriptors(
        descriptors.filter(d => d !== null) as faceapi.LabeledFaceDescriptors[]
      )
    } catch (error) {
      console.error('Error loading profiles:', error)
      toast.error("Gagal memuat profil wajah")
    }
  }

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('absensi')
        .select('*, face_profiles(nama_karyawan)')
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (error) throw error
      setAttendanceLogs(data || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      setRecentSales(data || [])
    } catch (error) {
      console.error('Error fetching sales:', error)
    }
  }

  const registerFace = async () => {
    const nama = prompt("Nama Lengkap Karyawan:")
    if (!nama || !videoRef.current) return
    
    setIsRegistering(true)
    const tid = toast.loading("Menganalisa titik wajah...")
    
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor()
      
      if (!detection) {
        throw new Error("Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di kamera.")
      }

      // Capture image
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      
      if (!ctx) throw new Error("Gagal membuat canvas context")
      
      ctx.drawImage(videoRef.current, 0, 0)
      
      const blob = await new Promise<Blob | null>(res => 
        canvas.toBlob(res, 'image/jpeg', 0.9)
      )
      
      if (!blob) throw new Error("Gagal capture gambar")

      // Upload to Supabase Storage
      const path = `face_${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('face_templates')
        .upload(path, blob, { contentType: 'image/jpeg' })
      
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('face_templates')
        .getPublicUrl(path)

      // Save to database
      const { error: insertError } = await supabase
        .from('face_profiles')
        .insert([{ 
          nama_karyawan: nama, 
          face_image_url: publicUrl, 
          face_landmarks: detection.landmarks.positions 
        }])
      
      if (insertError) throw insertError

      toast.success("Berhasil didaftarkan", { id: tid })
      await loadProfiles()
    } catch (err: any) {
      console.error('Registration error:', err)
      toast.error(err.message || "Gagal mendaftarkan wajah", { id: tid })
    } finally { 
      setIsRegistering(false) 
    }
  }

  const onPlay = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const displaySize = { width: 640, height: 480 }
    faceapi.matchDimensions(canvasRef.current, displaySize)
    
    // Clear any existing interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
    }
    
    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return
      
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()
        
        const resized = faceapi.resizeResults(detections, displaySize)
        const ctx = canvasRef.current.getContext('2d')
        
        if (ctx) {
          ctx.clearRect(0, 0, 640, 480)
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resized)
        }
        
        if (labeledDescriptors.length > 0) {
          const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6)
          
          for (const det of resized) {
            const result = matcher.findBestMatch(det.descriptor)
            
            if (result.label !== 'unknown') {
              const fiveMinsAgo = new Date(Date.now() - 5 * 60000).toISOString()
              const { data } = await supabase
                .from('absensi')
                .select('id')
                .eq('karyawan_id', result.label)
                .gt('created_at', fiveMinsAgo)
              
              if (!data || data.length === 0) {
                const { error } = await supabase
                  .from('absensi')
                  .insert([{ 
                    karyawan_id: parseInt(result.label), 
                    tipe_absen: 'masuk' 
                  }])
                
                if (!error) {
                  toast.success(`Absen Berhasil: ${result.toString()}`)
                  fetchLogs()
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Detection error:', error)
      }
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <Toaster position="top-right" richColors />
      
      {/* Navbar Minimalis */}
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SmartPOS <span className="text-blue-600">AI</span></h1>
        </div>
        <div className="flex gap-4">
          <Badge variant="outline" className="px-3 py-1 bg-green-50 text-green-700 border-green-200">
            {isModelLoaded ? 'System Online' : 'Loading...'}
          </Badge>
        </div>
      </nav>

      <main className="p-6 lg:p-10 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* KOLOM KIRI: Scanner & Control (8 Kolom) */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-2xl shadow-blue-100 overflow-hidden bg-slate-950">
              <CardHeader className="border-b border-slate-800 bg-slate-900/50">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Camera className="w-5 h-5 text-blue-400" /> Scanner Biometrik
                    </CardTitle>
                    <CardDescription className="text-slate-400">Deteksi otomatis 68 titik wajah</CardDescription>
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Live Mode</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 relative flex items-center justify-center bg-[#020617] aspect-video">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline
                  onPlay={onPlay} 
                  className="w-full h-full object-cover scale-x-[-1]" 
                />
                <canvas 
                  ref={canvasRef} 
                  className="absolute top-0 left-0 w-full h-full scale-x-[-1]" 
                />
                {!isModelLoaded && (
                  <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
                    <p className="animate-pulse text-slate-400">Menginisialisasi AI Engine...</p>
                  </div>
                )}
                {/* Frame Overlay */}
                <div className="absolute inset-0 border-[40px] border-slate-950/20 pointer-events-none ring-1 ring-white/10" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={registerFace} 
                disabled={isRegistering || !isModelLoaded} 
                size="lg" 
                className="h-16 text-lg bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                {isRegistering ? (
                  <Loader2 className="mr-2 animate-spin" />
                ) : (
                  <UserPlus className="mr-2" />
                )}
                Daftarkan Wajah Baru
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="h-16 text-lg border-slate-200 bg-white hover:bg-slate-50 shadow-sm" 
                onClick={() => window.location.reload()}
              >
                Reset Scanner
              </Button>
            </div>
          </div>

          {/* KOLOM KANAN: Logs & Activity (4 Kolom) */}
          <div className="lg:col-span-4 space-y-6">
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList className="w-full grid grid-cols-2 h-12 bg-slate-100 p-1">
                <TabsTrigger value="attendance" className="rounded-md">Absensi</TabsTrigger>
                <TabsTrigger value="sales" className="rounded-md">Penjualan</TabsTrigger>
              </TabsList>

              <TabsContent value="attendance">
                <Card className="border-none shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="w-5 h-5 text-blue-600" /> Log Kehadiran
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      <div className="p-4 space-y-4">
                        {attendanceLogs.length === 0 ? (
                          <div className="text-center py-20 text-slate-400">Belum ada aktivitas</div>
                        ) : (
                          attendanceLogs.map((log) => (
                            <div key={log.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-md transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                                  {log.face_profiles?.nama_karyawan?.[0] || '?'}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800 leading-none">
                                    {log.face_profiles?.nama_karyawan || 'Unknown'}
                                  </p>
                                  <span className="text-[11px] text-slate-500">
                                    {new Date(log.created_at).toLocaleString('id-ID')}
                                  </span>
                                </div>
                              </div>
                              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50">
                                {log.tipe_absen}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sales">
                <Card className="border-none shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-orange-500" /> Penjualan Terbaru
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      <div className="p-4 space-y-4">
                        {recentSales.length === 0 ? (
                          <div className="text-center py-20 text-slate-400">Belum ada penjualan</div>
                        ) : (
                          recentSales.map((sale) => (
                            <div key={sale.id} className="p-4 bg-white border border-slate-100 rounded-xl">
                              <div className="flex justify-between mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                  INV-{sale.id}
                                </span>
                                <Badge variant="secondary" className="bg-slate-100">
                                  Rp {sale.total.toLocaleString()}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium text-slate-700">
                                {sale.metode_pembayaran.toUpperCase()}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {new Date(sale.created_at).toLocaleDateString('id-ID')}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

        </div>
      </main>
    </div>
  )
}
