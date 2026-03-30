// components/AuthModal.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { signIn, signUp } from '@/app/auth/actions'
import { toast } from 'sonner'

type AuthModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        await signIn(email, password)
        toast.success('Успешный вход')
        onOpenChange(false)
      } else {
        await signUp(email, password)
        toast.success('Регистрация прошла успешно! Проверьте почту.')
        setIsLogin(true) // после регистрации переключаем на вход
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[92vw] md:max-w-md rounded-3xl z-[1500]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            {isLogin ? 'Вход в аккаунт' : 'Регистрация'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-6">
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="bg-zinc-950 border-white/20 h-12"
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Пароль</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-zinc-950 border-white/20 h-12"
              required
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-12 bg-green-500 hover:bg-green-400 text-black font-medium"
          >
            {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </Button>

          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-sm text-zinc-400 hover:text-white transition-colors"
          >
            {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}