// app/actions.ts
'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { encrypt, decrypt } from '@/lib/encryption'

// ====================== ЛОГИН ======================
async function loginWithDeviceCredentials(
  baseUrl: string, 
  imei: string, 
  encryptedPassword: string
): Promise<string> {
  const password = await decrypt(encryptedPassword)   // расшифровываем

  const url = `${baseUrl}/user/login.do?name=${encodeURIComponent(imei)}&password=${encodeURIComponent(password.trim())}`
  
  const res = await fetch(url, { 
    method: 'GET', 
    headers: { Accept: 'application/json' }, 
    cache: 'no-store' 
  })

  if (!res.ok) throw new Error(`Login HTTP ${res.status}`)

  const json = await res.json()
  
  if (json.ret !== 1) {
    throw new Error(json.msg || `Login error: ret = ${json.ret}`)
  }

  const token = json.data?.token || json.data?.[0]?.token
  if (!token) throw new Error('Token not received')

  return token
}

// ====================== ДОБАВЛЕНИЕ УСТРОЙСТВА ======================
export async function addDevice(imei: string, name: string, password: string) {
  const cleanImei = imei.trim()
  if (!cleanImei || cleanImei.length < 10) throw new Error('Некорректный IMEI')

  const cleanName = name.trim() || 'Без названия'
  const finalPassword = password.trim() || cleanImei.slice(-6)

  const encryptedPassword = await encrypt(finalPassword)   // ← шифруем

  const { error } = await supabase.from('devices').upsert({
    imei: cleanImei,
    name: cleanName,
    encrypted_password: encryptedPassword,        // ← зашифрованный пароль
    base_url: 'https://www.whatsgps.com',
  }, { onConflict: 'imei' })

  if (error) {
    throw new Error(`Ошибка при добавлении устройства: ${error.message}`)
  }

  await fetchDevicePosition(cleanImei).catch(() => {})
  revalidatePath('/')
}

// ====================== ОБНОВЛЕНИЕ ВСЕХ ======================
export async function updateAllDevices() {
  const { data: devices, error } = await supabase
    .from('devices')
    .select('imei, encrypted_password')

  if (error) {
    console.error('[UPDATE ALL DEVICES] DB error:', error.message)
    return
  }

  if (!devices?.length) return

  for (const dev of devices) {
    if (dev.encrypted_password) {
      await fetchDevicePosition(dev.imei).catch(() => {})
    }
  }
  revalidatePath('/')
}

// ====================== ТЕКУЩАЯ ПОЗИЦИЯ ======================
export async function fetchDevicePosition(imei: string) {
  try {
    const { data: device, error } = await supabase
      .from('devices')
      .select('encrypted_password, base_url, name')
      .eq('imei', imei)
      .single()

    if (error) {
      console.error(`[DB FETCH ERROR] ${imei}:`, error.message)
      return
    }

    if (!device?.encrypted_password) {
      console.warn(`[NO PASSWORD] for IMEI ${imei}`)
      return
    }

    const baseUrl = device.base_url || 'https://www.whatsgps.com'

    let token: string
    try {
      token = await loginWithDeviceCredentials(baseUrl, imei, device.encrypted_password)
    } catch (loginErr: any) {
      console.error(`[LOGIN FAILED] ${imei}:`, loginErr.message)
      return
    }

    const res = await fetch(
      `${baseUrl}/car/getByImei.do?token=${encodeURIComponent(token)}&imei=${encodeURIComponent(imei)}`,
      { cache: 'no-store' }
    )

    if (!res.ok) {
      console.error(`[FETCH ERROR] HTTP ${res.status} for IMEI ${imei}`)
      return
    }

    const json = await res.json()
    const car = json.data?.[0] || json.data?.carStatus || json.data || json

    if (!car?.lat || !car?.lon) {
      console.log(`[NO POSITION] for IMEI ${imei}`)
      return
    }

    // === ПАРСИНГ НАПРЯЖЕНИЯ ===
    let voltage: number | null = null
    if (car.exData) {
      const match = car.exData.match(/v=(\d+)/)
      if (match && match[1]) {
        const mv = parseInt(match[1], 10)
        voltage = mv / 1000
        console.log(`[VOLTAGE PARSED] ${imei} → ${voltage}V`)
      }
    }

    const speed = car.speed !== undefined ? parseFloat(car.speed) : null
    const gpsTime = car.gpstime || car.time || car.updatetime || car.lasttime || null

    const updateData = {
      lat: parseFloat(car.lat),
      lng: parseFloat(car.lon),
      speed: speed,
      voltage: voltage,
      last_updated: new Date().toISOString(),
      gps_time: gpsTime,
    }

    const { error: updateError } = await supabase
      .from('devices')
      .update(updateData)
      .eq('imei', imei)

    if (updateError) {
      console.error(`[DB UPDATE ERROR] ${imei}:`, updateError)
    } else {
      console.log(`[SUCCESS] Position updated for ${imei}`)
    }

  } catch (err: any) {
    console.error(`[POSITION ERROR] ${imei}:`, err.message || err)
  }
}

// ====================== ИСТОРИЯ ТРЕКА ЗА СЕГОДНЯ ======================
export async function fetchTodayHistory(imei: string) {
  try {
    console.log(`[HISTORY START] IMEI: ${imei}`)

    const { data: device, error } = await supabase
      .from('devices')
      .select('encrypted_password, base_url')
      .eq('imei', imei)
      .single()

    if (error || !device?.encrypted_password) {
      throw new Error('Пароль устройства не найден')
    }

    const baseUrl = device.base_url || 'https://www.whatsgps.com'
    const token = await loginWithDeviceCredentials(baseUrl, imei, device.encrypted_password)

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const formatTime = (date: Date) => date.toISOString().replace('T', ' ').slice(0, 19)

    const startTime = formatTime(yesterday)
    const endTime = formatTime(now)

    const url = `${baseUrl}/position/queryHistory.do?token=${encodeURIComponent(token)}&imei=${encodeURIComponent(imei)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&mapType=2`

    const res = await fetch(url, { 
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const json = await res.json()
    console.log(`[HISTORY RESPONSE] ret=${json.ret}, data items=${json.data?.length || 0}`)

    if (json.ret !== 1) {
      const msg = json.msg || ''
      
      if (msg.includes('车辆不存在') || msg.includes('vehicle not exist') || msg.includes('not exist')) {
        throw new Error('На данный момент нельзя отследить трек, функция находится в разработке.')
      }
      
      throw new Error(msg || `API error ret=${json.ret}`)
    }

    const points = (json.data || [])
      .map((p: any) => ({
        lat: parseFloat(p.lat || p.latitude || '0'),
        lng: parseFloat(p.lng || p.longitude || '0'),
      }))
      .filter((p: { lat: number; lng: number }) =>
        !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0
      )

    console.log(`[HISTORY SUCCESS] ${points.length} точек`)
    return points

  } catch (err: any) {
    console.error(`[HISTORY ERROR] ${imei}:`, err.message)
    throw new Error(err.message || 'Не удалось загрузить историю трека')
  }
}