// src/memberships/dto/accept-invite.dto.ts
import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  token!: string; // E-postadan gelen davet kodu

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string; // Eğer kullanıcı yeni kayıt oluyorsa şifre belirlemeli

  @IsOptional()
  @IsString()
  username?: string; // Opsiyonel kullanıcı adı
}