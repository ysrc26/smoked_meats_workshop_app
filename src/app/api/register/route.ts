// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workshop_id, full_name, email, phone, seats } = body || {}

  if (!workshop_id || !full_name || !seats || seats < 1) {
    return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
  }

  // 1) שליפת הסדנה (כולל payment_link מובנה)
  const { data: w, error: wErr } = await supabaseAdmin
    .from('workshops_with_stats')
    .select('*')
    .eq('id', workshop_id)
    .single()

  if (wErr || !w) {
    console.error('register: workshop not found', { workshop_id, wErr })
    return NextResponse.json({ error: 'סדנה לא נמצאה' }, { status: 404 })
  }
  if (w.seats_left < seats) {
    return NextResponse.json({ error: 'אין מספיק מקומות פנויים' }, { status: 409 })
  }

  // 2) יצירת רישום
  const { data: reg, error: rErr } = await supabaseAdmin
    .from('registrations')
    .insert({ workshop_id, full_name, email, phone, seats, status: 'pending', paid: false })
    .select('id')
    .single()

  if (rErr || !reg) {
    console.error('register: insert registration failed', { rErr })
    return NextResponse.json({ error: 'שגיאה ביצירת רישום' }, { status: 500 })
  }

  // 3) ברירת-מחדל: קישור התשלום של הסדנה (אם מוגדר)
  let paymentLink: string | null = (w as any).payment_link || null

  // 4) נסיון לקישור דינאמי דרך ספק חיצוני (אופציונלי)
  const apiBase = process.env.PAYMENTS_API_URL?.trim()
  if (apiBase) {
    try {
      const resp = await fetch(`${apiBase.replace(/\/+$/,'')}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(w.price_cents) * Number(seats), // באגורות
          metadata: { registration_id: reg.id },
          // אפשר להוסיף כאן success_url/cancel_url אם הספק תומך
        }),
      })

      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        console.error('payment-links API non-200', { status: resp.status, body: t })
      } else {
        const pay = await resp.json().catch(() => ({} as any))
        // תמיכה בשמות שדה נפוצים
        const dynamicUrl =
          pay.url || pay.link || pay.payment_url || pay.redirect_url || null
        const externalId = pay.id || pay.external_id || null

        if (dynamicUrl) paymentLink = String(dynamicUrl)

        // נשמור את מה שיש לנו לרישום
        await supabaseAdmin
          .from('registrations')
          .update({
            ...(paymentLink && { payment_link: paymentLink }),
            ...(externalId && { external_payment_id: externalId }),
          })
          .eq('id', reg.id)
      }
    } catch (e) {
      console.error('payment-links API call failed', e)
      // נמשיך עם paymentLink (אם קיים מהסדנה) ולא נכשיל את ההרשמה
    }
  } else {
    // אין ספק חיצוני — זה תקין אם עובדים עם קישור סדנה סטטי
    if (!paymentLink) {
      console.warn('No PAYMENTS_API_URL and workshop has no payment_link')
    }
  }

  return NextResponse.json({
    message:
      'נרשמת בהצלחה! ' +
      (paymentLink ? 'ניתן לשלם כעת בקישור המצורף.' : 'המשך ההרשמה יטופל ידנית.'),
    payment_link: paymentLink ?? undefined,
  })
}