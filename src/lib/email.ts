import nodemailer, { type Transporter } from 'nodemailer';
import { env, requireEnv } from './env';

// Pengiriman email via SMTP (sementara Mailtrap). Ganti provider = ganti env,
// tak perlu sentuh pemanggil. Transport dibuat lazy + dipakai ulang.
let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (transporter) return transporter;
  const host = requireEnv('MAILTRAP_HOST');
  const port = parseInt(env('MAILTRAP_PORT') || '2525', 10);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = TLS langsung; port lain (2525/587) pakai STARTTLS
    auth: { user: requireEnv('MAILTRAP_USER'), pass: requireEnv('MAILTRAP_PASS') },
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Kirim satu email. Lempar bila gagal — pemanggil putuskan cara menanganinya.
export async function sendEmail({ to, subject, html, text }: MailInput): Promise<void> {
  const from = env('MAIL_FROM') || 'SMKS NU Darul Hikam <no-reply@smknudarulhikam.local>';
  await getTransport().sendMail({ from, to, subject, html, text });
}
