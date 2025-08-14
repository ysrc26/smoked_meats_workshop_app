// src/app/api/admin/registrations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workshop_id = searchParams.get('workshop_id') || undefined
    const status = searchParams.get('status') || undefined   // pending | confirmed | cancelled
    const paidStr = searchParams.get('paid') || undefined     // 'true' | 'false'
    const from = searchParams.get('from') || undefined        // yyyy-mm-dd
    const to = searchParams.get('to') || undefined            // yyyy-mm-dd

    let q = supabaseAdmin
      .from('registrations')
      .select(`
        id, full_name, email, phone, seats, status, paid, amount_paid,
        payment_method, payment_link, external_payment_id, created_at, workshop_id,
        workshop:workshops ( id, title, event_at, price )
      `)
      .order('created_at', { ascending: false })

    if (workshop_id) q = q.eq('workshop_id', workshop_id)
    if (status) q = q.eq('status', status)
    if (paidStr === 'true') q = q.eq('paid', true)
    if (paidStr === 'false') q = q.eq('paid', false)

    if (from) {
      // 00:00:00 של אותו יום
      const f = new Date(from + 'T00:00:00')
      q = q.gte('created_at', f.toISOString())
    }
    if (to) {
      // עד סוף היום
      const t = new Date(to + 'T23:59:59.999')
      q = q.lte('created_at', t.toISOString())
    }

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: 'server error', details: err?.message }, { status: 500 })
  }
}
