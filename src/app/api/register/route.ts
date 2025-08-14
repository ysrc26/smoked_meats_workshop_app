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

  // אם יש לינק תשלום בסדנה – נחזיר למשתמש
  const paymentLink = w.payment_link as string | null

  return NextResponse.json({
    message: 'נרשמת בהצלחה! ' + (paymentLink ? 'ניתן לשלם כעת בקישור המצורף.' : 'המשך ההרשמה יטופל ידנית.'),
    payment_link: paymentLink ?? undefined,
  })
}