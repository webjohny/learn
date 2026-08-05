import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { DatabaseService, nowISO } from '../database/database.service.js'
import type { DeckMeta } from '../types.js'
import type { CreateDeckDto, UpdateDeckDto } from './dto.js'

const DEFAULT_DECK: CreateDeckDto = {
  name: 'Розмовна англійська',
  sourceLang: 'uk',
  targetLang: 'en-US',
}

interface DeckRow {
  id: string
  user_id: string
  name: string
  source_lang: string
  target_lang: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

@Injectable()
export class DecksService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: string): DeckMeta[] {
    return this.database
      .all<DeckRow>(
        'SELECT * FROM decks WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at',
        userId,
      )
      .map(toDeck)
  }

  create(userId: string, dto: CreateDeckDto): DeckMeta {
    const deck: DeckMeta = {
      id: randomUUID(),
      userId,
      name: dto.name.trim(),
      sourceLang: dto.sourceLang,
      targetLang: dto.targetLang,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      deletedAt: null,
    }

    this.database.run(
      `INSERT INTO decks (id, user_id, name, source_lang, target_lang, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      deck.id,
      deck.userId,
      deck.name,
      deck.sourceLang,
      deck.targetLang,
      deck.createdAt,
      deck.updatedAt,
    )

    return deck
  }

  createDefault(userId: string): DeckMeta {
    return this.create(userId, DEFAULT_DECK)
  }

  update(userId: string, deckId: string, dto: UpdateDeckDto): DeckMeta {
    const deck = this.requireOwned(deckId, userId)
    const next: DeckMeta = {
      ...deck,
      name: dto.name?.trim() || deck.name,
      sourceLang: dto.sourceLang ?? deck.sourceLang,
      targetLang: dto.targetLang ?? deck.targetLang,
      updatedAt: nowISO(),
    }

    this.database.run(
      'UPDATE decks SET name = ?, source_lang = ?, target_lang = ?, updated_at = ? WHERE id = ?',
      next.name,
      next.sourceLang,
      next.targetLang,
      next.updatedAt,
      next.id,
    )

    return next
  }

  remove(userId: string, deckId: string) {
    const deck = this.requireOwned(deckId, userId)

    if (this.list(userId).length <= 1) {
      throw new BadRequestException('Не можна видалити останню колоду.')
    }

    const at = nowISO()
    this.database.run('UPDATE decks SET deleted_at = ?, updated_at = ? WHERE id = ?', at, at, deck.id)
  }

  /** Кидає 404, якщо колоди немає або вона чужа — не розкриваємо існування чужих колод. */
  requireOwned(deckId: string, userId: string): DeckMeta {
    const row = this.database.get<DeckRow>(
      'SELECT * FROM decks WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      deckId,
      userId,
    )
    if (!row) throw new NotFoundException('Колоду не знайдено.')
    return toDeck(row)
  }
}

function toDeck(row: DeckRow): DeckMeta {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    sourceLang: row.source_lang,
    targetLang: row.target_lang,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}
