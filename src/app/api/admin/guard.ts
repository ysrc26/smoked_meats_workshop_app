//src/app/api/admin/guard.ts
import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE = process.env.ADMIN_COOKIE_NAME || 'workshops_admin'
const SECRET = process.env.ADMIN_COOKIE_SECRET!

function verify(valueSig: string | undefined) {
  if (!valueSig) return false
  const [value, sig] = valueSig.split('.')
  const check = crypto.createHmac('sha256', SECRET).update(value).digest('hex')
  return sig === check && value === '1'
}

/**
 * בודק אם יש עוגיית אדמין חתומה ותקפה.
 * הערה: ב־Next גרסאות מסוימות cookies() טיפוסית אסינכרונית — לכן await.
 */
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE)?.value
  return verify(raw)
}
