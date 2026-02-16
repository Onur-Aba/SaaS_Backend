// src/tenants/dto/create-tenant.dto.ts
import { IsString, IsNotEmpty, IsUUID, IsOptional, Matches, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BillingAddressDto {
  @IsString()
  @IsNotEmpty()
  address_line1!: string;

  @IsString()
  @IsOptional()
  address_line2?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsString()
  @IsOptional()
  zip_code?: string;
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  company_name!: string;

  // URL dostu olup olmadığını kontrol ediyoruz (sadece harf, sayı ve tire)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug sadece küçük harf, rakam ve tire içerebilir.' })
  slug!: string;

  @IsUUID()
  @IsNotEmpty()
  plan_id!: string; // Hangi paketi satın alıyor?

  // Geleceğe dönük kurumsal alanlar
  @IsString()
  @IsOptional()
  tax_id?: string; // Vergi Numarası

  @IsString()
  @IsOptional()
  tax_office?: string; // Vergi Dairesi

  @ValidateNested()
  @Type(() => BillingAddressDto)
  @IsOptional()
  billing_address?: BillingAddressDto;
}