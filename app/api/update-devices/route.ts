import { supabase } from '@/lib/supabase'
import { fetchDevicePosition } from '@/app/actions'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('imei')

    if (error) {
      console.error('[CRON] Ошибка получения устройств:', error.message)
      return Response.json({ ok: false })
    }

    for (const d of data || []) {
      if (!d.imei) continue

      try {
        await fetchDevicePosition(d.imei)
      } catch (err: any) {
        console.warn('[CRON] Ошибка устройства:', d.imei, err.message)
      }
    }

    return Response.json({ ok: true })
  } catch (err: any) {
    console.error('[CRON] Общая ошибка:', err.message)
    return Response.json({ ok: false })
  }
}