import { SetMetadata } from '@nestjs/common';
import { TenantRole } from '../../memberships/entities/membership.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);