/**
 * Коди помилок для клієнта. Текст `message` лишається українською — його
 * бачать і сторонні споживачі API, і smoke-тести; клієнт же перекладає за
 * кодом, а на текст відкочується, якщо коду не знає.
 */
export const ERROR_CODES = {
  authRequired: 'auth.required',
  emailTaken: 'auth.emailTaken',
  badCredentials: 'auth.badCredentials',
  deckNotFound: 'deck.notFound',
  deckLastOne: 'deck.lastOne',
  adminForbidden: 'admin.forbidden',
  adminUserNotFound: 'admin.userNotFound',
  adminNoTargetDeck: 'admin.noTargetDeck',
  adminNoCards: 'admin.noCards',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** Тіло HttpException: Nest віддає його полями відповіді як є. */
export function withCode(message: string, code: string) {
  return { message, code }
}
