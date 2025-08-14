// src/app/api/admin/registrations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStatusAfterPaid } from '@/lib/status'

/**
 * עוזר לנירמול שיטת תשלום
 */
function normalizePaymentMethod(v: unknown): 'cash' | 'card' | 'transfer' | 'other' | null {
  if (v === null) return null
  const s = String(v || '').trim().toLowerCase()
  if (!s || s === 'none' || s === 'null') return null
  if (s === 'cash') return 'cash'
  if (s === 'card' || s === 'credit' || s === 'creditcard') return 'card'
  if (s === 'transfer' || s === 'bank' || s === 'bit' || s === 'banktransfer') return 'transfer'
  return 'other'
}

/**
 * מביא את ההרשמה + מחיר הסדנה
 */
async function fetchRegistrationWithWorkshop(id: string) {
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('registrations')
    .select('id, workshop_id, seats, paid, status, amount_paid, payment_method, payment_link, created_at')
    .eq('id', id)
    .single()

  if (regErr || !reg) {
    return { error: regErr?.message || 'registration not found' }
  }

  const { data: w, error: wErr } = await supabaseAdmin
    .from('workshops')
    .select('price')
    .eq('id', reg.workshop_id)
    .single()

  if (wErr || !w || typeof w.price !== 'number') {
    return { error: 'workshop price not found' }
  }

  return { reg, price: Number(w.price) }
}

/**
 * PATCH /api/admin/registrations/[id]
 * מעדכן כמות, סכום ששולם, שיטת תשלום, סטטוס וקישור תשלום.
 * paid מחושב אוטומטית לפי amount_paid >= price*seats (אלא אם בוחרים לכפות סטטוס ידנית).
 */
export async function PATCH(req: NextRequest, context: any) {
  try {
    const id = context?.params?.id as string
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const incomingSeats = typeof body.seats === 'number' ? Math.max(1, Math.floor(body.seats)) : undefined
    const incomingAmountPaid = typeof body.amount_paid === 'number' ? Math.max(0, Math.floor(body.amount_paid)) : undefined
    const incomingPaymentMethod = normalizePaymentMethod(body.payment_method)
    const incomingPaymentLink =
      body.payment_link === null ? null :
      typeof body.payment_link === 'string' ? body.payment_link.trim() : undefined
    const incomingStatus =
      typeof body.status === 'string' && ['pending', 'confirmed', 'cancelled'].includes(body.status)
        ? (body.status as 'pending' | 'confirmed' | 'cancelled')
        : undefined
    // נאסוף גם paid אם הגיע מה־UI, אבל נחשב מחדש בסוף לפי הסכום הכולל
    const incomingPaid: boolean | undefined =
      typeof body.paid === 'boolean' ? body.paid : undefined

    // שליפת הרשומה והמחיר
    const fetched = await fetchRegistrationWithWorkshop(id)
    // @ts-ignore
    if (fetched.error) {
      // @ts-ignore
      return NextResponse.json({ error: fetched.error }, { status: 404 })
    }
    // @ts-ignore
    const { reg, price } = fetched as { reg: any; price: number }

    // חישוב מצבו החדש של הרישום
    const seats = incomingSeats ?? Number(reg.seats ?? 1)
    const amountPaid = incomingAmountPaid ?? Number(reg.amount_paid ?? 0)
    const total = price * seats

    // paid מחושב אוטומטית לפי סכום ששולם מול הסכום הכולל
    const computedPaid = amountPaid >= total

    // סטטוס: אם נשלח מפורשות — נכבד אותו; אחרת נחשב מהמצב הקודם והאם שולם
    const nextStatus =
      incomingStatus ?? getStatusAfterPaid(computedPaid, reg.status as 'pending' | 'confirmed' | 'cancelled')

    const patch: Record<string, any> = {
      seats,
      amount_paid: amountPaid,
      paid: computedPaid, // מתעלמים מ-incomingPaid כדי לשמור קוהרנטיות
      status: nextStatus,
    }

    if (incomingPaymentMethod !== undefined) patch.payment_method = incomingPaymentMethod
    if (incomingPaymentLink !== undefined) patch.payment_link = incomingPaymentLink

    const { error: updErr } = await supabaseAdmin
      .from('registrations')
      .update(patch)
      .eq('id', id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      id,
      patch,
      totals: { total, amount_paid: amountPaid, paid: computedPaid }
    })
  } catch (err: any) {
    console.error('admin registrations PATCH error', err)
    return NextResponse.json({ error: 'server error', details: err?.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/registrations/[id]
 * מוחק רישום (מתפנה מקום אוטומטית כי ה-view מחשב seats_left דינמית).
 */
export async function DELETE(_req: NextRequest, context: any) {
  try {
    const id = context?.params?.id as string
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('registrations')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id })
  } catch (err: any) {
    console.error('admin registrations DELETE error', err)
    return NextResponse.json({ error: 'server error', details: err?.message }, { status: 500 })
  }
}
