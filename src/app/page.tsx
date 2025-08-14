'use client'

import { useEffect, useState } from "react"
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

export default function Page() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Workshop | null>(null)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabaseBrowser
        .from("workshops_with_stats")
        .select("*")
        .eq("is_public", true)
        .gte("event_at", new Date().toISOString())
        .eq("is_active", true)
        .order("event_at", { ascending: true })


      if (!error && data) setWorkshops(data as any)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_REALTIME !== "true") return

    const ids = workshops.map(w => `'${w.id}'`).join(",")
    if (!ids) return

    const channel = supabaseBrowser
      .channel("registrations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
          filter: `workshop_id=in.(${ids})`
        },
        payload => {
          console.log("📢 שינוי ברישומים:", payload)

          // רענון נתונים
          supabaseBrowser
            .from("workshops_with_stats")
            .select("*")
            .gte("event_at", new Date().toISOString())
            .order("event_at", { ascending: true })
            .then(({ data }) => data && setWorkshops(data as any))
        }
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [workshops])


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold mb-1">סדנאות זמינות</h1>
        <p className="text-sm text-muted-foreground">בחר סדנה פנויה, מלא פרטים והירשם</p>
      </div>

      {loading && <div className="text-sm text-muted-foreground">טוען…</div>}

      {!loading && workshops.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          אין סדנאות זמינות כרגע.
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {workshops.map((w) => (
          <PublicWorkshopCard key={w.id} w={w} onRegister={setSelected} />
        ))}
      </div>

      <RegistrationDialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        workshop={selected as any}
        onSuccess={async () => {
          // רענון אחרי הרשמה
          const { data } = await supabaseBrowser
            .from("workshops_with_stats")
            .select("*")
            .eq("is_public", true)
            .gte("event_at", new Date().toISOString())
            .eq("is_active", true)
            .order("event_at", { ascending: true })
          if (data) setWorkshops(data as any)
        }}
      />

    </div>
  )
}

// function RegistrationDialog({
//   workshop, onClose
// }: { workshop: Workshop | null, onClose: () => void }) {
//   const [fullName, setFullName] = useState("")
//   const [email, setEmail] = useState("")
//   const [phone, setPhone] = useState("")
//   const [seats, setSeats] = useState(1)
//   const [busy, setBusy] = useState(false)
//   const [result, setResult] = useState<{ message?: string; payment_link?: string } | null>(null)
//   const [err, setErr] = useState<string>("")

//   const open = Boolean(workshop)

//   const submit = async () => {
//     if (!workshop) return
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
//     } catch (e: any) {
//       setErr(e?.message || "שגיאה בלתי צפויה")
//     } finally {
//       setBusy(false)
//     }
//   }

//   return (
//     <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
//       <DialogContent className="sm:max-w-lg">
//         <DialogHeader>
//           <DialogTitle>הרשמה: {workshop?.title}</DialogTitle>
//           <DialogDescription className="text-xs">
//             מלא את פרטיך, ונחזיר לך קישור לתשלום אם הוגדר לסדנה.
//           </DialogDescription>
//         </DialogHeader>

//         {!result ? (
//           <div className="grid gap-4">
//             <div className="space-y-2">
//               <Label htmlFor="fullName" className="font-semibold">שם מלא</Label>
//               <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="יוחנן כהן" />
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               <div className="space-y-2">
//                 <Label htmlFor="email" className="font-semibold">אימייל</Label>
//                 <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
//               </div>
//               <div className="space-y-2">
//                 <Label htmlFor="phone" className="font-semibold">טלפון</Label>
//                 <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" />
//               </div>
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="seats" className="font-semibold">כמות משתתפים</Label>
//               <Input id="seats" type="number" min={1} max={workshop?.seats_left ?? 1} value={seats} onChange={(e) => setSeats(Number(e.target.value || 1))} />
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
//             <Button onClick={submit} disabled={busy || !fullName || seats < 1}>
//               {busy ? "שולח…" : "שליחת הרשמה"}
//             </Button>
//           )}
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   )
// }
