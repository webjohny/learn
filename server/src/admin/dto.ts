import { IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'

/**
 * Передача карток користувачеві: беремо їх із власної колоди адміна й копіюємо
 * у колоду отримувача. Ціль — або наявна колода (`deckId`), або нова
 * (`newDeckName`); мови й тип нова колода успадковує від джерела.
 */
export class GrantCardsDto {
  /** Колода адміна-джерело. */
  @IsString()
  fromDeckId: string

  /** Порожньо — копіюємо всю колоду. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cardIds?: string[]

  @IsOptional()
  @IsString()
  deckId?: string

  @ValidateIf((dto: GrantCardsDto) => !dto.deckId)
  @IsString()
  @MinLength(1, { message: 'Вкажіть назву колоди.' })
  @MaxLength(80)
  newDeckName?: string
}
