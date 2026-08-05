import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @IsEmail({}, { message: 'Введіть коректну email-адресу.' })
  email: string

  @IsString()
  @MinLength(8, { message: 'Пароль має містити щонайменше 8 символів.' })
  @MaxLength(200)
  password: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string
}

export class LoginDto {
  @IsEmail({}, { message: 'Введіть коректну email-адресу.' })
  email: string

  @IsString()
  @MinLength(1, { message: 'Введіть пароль.' })
  password: string
}
