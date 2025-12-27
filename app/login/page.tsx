'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// Mengganti Mail dengan User/Phone untuk UI yang lebih relevan
import { Lock, User, Loader2, Utensils } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // State identifier menampung username atau nomor hp
  const [form, setForm] = useState({ identifier: '', password: '' })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Menggunakan operator .or() untuk mencari di kolom name ATAU phone
      const { data, error } = await supabase
        .from('users_app')
        .select('*')
        .or(`name.eq.${form.identifier},phone.eq.${form.identifier}`)
        .eq('password', form.password)
        .single()

      if (error || !data) {
        throw new Error("Username/Nomor HP atau password salah.")
      }

      localStorage.setItem('user_session', JSON.stringify(data))
      toast.success("Login Berhasil!", { description: `Halo, ${data.name}` })
      
      setTimeout(() => router.push('/delivery'), 1000)

    } catch (err: any) {
      toast.error("Gagal Masuk", { description: err.message })
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
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Selamat Datang</h1>
            <p className="text-xs text-neutral-500 mt-1">Masuk untuk mengelola pesanan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input 
                  type="text" 
                  placeholder="Username atau Nomor HP" 
                  className="pl-9 h-10 text-sm bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  value={form.identifier}
                  onChange={e => setForm({...form, identifier: e.target.value})}
                  required
                />
              </div>
            </div>
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
              className="w-full h-10 "
            >
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Masuk"}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-neutral-500">
            Belum punya akun?{' '}
            <Link href="/register" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
              Daftar disini
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}