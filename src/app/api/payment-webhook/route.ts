// src/app/api/payment-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStatusAfterPaid } from '@/lib/status'

export async function POST(req: NextRequest) {
  // --- Parse JSON (array or object) ---
  let raw: any
  try {
    raw = await req.json()
  } catch (err) {
    console.error('payment-webhook: invalid json', err)
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 200 })
  }
  const root = Array.isArray(raw) ? raw[0] : raw
  const data = root?.data ?? root ?? {}

  // --- Extract fields from Grow ---
  const external_payment_id =
    data?.transactionId ?? data?.paymentId ?? data?.id ?? null

  const email = (data?.payerEmail ?? data?.email ?? '').trim().toLowerCase()
  const phoneRaw = (data?.payerPhone ?? data?.phone ?? '').trim()
  const onlyDigits = (s: string) => s.replace(/\D+/g, '')
  const phoneDigits = onlyDigits(phoneRaw)
  const phoneDashed =
    phoneDigits.length === 10 ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3)}` : ''

  // דרישת תשלום שולם באמת (לפי הדוקו: statusCode "2" או status "שולם")
  const statusTxt: string = String(data?.status ?? '')
  const statusCode: string = String(data?.statusCode ?? '')
  const isPaid = statusCode === '2' || statusTxt === 'שולם'
  if (!isPaid) {
    console.warn('payment-webhook: payment is not marked as paid', { statusTxt, statusCode })
    return NextResponse.json({ ok: false, error: 'not paid' }, { status: 200 })
  }

  // סכום בש"ח (מחרוזת), נהפוך ל-agorot
  const paymentSumStr: string = String(data?.sum ?? '').replace(',', '.').trim()
  const amount_nis = Number(paymentSumStr)


  if (!email && !phoneDigits) {
    console.error('payment-webhook: missing email/phone in payload')
    return NextResponse.json({ ok: false, error: 'missing email/phone' }, { status: 200 })
  }
  if (!Number.isFinite(amount_nis)) {
    console.error('payment-webhook: missing/invalid sum', { sum: data?.sum })
    return NextResponse.json({ ok: false, error: 'missing or invalid sum' }, { status: 200 })
  }

  try {
    // Idempotency: אם כבר קיים external_payment_id זהה ושולם — החזר idempotent
    if (external_payment_id) {
      const { data: existing, error: findByExtErr } = await supabaseAdmin
        .from('registrations')
        .select('id, paid, status')
        .eq('external_payment_id', String(external_payment_id))
        .maybeSingle()

      if (!findByExtErr && existing && existing.paid) {
        console.info('payment-webhook: idempotent (already paid)', { id: existing.id })
        return NextResponse.json(
          { ok: true, idempotent: true, registration_id: existing.id },
          { status: 200 }
        )
      }
    }

    // --- משיכת מועמדים לפי אימייל/טלפון בלבד (pending && !paid, 7 ימים אחרונים) ---
    const DAYS_BACK = 7
    const sinceIso = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString()

    const ors: string[] = []
    if (email) ors.push(`email.eq.${encodeURIComponent(email)}`)
    if (phoneDigits) {
      ors.push(`phone.eq.${encodeURIComponent(phoneDigits)}`)
      if (phoneDashed) ors.push(`phone.eq.${encodeURIComponent(phoneDashed)}`)
    }
    const orFilter = ors.join(',')

    const baseQuery = supabaseAdmin
      .from('registrations')
      .select('id, status, paid, email, phone, seats, created_at, workshop_id')
      .eq('paid', false)
      .eq('status', 'pending')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })

    const { data: candidatesRaw, error: candErr } =
      orFilter ? await baseQuery.or(orFilter) : await baseQuery

    if (candErr) {
      console.error('payment-webhook: load candidates error', candErr)
      return NextResponse.json({ ok: false, error: 'db error loading candidates' }, { status: 200 })
    }

    const candidates = (candidatesRaw ?? []) as any[]

    // התאמה בצד השרת כדי לכסות שונות בפורמט
    const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()
    const normalizeDigits = (s?: string | null) => (s ? onlyDigits(s) : '')
    const wantedEmail = norm(email)
    const wantedDigits = phoneDigits

    const filtered = candidates.filter((c) => {
      const cEmail = norm(c.email)
      const cDigits = normalizeDigits(c.phone)
      const emailOk = wantedEmail ? cEmail === wantedEmail : true
      const phoneOk = wantedDigits ? cDigits === wantedDigits : true
      return (wantedEmail && wantedDigits) ? (emailOk || phoneOk) : (wantedEmail ? emailOk : phoneOk)
    })

    const chosen = filtered[0] // הכי חדש
    if (!chosen) {
      console.warn('payment-webhook: no registration matched by email/phone', {
        email: wantedEmail, phoneDigits: wantedDigits
      })
      return NextResponse.json({ ok: false, error: 'no matching registration' }, { status: 200 })
    }

    // --- אימות סכום מול מחיר הסדנה × כמות ---
    // נשלוף את price_cents של הסדנה
    const { data: workshop, error: wErr } = await supabaseAdmin
  .from('workshops')
  .select('price_nis, title')
  .eq('id', chosen.workshop_id)
  .single()

    if (wErr || !workshop || typeof workshop.price_nis !== 'number') {
      console.error('payment-webhook: workshop price not found', { workshop_id: chosen.workshop_id, wErr })
      return NextResponse.json({ ok: false, error: 'workshop price not found' }, { status: 200 })
    }

    const expected_nis = Number(workshop.price_nis) * Number(chosen.seats)
if (amount_nis !== expected_nis) {
  console.warn('payment-webhook: amount mismatch', {
    expected_nis, amount_nis, price_nis: workshop.price_nis, seats: chosen.seats
  })
  return NextResponse.json({
    ok: false,
    error: 'amount mismatch',
    expected: expected_nis,
    got: amount_nis
  }, { status: 200 })
}

    // --- עדכון הרשומה שנבחרה (אחרי אימות הסכום) ---
    const update: Record<string, any> = { paid: true }
    if (external_payment_id) update.external_payment_id = String(external_payment_id)

    // מיפוי אמצעי תשלום מה-grow לערכים המותרים ב-DB
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
      amount_nis,
      expected_nis
    })

    return NextResponse.json({ ok: true, registration_id: chosen.id }, { status: 200 })
  } catch (err: any) {
    console.error('payment-webhook: unexpected error', err)
    return NextResponse.json({ ok: false, error: 'server error', details: err?.message }, { status: 200 })
  }
}
