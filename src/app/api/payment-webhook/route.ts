// src/app/api/payment-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStatusAfterPaid } from '@/lib/status'

/**
 * Webhook מ-Grow (ללא סיקרטים/חתימות)
 * - payload יכול להגיע כמערך עם אובייקט יחיד או כאובייקט.
 * - מזהה רישום לפי אימייל/טלפון בלבד (חובה אצלך), 7 ימים אחורה, pending && !paid.
 * - תשלום חלקי: מצטבר ל-amount_paid (בש"ח). paid=true רק כשהסכום הכולל שולם.
 * - אידמפוטנטיות לפי external_payment_id (transactionId).
 */
export async function POST(req: NextRequest) {
  // --- Parse body (array or object) ---
  let raw: any
  try {
    raw = await req.json()
  } catch (err) {
    console.error('payment-webhook: invalid json', err)
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 200 })
  }
  const root = Array.isArray(raw) ? raw[0] : raw
  const data = root?.data ?? root ?? {}

  // --- Extract from Grow ---
  const external_payment_id =
    data?.transactionId ?? data?.paymentId ?? data?.id ?? null

  const email = (data?.payerEmail ?? data?.email ?? '').trim().toLowerCase()
  const phoneRaw = (data?.payerPhone ?? data?.phone ?? '').trim()
  const onlyDigits = (s: string) => s.replace(/\D+/g, '')
  const phoneDigits = onlyDigits(phoneRaw)
  const phoneDashed =
    phoneDigits.length === 10 ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3)}` : ''

  // דרוש שהעסקה שולם בפועל
  const statusTxt: string = String(data?.status ?? '')
  const statusCode: string = String(data?.statusCode ?? '')
  const isPaid = statusCode === '2' || statusTxt === 'שולם'
  if (!isPaid) {
    console.warn('payment-webhook: payment is not marked as paid', { statusTxt, statusCode })
    return NextResponse.json({ ok: false, error: 'not paid' }, { status: 200 })
  }

  // סכום בש"ח
  const paymentSumStr: string = String(data?.sum ?? '').replace(',', '.').trim()
  const amount_nis = Number(paymentSumStr)
  if (!Number.isFinite(amount_nis) || amount_nis <= 0) {
    console.warn('payment-webhook: invalid amount', { sum: data?.sum })
    return NextResponse.json({ ok: false, error: 'invalid amount' }, { status: 200 })
  }

  if (!email && !phoneDigits) {
    console.error('payment-webhook: missing email/phone in payload')
    return NextResponse.json({ ok: false, error: 'missing email/phone' }, { status: 200 })
  }

  try {
    // --- Idempotency by external_payment_id ---
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

    // --- find candidates by email/phone (pending && !paid, last 7 days) ---
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
      .select('id, status, paid, email, phone, seats, amount_paid, workshop_id, created_at')
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

    // סינון נוסף בצד השרת (normalize)
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

    // --- get workshop price (₪) and current registration state ---
    const { data: workshop, error: wErr } = await supabaseAdmin
      .from('workshops')
      .select('price, title')
      .eq('id', chosen.workshop_id)
      .single()
    if (wErr || !workshop || typeof workshop.price !== 'number') {
      console.error('payment-webhook: workshop price not found', { workshop_id: chosen.workshop_id, wErr })
      return NextResponse.json({ ok: false, error: 'workshop price not found' }, { status: 200 })
    }

    const total_nis = Number(workshop.price) * Number(chosen.seats)
    const current_paid = Number(chosen.amount_paid ?? 0)
    const new_amount_paid = Math.min(total_nis, current_paid + amount_nis)
    const fully_paid = new_amount_paid >= total_nis

    // --- build update ---
    const update: Record<string, any> = {
      amount_paid: new_amount_paid,
      paid: fully_paid,
    }
    if (external_payment_id) update.external_payment_id = String(external_payment_id)

    // payment method mapping
    function mapGrowPaymentMethod(v: string): 'cash'|'card'|'transfer'|'other'|null {
      const s = (v || '').toString().trim().toLowerCase()
      if (s === '2' || s === 'card' || s === 'credit' || s === 'creditcard') return 'card'
      if (s === '1' || s === 'cash') return 'cash'
      if (s === '3' || s === 'bank' || s === 'transfer') return 'transfer'
      if (!s) return null
      return 'other'
    }
    const pmMapped = mapGrowPaymentMethod(String(data?.paymentType ?? data?.method ?? ''))
    if (pmMapped) update.payment_method = pmMapped

    const nextStatus = getStatusAfterPaid(fully_paid, chosen.status)
    if (nextStatus !== chosen.status) update.status = nextStatus

    const { error: updErr } = await supabaseAdmin
      .from('registrations')
      .update(update)
      .eq('id', chosen.id)

    if (updErr) {
      console.error('payment-webhook: update failed', { id: chosen.id, update, updErr })
      return NextResponse.json({ ok: false, error: 'update failed', registration_id: chosen.id }, { status: 200 })
    }

    console.info('payment-webhook: updated (partial/complete)', {
      registration_id: chosen.id,
      amount_nis,
      amount_paid_before: current_paid,
      amount_paid_after: new_amount_paid,
      total_nis,
      fully_paid
    })

    return NextResponse.json({
      ok: true,
      registration_id: chosen.id,
      fully_paid,
      amount_paid: new_amount_paid,
      total: total_nis
    }, { status: 200 })
  } catch (err: any) {
    console.error('payment-webhook: unexpected error', err)
    return NextResponse.json({ ok: false, error: 'server error', details: err?.message }, { status: 200 })
  }
}
