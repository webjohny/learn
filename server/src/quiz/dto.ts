import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

import type { QuizMode, QuizQuestionType } from './quiz.types.js'

/**
 * `whitelist` + `forbidNonWhitelisted` у main.ts означають, що будь-яке
 * незадеклароване поле дає 400 — тому описуємо всі рівні вкладеності.
 */

const MODES: QuizMode[] = ['graded', 'survey']
const TYPES: QuizQuestionType[] = ['single', 'multiple']

export class QuizAnswerDto {
  @IsString()
  id: string

  @IsString()
  @MinLength(1, { message: 'Варіант відповіді не може бути порожнім.' })
  @MaxLength(500)
  text: string

  @IsBoolean()
  correct: boolean
}

export class QuizQuestionDto {
  @IsString()
  id: string

  @IsString()
  @MinLength(1, { message: 'Текст питання не може бути порожнім.' })
  @MaxLength(2000)
  text: string

  @IsIn(TYPES, { message: 'type має бути "single" або "multiple".' })
  type: QuizQuestionType

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[]
}

export class SyncQuizDto {
  @IsString()
  id: string

  @IsString()
  @MinLength(1, { message: 'Вкажіть назву вікторини.' })
  @MaxLength(120)
  title: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null

  @IsIn(MODES, { message: 'mode має бути "graded" або "survey".' })
  mode: QuizMode

  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions: QuizQuestionDto[]

  @IsOptional()
  @IsISO8601()
  createdAt?: string

  @IsISO8601()
  updatedAt: string

  @IsOptional()
  @IsISO8601()
  deletedAt?: string | null
}

export class SyncQuizRunDto {
  @IsString()
  id: string

  @IsString()
  quizId: string

  @IsISO8601()
  finishedAt: string

  @IsInt()
  @Min(0)
  score: number

  @IsInt()
  @Min(0)
  total: number
}

export class QuizPushDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncQuizDto)
  quizzes?: SyncQuizDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncQuizRunDto)
  runs?: SyncQuizRunDto[]
}
