import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

/** BCP-47: 'uk', 'en-US', 'de-DE'. */
const BCP47 = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export class CreateDeckDto {
  @IsString()
  @MinLength(1, { message: 'Вкажіть назву колоди.' })
  @MaxLength(80)
  name: string

  @Matches(BCP47, { message: 'sourceLang має бути кодом мови, напр. "uk".' })
  sourceLang: string

  @Matches(BCP47, { message: 'targetLang має бути кодом мови, напр. "en-US".' })
  targetLang: string
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
