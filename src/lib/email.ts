// src/lib/email.ts
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
}

const provider = process.env.EMAIL_PROVIDER || 'smtp'
const from = process.env.EMAIL_FROM || 'noreply@example.com'

let transporter: nodemailer.Transporter | null = null
let resend: Resend | null = null

if (provider === 'smtp') {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
} else if (provider === 'resend') {
  resend = new Resend(process.env.RESEND_API_KEY)
}

export async function sendEmail({ to, subject, html, text }: SendEmailArgs) {
  if (provider === 'smtp' && transporter) {
    const info = await transporter.sendMail({ from, to, subject, html, text })
    return { ok: true, id: info.messageId }
  }
  if (provider === 'resend' && resend) {
    const { data, error } = await resend.emails.send({ from, to, subject, html, text })
    if (error) {
      console.error('Resend email error:', error)
      throw new Error(error.message)
    }
    return { ok: true, id: data?.id }
  }
  throw new Error('Email provider not configured properly')
}