#!/usr/bin/env bash
set -euo pipefail

# ===== Settings =====
# ברירת מחדל ללא src/. לשימוש ב-src: BASE=src bash init.sh
BASE="${BASE:-.}"
APP="$BASE/app"
COMP="$BASE/components"
LIB="$BASE/lib"

echo "Using base: $BASE"

# ===== Directories =====
mkdir -p "$APP" \
         "$APP/admin" \
         "$APP/api/admin/workshops/[id]" \
         "$APP/api/admin/registrations" \
         "$APP/api/payment-webhook" \
         "$APP/api/register" \
         "$APP/api/admin/login" \
         "$APP/robots.txt" \
         "$COMP" \
         "$LIB" \
         "public"

# ===== Files =====
# שורש
touch tsconfig.json next.config.js postcss.config.js tailwind.config.ts .env.local.example supabase.sql next-env.d.ts

# lib
touch "$LIB/supabaseAdmin.ts" \
      "$LIB/supabaseBrowser.ts" \
      "$LIB/ui.tsx"

# styles + layout + דפים
touch "$APP/globals.css" \
      "$APP/layout.tsx" \
      "$APP/page.tsx" \
      "$APP/admin/page.tsx"

# components (שימו לב: לא בתוך app/)
touch "$COMP/PublicWorkshopCard.tsx"

# API routes
touch "$APP/api/register/route.ts" \
      "$APP/api/admin/workshops/route.ts" \
      "$APP/api/admin/workshops/[id]/route.ts" \
      "$APP/api/admin/registrations/route.ts" \
      "$APP/api/admin/login/route.ts" \
      "$APP/api/admin/guard.ts" \
      "$APP/api/payment-webhook/route.ts"

# robots.txt
touch "$APP/robots.txt/route.ts"

# ===== npm init & installs =====
# אם package.json לא קיים או ריק → ניצור מחדש; אחרת נדלג על init
if [ ! -f package.json ] || [ ! -s package.json ]; then
  rm -f package.json
  npm init -y
else
  echo "package.json already exists and is non-empty → skipping npm init"
fi

# התקנות (מריץ כמה פעמים בלי נזק)
npm install next@latest react@latest react-dom@latest @supabase/supabase-js@latest cookies-next@latest date-fns@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest tailwindcss@latest postcss@latest autoprefixer@latest

# ===== Checklist =====
echo ""
echo "=================================================="
echo "📋 צ'ק-ליסט — סדר הכנסת הקוד לקבצים (base: $BASE):"
echo "=================================================="
echo "1.  package.json                      – קובץ הגדרות npm (נוצר ע\"י npm init)."
echo "2.  tsconfig.json                     – קונפיגורציית TypeScript."
echo "3.  next.config.js                    – קונפיגורציית Next.js."
echo "4.  postcss.config.js                 – PostCSS ל-Tailwind."
echo "5.  tailwind.config.ts                – קונפיגורציית Tailwind."
echo "6.  .env.local.example                – משתני סביבה לדוגמה."
echo "7.  supabase.sql                      – סכימה + RLS ל-Supabase."
echo "8.  $LIB/supabaseAdmin.ts             – לקוח Supabase עם Service Role (שרת)."
echo "9.  $LIB/supabaseBrowser.ts           – לקוח Supabase לדפדפן (anon)."
echo "10. $LIB/ui.tsx                       – קומפוננטות UI בסיסיות."
echo "11. $APP/globals.css                  – עיצוב גלובלי."
echo "12. $APP/layout.tsx                   – Layout ראשי."
echo "13. $APP/page.tsx                     – דף ציבורי (רשימת סדנאות)."
echo "14. $COMP/PublicWorkshopCard.tsx      – כרטיס סדנה לציבור."
echo "15. $APP/api/register/route.ts        – יצירת הרשמה."
echo "16. $APP/admin/page.tsx               – מסך ניהול מלא."
echo "17. $APP/api/admin/login/route.ts     – התחברות אדמין (Cookie)."
echo "18. $APP/api/admin/guard.ts           – בדיקת אדמין בצד שרת."
echo "19. $APP/api/admin/workshops/route.ts – יצירה/שליפה של סדנאות."
echo "20. $APP/api/admin/workshops/[id]/route.ts – עדכון/מחיקה."
echo "21. $APP/api/admin/registrations/route.ts  – שליפת רישומים."
echo "22. $APP/api/payment-webhook/route.ts – קבלת webhook תשלום."
echo "23. $APP/robots.txt/route.ts          – robots.txt."
echo ""
echo "💡 טיפ: אם תבחר לעבוד במבנה src/, תריץ עם BASE=src ותעדכן ב-tsconfig את ה-paths"
echo "    כך:  \"@/lib/*\": [\"src/lib/*\"], \"@/components/*\": [\"src/components/*\"]"
echo "=================================================="

