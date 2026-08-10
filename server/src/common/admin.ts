/**
 * Адміністратор визначається поштою, а не колонкою в БД: акаунт-власник один,
 * і роль у таблиці лише розсинхронізувалася б із деплоєм. Перелік
 * перевизначається змінною `ADMIN_EMAILS` (через кому).
 */
const DEFAULT_ADMINS = ['geryh213921@gmail.com']

function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS
  if (!raw) return DEFAULT_ADMINS
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase())
}
