import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStatusAfterPaid } from '@/lib/status'

/**
 * Webhook פתוח: אין צורך בחתימות/כותרות אימות.
 * מצופה לקבל אובייקט JSON מהספק (grow) עם registration_id איפשהו בגוף.
 * תומך במבנים שונים: metadata.registration_id / registration_id / external_id וכו'.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch (err) {
    console.error('payment-webhook: invalid json', err)
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // ----- חילוץ מזהים/שדות שימושיים במבנים שונים -----
  const registration_id =
    body?.metadata?.registration_id ??
    body?.data?.metadata?.registration_id ??
    body?.registration_id ??
    body?.external_id ??
    body?.order_id ??
    body?.data?.order_id ??
    null

  if (!registration_id) {
    console.error('payment-webhook: missing registration_id', { bodyKeys: Object.keys(body || {}) })
    // נחזיר 200 כדי לא לגרום לריטריים אינסופיים אצל ספקים מסוימים, אבל נסמן שגיאה לוגית
    return NextResponse.json({ ok: false, error: 'missing registration_id' }, { status: 200 })
  }

  const external_payment_id =
    body?.data?.transactionId ??
    body?.transactionId ??
    body?.id ??
    body?.external_payment_id ??
    body?.payment_id ??
    null

  const payment_method =
    body?.payment_method ??
    body?.method ??
    body?.data?.method ??
    null

  try {
    // שולפים את הסטטוס/paid הנוכחיים כדי לעשות עדכון אידמפוטנטי
    const { data: reg, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('id, status, paid')
      .eq('id', registration_id)
      .single()

    if (fetchErr || !reg) {
      console.error('payment-webhook: registration not found', { registration_id, fetchErr })
      // החזרה 200 כדי לאגרסיביות ריטריי מצד ספק, אבל מסמנים שלא עודכן
      return NextResponse.json({ ok: false, error: 'registration not found', registration_id }, { status: 200 })
    }

    const update: Record<string, any> = {}

    // אם כבר מסומן כמשולם, לא נכשל — פשוט מחזירים ok
    if (!reg.paid) update.paid = true

    // עדכוני עזר אם קיימים
    if (external_payment_id) update.external_payment_id = String(external_payment_id)
    if (payment_method) update.payment_method = String(payment_method)

    // עדכון סטטוס חכם על בסיס המצב הקודם
    const nextStatus = getStatusAfterPaid(true, reg.status)
    if (nextStatus !== reg.status) update.status = nextStatus

    if (Object.keys(update).length === 0) {
      // אין מה לעדכן (כנראה כבר paid/confirmed)
      console.info('payment-webhook: nothing to update (idempotent)', { registration_id })
      return NextResponse.json({ ok: true, registration_id, idempotent: true }, { status: 200 })
    }

    const { error: updErr } = await supabaseAdmin
      .from('registrations')
      .update(update)
      .eq('id', registration_id)

    if (updErr) {
      console.error('payment-webhook: update failed', { registration_id, update, updErr })
      // מחזירים 200 כדי למנוע ריטריים אין-סופיים — אפשר לשנות ל-500 אם תרצה שהספק ינסה שוב
      return NextResponse.json({ ok: false, error: updErr.message, registration_id }, { status: 200 })
    }

    console.info('payment-webhook: updated', { registration_id, update })
    return NextResponse.json({ ok: true, registration_id }, { status: 200 })
  } catch (err: any) {
    console.error('payment-webhook: unexpected error', { registration_id, err })
    // גם כאן נשיב 200 כדי לא לייצר הצפות ריטריים — שיקול מוצרי
    return NextResponse.json({ ok: false, error: 'server error', details: err?.message, registration_id }, { status: 200 })
  }
}