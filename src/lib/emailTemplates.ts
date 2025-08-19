// src/lib/emailTemplates.ts
type W = { title: string; event_at: string | Date; price?: number; payment_link?: string | null }
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' })

export function registrationReceived(name: string, w: W, seats: number) {
  const when = fmtDate(w.event_at)
  const payLine = w.payment_link
    ? `<p>קישור לתשלום: <a href="${w.payment_link}" target="_blank" rel="noreferrer">${w.payment_link}</a></p>`
    : `<p>ניצור עמך קשר להשלמת התשלום.</p>`

  const total = w.price && Number.isFinite(w.price) ? ` (סה״כ ~ ${w.price * seats} ₪)` : ''

  const html = `
  <div dir="rtl" style="font-family:Arial,sans-serif">
    <h2>היי ${name},</h2>
    <p>הרשמתך נקלטה לסדנה: <b>${w.title}</b></p>
    <p>מועד: ${when}</p>
    <p>מספר מקומות: ${seats}${total}</p>
    ${payLine}
    <hr/>
    <p>נתראה בסדנה!</p>
  </div>`

  const text = `היי ${name},
הרשמתך נקלטה לסדנה: ${w.title}
מועד: ${when}
מספר מקומות: ${seats}${total ? `\n${total}` : ''}

${w.payment_link ? `לתשלום: ${w.payment_link}` : 'ניצור קשר להשלמת התשלום.'}
`

  return { subject: `אישור הרשמה – ${w.title}`, html, text }
}

export function paymentConfirmed(name: string, w: W, amount?: number) {
  const when = fmtDate(w.event_at)
  const amountLine = Number.isFinite(amount || NaN) ? `סכום ששולם: ${amount} ₪` : undefined

  const html = `
  <div dir="rtl" style="font-family:Arial,sans-serif">
    <h2>תשלום התקבל</h2>
    <p>${name}, תודה! התשלום עבור הסדנה <b>${w.title}</b> התקבל בהצלחה.</p>
    <p>מועד הסדנה: ${when}</p>
    ${amountLine ? `<p>${amountLine}</p>` : ''}
    <hr/>
    <p>מחכים לראותך!</p>
  </div>`
  const text = `תשלום התקבל
${name}, תודה! התשלום עבור "${w.title}" התקבל בהצלחה.
מועד הסדנה: ${when}
${amountLine ? amountLine : ''}`

  return { subject: `תשלום התקבל – ${w.title}`, html, text }
}