import React from 'react'

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">{children}</div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`w-full rounded-xl border border-line px-3 py-2 outline-none focus:ring-1 focus:ring-black ${props.className ?? ''}`} />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`w-full rounded-xl border border-line px-3 py-2 outline-none focus:ring-1 focus:ring-black ${props.className ?? ''}`} />
  )
}

export function Button({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const variant = (rest as any).variant || 'primary'
  const base = 'rounded-xl px-4 py-2 border text-sm'
  const styles = variant === 'ghost'
    ? 'border-transparent hover:border-line'
    : 'bg-black text-white border-black hover:opacity-90'
  return (
    <button {...rest} className={`${base} ${styles} ${rest.className ?? ''}`}>{children}</button>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm mb-1 text-black/80">{children}</label>
}