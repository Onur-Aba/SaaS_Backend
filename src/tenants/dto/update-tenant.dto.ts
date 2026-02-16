import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantDto } from './create-tenant.dto';

// CreateTenantDto'dan türer ama hepsi opsiyonel olur
export class UpdateTenantDto extends PartialType(CreateTenantDto) {}