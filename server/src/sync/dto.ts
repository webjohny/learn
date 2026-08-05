import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator'

export class SyncCardDto {
  @IsString()
  id: string

  /** Клієнт надсилає його разом із карткою; авторитет — deckId з URL. */
  @IsOptional()
  @IsString()
  deckId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string

  @IsString()
  @MaxLength(2000)
  front: string

  @IsString()
  @MaxLength(2000)
  back: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: 'easy' | 'medium' | 'hard'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null

  @IsOptional()
  @IsISO8601()
  nextReview?: string | null

  @IsOptional()
  @IsNumber()
  interval?: number

  @IsOptional()
  @IsNumber()
  repetition?: number

  @IsOptional()
  @IsNumber()
  efactor?: number

  @IsOptional()
  @IsNumber()
  lapses?: number

  @IsOptional()
  @IsBoolean()
  suspended?: boolean

  @IsOptional()
  @IsISO8601()
  createdAt?: string

  @IsISO8601()
  updatedAt: string

  @IsOptional()
  @IsISO8601()
  deletedAt?: string | null
}

export class SyncDayDto {
  @IsOptional()
  @IsString()
  deckId?: string

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date має бути у форматі YYYY-MM-DD.' })
  date: string

  @IsNumber()
  reviews: number

  @IsNumber()
  correct: number

  @IsNumber()
  seconds: number

  @IsNumber()
  newCards: number

  @IsISO8601()
  updatedAt: string
}

export class SyncPushDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncCardDto)
  cards?: SyncCardDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncDayDto)
  days?: SyncDayDto[]
}
