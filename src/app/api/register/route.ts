import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workshop_id, full_name, email, phone, seats } = body || {}

  if (!workshop_id || !full_name || !seats || seats < 1) {
    return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
  }

  // בדיקת זמינות מהירה
  const { data: w, error: wErr } = await supabaseAdmin
    .from('workshops_with_stats')
    .select('*')
    .eq('id', workshop_id)
    .single()
  if (wErr || !w) return NextResponse.json({ error: 'סדנה לא נמצאה' }, { status: 404 })
  if (w.seats_left < seats) return NextResponse.json({ error: 'אין מספיק מקומות פנויים' }, { status: 409 })

  const { data: reg, error: rErr } = await supabaseAdmin
    .from('registrations')
    .insert({ workshop_id, full_name, email, phone, seats, status: 'pending', paid: false })
    .select('id')
    .single()
  if (rErr || !reg) return NextResponse.json({ error: 'שגיאה ביצירת רישום' }, { status: 500 })

  let paymentLink: string | null = null
  try {
    const resp = await fetch(`${process.env.PAYMENTS_API_URL}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: w.price_cents * seats,
        metadata: { registration_id: reg.id },
      }),
    })
    if (resp.ok) {
      const pay = await resp.json()
      paymentLink = pay.url ?? null
      const externalId = pay.id ?? null
      await supabaseAdmin
        .from('registrations')
        .update({ payment_link: paymentLink, external_payment_id: externalId })
        .eq('id', reg.id)
    }
  } catch (e) {
    console.error('failed to create payment link', e)
  }

  return NextResponse.json({
    message: 'נרשמת בהצלחה! ' + (paymentLink ? 'ניתן לשלם כעת בקישור המצורף.' : 'המשך ההרשמה יטופל ידנית.'),
    payment_link: paymentLink ?? undefined,
  })
}