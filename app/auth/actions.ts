// app/auth/actions.ts
'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function signUp(email: string, password: string) {
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) throw new Error(error.message)
  
  return { success: true, message: 'Регистрация прошла успешно. Проверьте почту.' }
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/')
  return { success: true }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
  
  revalidatePath('/')
}