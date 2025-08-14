export default function ThankYouPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="max-w-md bg-white shadow-lg rounded-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-4">
          התשלום התקבל בהצלחה ✅
        </h1>
        <p className="text-gray-700 mb-6">
          תודה שנרשמת לסדנת עישון הבשרים!  
          שלחנו לך מייל עם כל הפרטים – נשמח לראות אותך.
        </p>
        <a
          href="/"
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition"
        >
          חזרה לדף הבית
        </a>
      </div>
    </main>
  );
}
