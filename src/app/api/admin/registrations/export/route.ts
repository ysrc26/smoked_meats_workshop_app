// src/app/api/admin/registrations/export/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function csvEscape(v: any) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workshop_id = searchParams.get('workshop_id') || undefined
    const status = searchParams.get('status') || undefined
    const paidStr = searchParams.get('paid') || undefined
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

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

    if (from) q = q.gte('created_at', new Date(from + 'T00:00:00').toISOString())
    if (to) q = q.lte('created_at', new Date(to + 'T23:59:59.999').toISOString())

    const { data, error } = await q
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    // Header בעברית (אפשר לשנות לפי צורך)
    const headers = [
      'מזהה רישום', 'סדנה', 'תאריך סדנה', 'מחיר סדנה',
      'שם מלא', 'אימייל', 'טלפון',
      'כמות', 'שולם', 'שולם בפועל', 'שיטת תשלום',
      'סטטוס', 'קישור תשלום', 'מזהה חיצוני', 'תאריך רישום'
    ]

    const rows = (data || []).map((r: any) => ([
      r.id,
      r.workshop?.title ?? '',
      r.workshop?.event_at ? new Date(r.workshop.event_at).toLocaleString('he-IL') : '',
      (r.workshop?.price ?? ''),
      r.full_name ?? '',
      r.email ?? '',
      r.phone ?? '',
      r.seats ?? '',
      r.paid ? 'כן' : 'לא',
      r.amount_paid ?? 0,
      r.payment_method ?? '',
      r.status ?? '',
      r.payment_link ?? '',
      r.external_payment_id ?? '',
      r.created_at ? new Date(r.created_at).toLocaleString('he-IL') : '',
    ]))

    // BOM ל־Excel בעברית
    const bom = '\uFEFF'
    const csv =
      bom +
      headers.map(csvEscape).join(',') + '\n' +
      rows.map(r => r.map(csvEscape).join(',')).join('\n')

    const filename = `registrations_${new Date().toISOString().slice(0,10)}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'server error', details: err?.message }), { status: 500 })
  }
}
