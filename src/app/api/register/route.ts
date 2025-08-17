// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'
import { registrationReceived } from '@/lib/emailTemplates'


export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workshop_id, full_name, email, phone, seats } = body || {}

  if (!workshop_id || !full_name || !seats || seats < 1) {
    return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
  }

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

  // ברירת־מחדל: קישור תשלום סטטי מהסדנה (אם קיים)
  let paymentLink: string | null = (w as any).payment_link || null

  // ספק תשלום חיצוני — שולח סכום בשקלים (לא אגורות)
  const apiBase = process.env.PAYMENTS_API_URL?.trim()
  if (apiBase) {
    try {
      const resp = await fetch(`${apiBase.replace(/\/+$/,'')}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(w.price_nis) * Number(seats), // ₪, לא אגורות
          metadata: { registration_id: reg.id },
        }),
      })
      if (resp.ok) {
        const pay = await resp.json().catch(() => ({} as any))
        const dynamicUrl =
          pay.url || pay.link || pay.payment_url || pay.redirect_url || null
        const externalId = pay.id || pay.external_id || null

        if (dynamicUrl) paymentLink = String(dynamicUrl)

        await supabaseAdmin
          .from('registrations')
          .update({
            ...(paymentLink && { payment_link: paymentLink }),
            ...(externalId && { external_payment_id: externalId }),
          })
          .eq('id', reg.id)
      } else {
        const t = await resp.text().catch(() => '')
        console.error('payment-links API non-200', { status: resp.status, body: t })
      }
    } catch (e) {
      console.error('payment-links API call failed', e)
    }
  }

  // שליחת מייל אישור הרשמה
  try {
    if (email) {
      const tpl = registrationReceived(full_name, {
        title: w.title,
        event_at: w.event_at,
        price: w.price,
        payment_link: paymentLink || w.payment_link || null
      }, seats)
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
    }
  } catch (e) {
    console.error('email send failed (registration)', e)
    // לא מפילים את הבקשה בגלל מייל
  }

  return NextResponse.json({
    message:
      'נרשמת בהצלחה! ' +
      (paymentLink ? 'ניתן לשלם כעת בקישור המצורף.' : 'המשך ההרשמה יטופל ידנית.'),
    payment_link: paymentLink ?? undefined,
  })
}