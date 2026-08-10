import { randomBytes, randomUUID } from 'node:crypto'
import { isAdminEmail } from '../common/admin.js'
import { ERROR_CODES, withCode } from '../common/error-codes.js'
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'

import { DatabaseService, nowISO } from '../database/database.service.js'
import { DecksService } from '../decks/decks.service.js'
import type { PublicUser } from '../types.js'
import { hashPassword, verifyPassword } from './password.js'
import type { LoginDto, RegisterDto } from './dto.js'

const SESSION_DAYS = 30

interface UserRow {
  id: string
  email: string
  password_hash: string
  display_name: string
  created_at: string
}

export interface Session {
  token: string
  expiresAt: Date
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly decks: DecksService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase()

    const exists = this.database.get<{ id: string }>('SELECT id FROM users WHERE email = ?', email)
    if (exists) throw new ConflictException(withCode('Користувач із такою поштою вже існує.', ERROR_CODES.emailTaken))

    const user: PublicUser = {
      id: randomUUID(),
      email,
      displayName: dto.displayName?.trim() || email.split('@')[0],
      createdAt: nowISO(),
      isAdmin: isAdminEmail(email),
    }

    this.database.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
      user.id,
      user.email,
      await hashPassword(dto.password),
      user.displayName,
      user.createdAt,
    )

    // Новий акаунт одразу отримує колоду за замовчуванням.
    this.decks.createDefault(user.id)

    return user
  }

  async login(dto: LoginDto): Promise<PublicUser> {
    const row = this.database.get<UserRow>(
      'SELECT * FROM users WHERE email = ?',
      dto.email.trim().toLowerCase(),
    )

    // Однакова відповідь для «немає користувача» і «невірний пароль».
    if (!row || !(await verifyPassword(dto.password, row.password_hash))) {
      throw new UnauthorizedException(withCode('Невірна пошта або пароль.', ERROR_CODES.badCredentials))
    }

    return this.toPublicUser(row)
  }

  createSession(userId: string): Session {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)

    this.database.run(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      token,
      userId,
      nowISO(),
      expiresAt.toISOString(),
    )

    return { token, expiresAt }
  }

  destroySession(token: string) {
    this.database.run('DELETE FROM sessions WHERE token = ?', token)
  }

  /** Повертає користувача за сесійним токеном; протухлі сесії підчищає. */
  userFromToken(token: string | undefined): PublicUser | null {
    if (!token) return null

    const row = this.database.get<UserRow & { expires_at: string }>(
      `SELECT u.*, s.expires_at FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`,
      token,
    )
    if (!row) return null

    if (new Date(row.expires_at).getTime() < Date.now()) {
      this.destroySession(token)
      return null
    }

    return this.toPublicUser(row)
  }

  private toPublicUser(row: UserRow): PublicUser {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      createdAt: row.created_at,
      isAdmin: isAdminEmail(row.email),
    }
  }
}
