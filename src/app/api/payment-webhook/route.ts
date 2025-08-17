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

/** מפענח גוף שמגיע כמחרוזת urlencoded ומחזיר אובייקט data עם המפתחות מתוך data[...] */
function parseUrlEncodedToData(text: string) {
  const params = new URLSearchParams(text)
  const parsed: Record<string, any> = {}
  for (const [k, v] of params.entries()) parsed[k] = v

  // לבנות data מתוך מפתחות מסוג data[...]
  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(parsed)) {
    const m = k.match(/^data\[(.+?)\]$/)
    if (m) data[m[1]] = v
  }
  // לעתים יש גם status/top-level מחוץ ל-data
  if (parsed['status'] && !data['status']) data['status'] = parsed['status']
  if (parsed['statusCode'] && !data['statusCode']) data['statusCode'] = parsed['statusCode']
  return { data, parsed }
}

export async function POST(req: NextRequest) {
  // ננסה לתמוך בכל סוגי ה-body: JSON, JSON עם raw, או form-urlencoded
  let rawForLog: any = null
  let data: any = {}

  try {
    const contentType = req.headers.get('content-type') || ''
    let bodyText = ''

    if (contentType.includes('application/json')) {
      // JSON רגיל או JSON עם raw
      const json = await req.json().catch(() => null)
      if (!json) {
        return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 200 })
      }
      rawForLog = json

      if (typeof json?.raw === 'string') {
        // המקרה שלך: { raw: "err=&status=1&data%5B...%5D=..." }
        bodyText = json.raw
        const { data: dataObj } = parseUrlEncodedToData(bodyText)
        data = dataObj
      } else {
        data = json?.data ?? json ?? {}
      }
    } else {
      // לא JSON — נקרא טקסט (urlencoded לרוב)
      bodyText = await req.text()
      rawForLog = bodyText || '(empty)'

      if (bodyText && bodyText.includes('=')) {
        const { data: dataObj, parsed } = parseUrlEncodedToData(bodyText)
        data = dataObj
        // אם הגיעו שדות שימושיים לא בתוך data[...] – נוסיף (ליתר בטחון)
        if (!data.status && parsed['status']) data.status = parsed['status']
        if (!data.statusCode && parsed['statusCode']) data.statusCode = parsed['statusCode']
        if (!data.payerEmail && parsed['payerEmail']) data.payerEmail = parsed['payerEmail']
        if (!data.payerPhone && parsed['payerPhone']) data.payerPhone = parsed['payerPhone']
      } else {
        return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 200 })
      }
    }

    // 1) לוג תמידי ל-webhook_events (as-is)
    let logId: string | null = null
    try {
      const { data: logRow } = await supabaseAdmin
        .from('webhook_events') // חשוב: אותו שם טבלה כפי שיצרת
        .insert({
          payload: typeof rawForLog === 'string' ? { raw: rawForLog } : rawForLog,
          headers: Object.fromEntries(req.headers.entries()),
          source: 'grow',
          matched: false,
        })
        .select('id')
        .single()
      logId = logRow?.id ?? null
    } catch (e) {
      // לא מפילים את הוובהוק אם הלוג נכשל
      console.error('failed to insert webhook_events log', e)
    }

    // 2) אימות תשלום
    const statusTxt: string = String(data?.status ?? '')
    const statusCode: string = String(data?.statusCode ?? '')
    const isPaid = statusCode === '2' || statusTxt === 'שולם'
    if (!isPaid) {
      return NextResponse.json({ ok: false, error: 'not paid' }, { status: 200 })
    }

    // סכום בש"ח
    const paymentSumStr: string = String(data?.sum ?? '').replace(',', '.').trim()
    const amount_nis = Number(paymentSumStr)
    if (!Number.isFinite(amount_nis) || amount_nis <= 0) {
      return NextResponse.json({ ok: false, error: 'invalid amount' }, { status: 200 })
    }

    // זיהוי לפי אימייל/טלפון (לעיתים אימייל ריק — אז נשתמש בטלפון)
    const email = (data?.payerEmail ?? data?.email ?? '').toString().trim().toLowerCase()
    const phoneRaw = (data?.payerPhone ?? data?.phone ?? '').toString().trim()
    const onlyDigits = (s: string) => s.replace(/\D+/g, '')
    const phoneDigits = onlyDigits(phoneRaw)
    const phoneDashed =
      phoneDigits.length === 10 ? `${phoneDigits.slice(0,3)}-${phoneDigits.slice(3)}` : ''

    if (!email && !phoneDigits) {
      return NextResponse.json({ ok: false, error: 'missing email/phone' }, { status: 200 })
    }

    // 3) חיפוש הרשמה מתאימה (pending && !paid, 7 ימים אחרונים)
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
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
    if (candErr) {
      return NextResponse.json({ ok: false, error: 'db error' }, { status: 200 })
    }

    const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()
    const normalizeDigits = (s?: string | null) => (s ? s.replace(/\D+/g, '') : '')
    const wantedEmail = norm(email)
    const wantedDigits = phoneDigits

    const candidates = (candidatesRaw ?? []) as any[]
    const chosen =
      candidates.find((c) => {
        const cEmail = norm(c.email)
        const cDigits = normalizeDigits(c.phone)
        const emailOk = wantedEmail ? cEmail === wantedEmail : true
        const phoneOk = wantedDigits ? cDigits === wantedDigits : true
        return wantedEmail && wantedDigits ? emailOk || phoneOk : wantedEmail ? emailOk : phoneOk
      }) ?? candidates[0]

    if (!chosen) {
      // עדכן לוג כלא-מותאם
      if (logId) {
        try {
          await supabaseAdmin
            .from('webhook_events')
            .update({ matched: false })
            .eq('id', logId)
        } catch {}
      }
      return NextResponse.json({ ok: false, error: 'no matching registration' }, { status: 200 })
    }

    // 4) הכנסת תשלום (idempotent לפי external_payment_id אם קיים)
    const external_payment_id =
      data?.transactionId ?? data?.paymentId ?? data?.id ?? null
    const method = mapPaymentMethod(String(data?.paymentType ?? data?.method ?? ''))

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
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 200 })
    }

    // 5) עדכון הלוג – נמצאה התאמה
    if (logId) {
      try {
        await supabaseAdmin
          .from('webhook_events')
          .update({ matched: true, registration_id: chosen.id })
          .eq('id', logId)
      } catch {}
    }

    // טריגר על payments יעדכן את registrations אוטומטית (amount_paid/paid/status)
    return NextResponse.json({ ok: true, registration_id: chosen.id }, { status: 200 })
  } catch (err: any) {
    console.error('payment-webhook error', err)
    return NextResponse.json({ ok: false, error: 'server error', details: err?.message }, { status: 200 })
  }
}
