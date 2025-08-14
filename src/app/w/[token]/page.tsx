'use client'

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabaseBrowser"
import { PublicWorkshopCard, Workshop } from "@/components/PublicWorkshopCard"
import RegistrationDialog from "@/components/RegistrationDialog"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function PrivateWorkshopPage() {
  const params = useParams() as { token: string }
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  // שליפה לפי טוקן (UUID ארוך)
  const fetchByToken = async () => {
    const { data, error } = await supabaseBrowser
      .rpc("get_workshop_by_token", { p_token: params.token })

    if (error) {
      setWorkshop(null)
      return
    }

    // RPC מחזיר מערך (אפס/אחד פריטים). נשלוף את הראשון אם קיים.
    const row = Array.isArray(data) ? data[0] : data
    if (row) {
      // ודא שהטיפוסים תואמים למה שהכרטיס מצפה לו
      setWorkshop({
        id: row.id,
        title: row.title,
        description: row.description,
        event_at: String(row.event_at),          // מחרוזת ISO
        capacity: Number(row.capacity ?? 0),
        price_cents: Number(row.price_cents ?? 0),
        payment_link: row.payment_link ?? null,
        seats_left: Number(row.seats_left ?? 0),
      } as any)
    } else {
      setWorkshop(null)
    }
  }


  useEffect(() => {
    (async () => {
      setLoading(true)
      await fetchByToken()
      setLoading(false)
    })()
  }, [params.token])

  if (loading) return <div className="text-sm text-muted-foreground">טוען…</div>

  if (!workshop) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        הסדנה לא נמצאה או אינה זמינה בקישור זה.
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold mb-1">רישום לסדנה פרטית</h1>
        <p className="text-sm text-muted-foreground">הגעת לכאן דרך קישור אישי</p>
      </div>

      <PublicWorkshopCard
        w={workshop}
        onRegister={() => setOpen(true)}
      />

      <RegistrationDialog
        open={open}
        onClose={() => setOpen(false)}
        workshop={{ id: workshop.id, title: workshop.title, seats_left: workshop.seats_left }}
        onSuccess={fetchByToken}
      />
    </div>
  )
}

// /* ========================== RegistrationDialog (Full) ========================== */

// function RegistrationDialog({
//   open, onClose, workshop, onSuccess
// }: {
//   open: boolean
//   onClose: () => void
//   workshop: Workshop
//   onSuccess?: () => Promise<void> | void
// }) {
//   const [fullName, setFullName] = useState("")
//   const [email, setEmail] = useState("")
//   const [phone, setPhone] = useState("")
//   const [seats, setSeats] = useState(1)
//   const [busy, setBusy] = useState(false)
//   const [result, setResult] = useState<{ message?: string; payment_link?: string } | null>(null)
//   const [err, setErr] = useState<string>("")

//   useEffect(() => {
//     if (open) {
//       // איפוס טופס בכל פתיחה
//       setFullName("")
//       setEmail("")
//       setPhone("")
//       setSeats(1)
//       setBusy(false)
//       setResult(null)
//       setErr("")
//     }
//   }, [open])

//   const submit = async () => {
//     setBusy(true)
//     setErr("")
//     setResult(null)
//     try {
//       const res = await fetch("/api/register", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           workshop_id: workshop.id,
//           full_name: fullName,
//           email,
//           phone,
//           seats
//         })
//       })
//       const data = await res.json()
//       if (!res.ok) throw new Error(data?.error || "שגיאה בשליחה")
//       setResult(data)
//       // עדכן הורה (לרענון מקומות פנויים בכרטיס)
//       await onSuccess?.()
//     } catch (e: any) {
//       setErr(e?.message || "שגיאה בלתי צפויה")
//     } finally {
//       setBusy(false)
//     }
//   }

//   const disabled = workshop.seats_left <= 0

//   return (
//     <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
//       <DialogContent className="sm:max-w-lg">
//         <DialogHeader>
//           <DialogTitle>הרשמה: {workshop.title}</DialogTitle>
//           <DialogDescription className="text-xs">
//             מלא את פרטיך. אם יש קישור תשלום, יוצג מיד לאחר השליחה.
//           </DialogDescription>
//         </DialogHeader>

//         {!result ? (
//           <div className="grid gap-4">
//             <div className="space-y-2">
//               <Label htmlFor="fullName" className="font-semibold">שם מלא</Label>
//               <Input
//                 id="fullName"
//                 value={fullName}
//                 onChange={(e) => setFullName(e.target.value)}
//                 placeholder="יוחנן כהן"
//                 disabled={disabled}
//               />
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               <div className="space-y-2">
//                 <Label htmlFor="email" className="font-semibold">אימייל</Label>
//                 <Input
//                   id="email"
//                   type="email"
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   placeholder="name@example.com"
//                   disabled={disabled}
//                 />
//               </div>
//               <div className="space-y-2">
//                 <Label htmlFor="phone" className="font-semibold">טלפון</Label>
//                 <Input
//                   id="phone"
//                   value={phone}
//                   onChange={(e) => setPhone(e.target.value)}
//                   placeholder="050-0000000"
//                   disabled={disabled}
//                 />
//               </div>
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="seats" className="font-semibold">כמות משתתפים</Label>
//               <Input
//                 id="seats"
//                 type="number"
//                 min={1}
//                 max={Math.max(1, workshop.seats_left)}
//                 value={seats}
//                 onChange={(e) => setSeats(Number(e.target.value || 1))}
//                 disabled={disabled}
//               />
//               <div className="text-xs text-muted-foreground">
//                 נותרו {workshop.seats_left} מקומות פנויים.
//               </div>
//             </div>

//             {err && (
//               <Alert variant="destructive">
//                 <AlertDescription>{err}</AlertDescription>
//               </Alert>
//             )}
//           </div>
//         ) : (
//           <div className="grid gap-3">
//             <Alert>
//               <AlertDescription>{result.message}</AlertDescription>
//             </Alert>
//             {result.payment_link && (
//               <div className="flex justify-end">
//                 <Button asChild>
//                   <a href={result.payment_link} target="_blank" rel="noreferrer">פתח קישור לתשלום</a>
//                 </Button>
//               </div>
//             )}
//           </div>
//         )}

//         <DialogFooter className="flex justify-between sm:justify-end gap-2">
//           <Button variant="secondary" onClick={onClose}>סגירה</Button>
//           {!result && (
//             <Button onClick={submit} disabled={busy || !fullName || seats < 1 || disabled}>
//               {busy ? "שולח…" : "שליחת הרשמה"}
//             </Button>
//           )}
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   )
// }
