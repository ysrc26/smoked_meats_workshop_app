// src/app/api/payment-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function mapPaymentMethod(v: string): 'cash'|'card'|'transfer'|'other'|null {
  const s = (v || '').toString().trim().toLowerCase()
  if (!s) return null
  if (s === '2' || s === 'card' || s === 'credit' || s === 'creditcard') return 'card'
  if (s === '1' || s === 'cash') return 'cash'
  if (s === '3' || s === 'bank' || s === 'transfer' || s === 'bit') return 'transfer'
  return 'other'
}

export async function POST(req: NextRequest) {
  // --- לוג וובהוק: קוראים טקסט כדי לשמור as-is ואז מנסים JSON.parse ---
  let rawText = ''
  let raw: any
  try {
    rawText = await req.text()
    raw = JSON.parse(rawText)
  } catch {
    // גם במצב של JSON לא תקין—נכניס ללוג ונחזיר תשובה זהה לקוד המקורי
    try {
      await supabaseAdmin.from('webhook_events').insert({
        payload: { raw: rawText || '(empty)' },
        headers: Object.fromEntries(req.headers.entries()),
        source: 'grow',
        matched: false
      })
    } catch {}
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 200 })
  }

  // מכניסים ללוג הראשוני (matched=false); נשמור את id לעדכון בהמשך
  let logId: string | null = null
  try {
    const { data: logRow } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        payload: raw, // as-is
        headers: Object.fromEntries(req.headers.entries()),
        source: 'grow',
        matched: false
      })
      .select('id')
      .single()
    logId = logRow?.id ?? null
  } catch {}

  try {
    const root = Array.isArray(raw) ? raw[0] : raw
    const data = root?.data ?? root ?? {}

    // אימות סטטוס תשלום לפי Grow (לוגיקה קיימת)
    const statusTxt: string = String(data?.status ?? '')
    const statusCode: string = String(data?.statusCode ?? '')
    const isPaid = statusCode === '2' || statusTxt === 'שולם'
    if (!isPaid) {
      // אין התאמה => נשאיר matched=false
      return NextResponse.json({ ok: false, error: 'not paid' }, { status: 200 })
    }

    // סכום בש"ח (לוגיקה קיימת)
    const paymentSumStr: string = String(data?.sum ?? '').replace(',', '.').trim()
    const amount_nis = Number(paymentSumStr)
    if (!Number.isFinite(amount_nis) || amount_nis <= 0) {
      return NextResponse.json({ ok: false, error: 'invalid amount' }, { status: 200 })
    }

    const email = (data?.payerEmail ?? data?.email ?? '').trim().toLowerCase()
    const phoneRaw = (data?.payerPhone ?? data?.phone ?? '').trim()
    const onlyDigits = (s: string) => s.replace(/\D+/g, '')
    const phoneDigits = onlyDigits(phoneRaw)
    const phoneDashed =
      phoneDigits.length === 10 ? `${phoneDigits.slice(0,3)}-${phoneDigits.slice(3)}` : ''

    if (!email && !phoneDigits) {
      return NextResponse.json({ ok: false, error: 'missing email/phone' }, { status: 200 })
    }

    // חיפוש הרשמה מתאימה (pending && !paid, 7 ימים) — לוגיקה קיימת
    const sinceIso = new Date(Date.now() - 7*24*60*60*1000).toISOString()
    const ors: string[] = []
    if (email) ors.push(`email.eq.${encodeURIComponent(email)}`)
    if (phoneDigits) {
      ors.push(`phone.eq.${encodeURIComponent(phoneDigits)}`)
      if (phoneDashed) ors.push(`phone.eq.${encodeURIComponent(phoneDashed)}`)
    }
    const baseQ = supabaseAdmin
      .from('registrations')
      .select('id, status, paid, email, phone, seats, amount_paid, workshop_id, created_at')
      .eq('status', 'pending')
      .eq('paid', false)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })

    const { data: candidatesRaw, error: candErr } =
      ors.length ? await baseQ.or(ors.join(',')) : await baseQ
    if (candErr) return NextResponse.json({ ok: false, error: 'db error' }, { status: 200 })

    const norm = (s?: string|null)=> (s??'').trim().toLowerCase()
    const normalizeDigits = (s?: string|null)=> s? s.replace(/\D+/g,''): ''
    const wantedEmail = norm(email)
    const wantedDigits = phoneDigits

    const candidates = (candidatesRaw ?? []) as any[]
    const chosen = candidates.find(c => {
      const cEmail = norm(c.email)
      const cDigits = normalizeDigits(c.phone)
      const emailOk = wantedEmail ? cEmail === wantedEmail : true
      const phoneOk = wantedDigits ? cDigits === wantedDigits : true
      return (wantedEmail && wantedDigits) ? (emailOk || phoneOk) : (wantedEmail ? emailOk : phoneOk)
    }) ?? candidates[0]

    if (!chosen) {
      return NextResponse.json({ ok: false, error: 'no matching registration' }, { status: 200 })
    }

    const external_payment_id =
      data?.transactionId ?? data?.paymentId ?? data?.id ?? null
    const method = mapPaymentMethod(String(data?.paymentType ?? data?.method ?? ''))

    // Insert payment (idempotent by external_payment_id) — לוגיקה קיימת
    const insertObj: any = {
      registration_id: chosen.id,
      amount: Math.floor(amount_nis),
      source: 'webhook',
      ...(method && { method }),
      ...(external_payment_id && { external_payment_id: String(external_payment_id) }),
      note: null,
      created_by: null,
    }

    const { error: insErr } = await supabaseAdmin
      .from('payments')
      .insert(insertObj)
      .select('id')
      .maybeSingle()

    if (insErr && !String(insErr.message).includes('duplicate key')) {
      // שגיאה אמיתית (לא כפילות)
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 200 })
    }

    // אם הצליח — נסמן את רשומת הלוג כ-matched=true ונשמור registration_id
    if (logId) {
      try {
        await supabaseAdmin
          .from('webhook_events')
          .update({ matched: true, registration_id: chosen.id })
          .eq('id', logId)
      } catch {}
    }

    // הטריגר על payments יעדכן את הרשמה אוטומטית
    return NextResponse.json({ ok: true, registration_id: chosen.id }, { status: 200 })
  } catch (err: any) {
    console.error('payment-webhook error', err)
    // גם בשגיאה כללית—נסמן matched=false (אם יש לוג)
    if (logId) {
      try {
        await supabaseAdmin.from('webhook_events').update({ matched: false }).eq('id', logId)
      } catch {}
    }
    return NextResponse.json({ ok: false, error: 'server error', details: err?.message }, { status: 200 })
  }
}
