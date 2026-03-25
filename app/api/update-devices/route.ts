// app/api/cron/update-devices/route.ts
import { supabase } from '@/lib/supabase'
import { fetchDevicePosition } from '@/app/actions'

export async function GET(request: Request) {
  try {
    // === ЗАЩИТА ОТ ПОСТОРОННИХ ЗАПУСКОВ ===
    const secret = request.headers.get('x-cron-secret')
    if (secret !== process.env.CRON_SECRET) {
      console.warn('[CRON] Попытка доступа без секретного ключа')
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Запуск обновления всех устройств...')

    const { data: devices, error } = await supabase
      .from('devices')
      .select('imei')

    if (error) {
      console.error('[CRON] Ошибка получения устройств:', error.message)
      return Response.json({ ok: false, error: error.message })
    }

    if (!devices || devices.length === 0) {
      console.log('[CRON] Устройств для обновления не найдено')
      return Response.json({ ok: true, message: 'Нет устройств' })
    }

    let successCount = 0
    let failCount = 0

    for (const d of devices) {
      if (!d.imei) continue

      try {
        await fetchDevicePosition(d.imei)
        successCount++
      } catch (err: any) {
        console.warn(`[CRON] Ошибка устройства ${d.imei}:`, err.message)
        failCount++
      }
    }

    console.log(`[CRON] Завершено. Успешно: ${successCount}, Ошибок: ${failCount}`)

    return Response.json({
      ok: true,
      updated: successCount,
      failed: failCount,
      total: devices.length
    })

  } catch (err: any) {
    console.error('[CRON] Критическая ошибка:', err.message)
    return Response.json({ 
      ok: false, 
      error: err.message 
    }, { status: 500 })
  }
}