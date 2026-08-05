import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'

/**
 * Тонка обгортка над вбудованим `node:sqlite` — без нативних залежностей,
 * тож проєкт ставиться однією `npm install` на будь-якій платформі.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  readonly db: DatabaseSync

  constructor() {
    const path = process.env.DB_PATH ?? resolve(process.cwd(), 'data/phrase-deck.sqlite')
    mkdirSync(dirname(path), { recursive: true })

    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.migrate()

    this.logger.log(`SQLite готова: ${path}`)
  }

  onModuleDestroy() {
    this.db.close()
  }

  prepare(sql: string): StatementSync {
    return this.db.prepare(sql)
  }

  /** `.all()` повертає нетипізовані рядки — звужуємо в одному місці. */
  all<T>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...(params as never[])) as unknown as T[]
  }

  get<T>(sql: string, ...params: unknown[]): T | undefined {
    return this.db.prepare(sql).get(...(params as never[])) as unknown as T | undefined
  }

  run(sql: string, ...params: unknown[]) {
    return this.db.prepare(sql).run(...(params as never[]))
  }

  /** Виконує колбек у транзакції; будь-яка помилка відкочує все. */
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        created_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

      CREATE TABLE IF NOT EXISTS decks (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        source_lang TEXT NOT NULL,
        target_lang TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );
      CREATE INDEX IF NOT EXISTS decks_user ON decks(user_id, updated_at);

      CREATE TABLE IF NOT EXISTS cards (
        id          TEXT PRIMARY KEY,
        deck_id     TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        category    TEXT NOT NULL,
        front       TEXT NOT NULL,
        back        TEXT NOT NULL,
        tags        TEXT NOT NULL,
        difficulty  TEXT NOT NULL,
        note        TEXT,
        next_review TEXT,
        interval    REAL NOT NULL DEFAULT 0,
        repetition  INTEGER NOT NULL DEFAULT 0,
        efactor     REAL NOT NULL DEFAULT 2.5,
        lapses      INTEGER NOT NULL DEFAULT 0,
        suspended   INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );
      CREATE INDEX IF NOT EXISTS cards_deck ON cards(deck_id, updated_at);

      CREATE TABLE IF NOT EXISTS day_stats (
        deck_id    TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        date       TEXT NOT NULL,
        reviews    INTEGER NOT NULL DEFAULT 0,
        correct    INTEGER NOT NULL DEFAULT 0,
        seconds    REAL NOT NULL DEFAULT 0,
        new_cards  INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (deck_id, date)
      );
      CREATE INDEX IF NOT EXISTS day_stats_deck ON day_stats(deck_id, updated_at);
    `)
  }
}

export function nowISO() {
  return new Date().toISOString()
}
