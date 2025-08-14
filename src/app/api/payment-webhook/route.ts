import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStatusAfterPaid } from '@/lib/status'

/**
 * Webhook ל-grow ללא סיקרטים:
 * משדך תשלום לרישום לפי אימייל/טלפון בלבד.
 * - תומך בפיילוד שהוא מערך עם אובייקט יחיד, או אובייקט ישיר.
 * - מבצע התאמה רק לרישומים recent (ברירת מחדל 7 ימים), pending && !paid.
 * - אידמפוטנטי: אם כבר שולם, מחזיר ok בלי שגיאה.
 */
export async function POST(req: NextRequest) {
  // --- Parse JSON (array or object) ---
  let raw: any
  try {
    raw = await req.json()
  } catch (err) {
    console.error('payment-webhook: invalid json', err)
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 200 })
  }
  // חלק מהסביבות של Grow מחזירות מערך עם אובייקט יחיד
  const root = Array.isArray(raw) ? raw[0] : raw
  const data = root?.data ?? root ?? {}

  // --- Extract fields from Grow PaymentLinks ---
  const external_payment_id =
    data?.transactionId ?? data?.paymentId ?? data?.id ?? null

  const email = (data?.payerEmail ?? data?.email ?? '').trim().toLowerCase()
  const phoneRaw = (data?.payerPhone ?? data?.phone ?? '').trim()
  const onlyDigits = (s: string) => s.replace(/\D+/g, '')
  const phoneDigits = onlyDigits(phoneRaw)
  const phoneDashed = phoneDigits.length === 10 ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3)}` : ''

  // נאכוף תשלום מוצלח בלבד
  const statusTxt: string = String(data?.status ?? '')
  const statusCode: string = String(data?.statusCode ?? '')
  const isPaid = statusCode === '2' || statusTxt === 'שולם'
  if (!isPaid) {
    console.warn('payment-webhook: payment is not marked as paid', { statusTxt, statusCode })
    return NextResponse.json({ ok: false, error: 'not paid' }, { status: 200 })
  }

  if (!email && !phoneDigits) {
    console.error('payment-webhook: missing email/phone in payload')
    return NextResponse.json({ ok: false, error: 'missing email/phone' }, { status: 200 })
  }

  try {
    // --- Idempotency: אם כבר קיים external_payment_id זהה, טפל בזה קודם ---
    if (external_payment_id) {
      const { data: existing, error: findByExtErr } = await supabaseAdmin
        .from('registrations')
        .select('id, paid, status')
        .eq('external_payment_id', String(external_payment_id))
        .maybeSingle()

      if (!findByExtErr && existing) {
        if (existing.paid) {
          console.info('payment-webhook: idempotent (already paid)', { id: existing.id })
          return NextResponse.json(
            { ok: true, idempotent: true, registration_id: existing.id },
            { status: 200 }
          )
        }
        // נמשיך לעדכון כללי למקרה שצריך להשלים שדות/סטטוס
      }
    }

    // --- משיכת מועמדים לפי אימייל/טלפון בלבד (ולא לפי סכומים) ---
    const DAYS_BACK = 7
    const sinceIso = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString()

    // בונים or לפי מה שיש לנו (email / phone)
    const ors: string[] = []
    if (email) ors.push(`email.eq.${encodeURIComponent(email)}`)
    if (phoneDigits) {
      // נוציא גם התאמה לגרסה עם מקף וגם בלי מקף
      ors.push(`phone.eq.${encodeURIComponent(phoneDigits)}`)
      if (phoneDashed) ors.push(`phone.eq.${encodeURIComponent(phoneDashed)}`)
    }
    const orFilter = ors.join(',')

    // שים לב: כשאין orFilter (לא אמור לקרות כי דרשנו email/phone), ניפול לפולבק רחב
    const baseQuery = supabaseAdmin
      .from('registrations')
      .select('id, status, paid, email, phone, created_at')
      .eq('paid', false)
      .eq('status', 'pending')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })

    const { data: candidatesRaw, error: candErr } =
      orFilter
        ? await baseQuery.or(orFilter)
        : await baseQuery

    if (candErr) {
      console.error('payment-webhook: load candidates error', candErr)
      return NextResponse.json({ ok: false, error: 'db error loading candidates' }, { status: 200 })
    }

    const candidates = (candidatesRaw ?? []) as any[]

    // סינון נוסף בצד השרת לכיסוי מקרים של שונות פורמט
    const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()
    const normalizeDigits = (s?: string | null) => (s ? onlyDigits(s) : '')
    const wantedEmail = norm(email)
    const wantedDigits = phoneDigits

    const filtered = candidates.filter((c) => {
      const cEmail = norm(c.email)
      const cDigits = normalizeDigits(c.phone)
      const emailOk = wantedEmail ? cEmail === wantedEmail : true
      const phoneOk = wantedDigits ? cDigits === wantedDigits : true
      // נדרש התאמה באימייל או בטלפון (אם קיימים אצלנו)
      if (wantedEmail && wantedDigits) return emailOk || phoneOk
      if (wantedEmail) return emailOk
      if (wantedDigits) return phoneOk
      return false
    })

    const chosen = filtered[0] // הכי חדש לפי order

    if (!chosen) {
      console.warn('payment-webhook: no registration matched by email/phone', {
        email: wantedEmail, phoneDigits: wantedDigits
      })
      return NextResponse.json({ ok: false, error: 'no matching registration' }, { status: 200 })
    }

    // --- עדכון הרשומה שנבחרה ---
    const update: Record<string, any> = { paid: true }
    if (external_payment_id) update.external_payment_id = String(external_payment_id)

    // מיפוי אמצעי תשלום של Grow לערכים המאושרים בטבלה
    function mapGrowPaymentMethod(v: string): 'cash' | 'card' | 'transfer' | 'other' | null {
      const s = (v || '').toString().trim().toLowerCase()
      if (s === '2' || s === 'card' || s === 'credit' || s === 'creditcard') return 'card'
      if (s === '1' || s === 'cash') return 'cash'
      if (s === '3' || s === 'bank' || s === 'transfer') return 'transfer'
      if (!s) return null
      return 'other'
    }
    const pmMapped = mapGrowPaymentMethod(String(data?.paymentType ?? data?.method ?? ''))
    if (pmMapped) update.payment_method = pmMapped

    const nextStatus = getStatusAfterPaid(true, chosen.status)
    if (nextStatus !== chosen.status) update.status = nextStatus

    const { error: updErr } = await supabaseAdmin
      .from('registrations')
      .update(update)
      .eq('id', chosen.id)

    if (updErr) {
      console.error('payment-webhook: update failed', { id: chosen.id, update, updErr })
      return NextResponse.json({ ok: false, error: 'update failed', registration_id: chosen.id }, { status: 200 })
    }

    console.info('payment-webhook: updated', {
      registration_id: chosen.id,
      email: wantedEmail,
      phone: wantedDigits,
      external_payment_id,
    })

    return NextResponse.json({ ok: true, registration_id: chosen.id }, { status: 200 })
  } catch (err: any) {
    console.error('payment-webhook: unexpected error', err)
    return NextResponse.json({ ok: false, error: 'server error', details: err?.message }, { status: 200 })
  }
}
