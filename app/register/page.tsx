'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Lock, Phone, Loader2, Utensils } from 'lucide-react' // Mengganti Mail dengan Phone
import { toast, Toaster } from 'sonner'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // 1. Ganti email menjadi phone di state
  const [form, setForm] = useState({ name: '', phone: '', password: '' })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 2. Cek Nomor HP (Ganti filter email menjadi phone)
      const { data: existingUser } = await supabase
        .from('users_app')
        .select('id')
        .eq('phone', form.phone)
        .single()

      if (existingUser) {
        throw new Error("Nomor HP ini sudah terdaftar.")
      }

      // 3. Simpan User dengan kolom phone
      const { error } = await supabase
        .from('users_app')
        .insert([{
          name: form.name,
          phone: form.phone,
          password: form.password
        }])

      if (error) throw error

      toast.success("Akun Berhasil Dibuat!", { description: "Silakan login sekarang." })
      setTimeout(() => router.push('/login'), 1500)

    } catch (err: any) {
      toast.error("Gagal Daftar", { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4 font-sans">
      <Toaster position="top-center" richColors />
      
      <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="h-10 w-10 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center mb-3 shadow-lg">
              <Utensils className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Buat Akun Baru</h1>
            <p className="text-xs text-neutral-500 mt-1">Daftar untuk mengakses sistem</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Input Nama */}
            <div className="space-y-1">
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input 
                  placeholder="Nama Lengkap" 
                  className="pl-9 h-10 text-sm bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  required
                />
              </div>
            </div>

            {/* 4. Input Nomor HP (Sebelumnya Email) */}
            <div className="space-y-1">
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input 
                  type="tel" // Menggunakan type tel untuk nomor telepon
                  placeholder="Nomor HP" 
                  className="pl-9 h-10 text-sm bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  value={form.phone}
                  onChange={e => setForm({...form, phone: e.target.value})}
                  required
                />
              </div>
            </div>

            {/* Input Password */}
            <div className="space-y-1">
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input 
                  type="password"
                  placeholder="Password" 
                  className="pl-9 h-10 text-sm bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  required
                />
              </div>
            </div>

            <Button 
            variant="default"
              type="submit" 
              disabled={loading} 
              className="w-full h-10"
            >
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Daftar Sekarang"}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-neutral-500">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
              Login disini
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}