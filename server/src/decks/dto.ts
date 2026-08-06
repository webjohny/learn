import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'

import type { DeckKind } from '../types.js'

/** BCP-47: 'uk', 'en-US', 'de-DE'. */
const BCP47 = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

const KINDS: DeckKind[] = ['language', 'subject']

/** Мови обов'язкові лише для мовних пар; у `subject` їх немає. */
const isLanguageDeck = (dto: { kind?: DeckKind }) => (dto.kind ?? 'language') === 'language'

export class CreateDeckDto {
  @IsString()
  @MinLength(1, { message: 'Вкажіть назву колоди.' })
  @MaxLength(80)
  name: string

  @IsOptional()
  @IsIn(KINDS, { message: 'kind має бути "language" або "subject".' })
  kind?: DeckKind

  @ValidateIf(isLanguageDeck)
  @Matches(BCP47, { message: 'sourceLang має бути кодом мови, напр. "uk".' })
  sourceLang?: string

  @ValidateIf(isLanguageDeck)
  @Matches(BCP47, { message: 'targetLang має бути кодом мови, напр. "en-US".' })
  targetLang?: string
}

export class UpdateDeckDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string

  @IsOptional()
  @Matches(BCP47, { message: 'sourceLang має бути кодом мови, напр. "uk".' })
  sourceLang?: string

  @IsOptional()
  @Matches(BCP47, { message: 'targetLang має бути кодом мови, напр. "en-US".' })
  targetLang?: string
}
