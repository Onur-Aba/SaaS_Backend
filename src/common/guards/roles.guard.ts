import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TenantRole } from '../../memberships/entities/membership.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TenantRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // Endpoint'te rol şartı yoksa geç
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Token içinde tenant bilgisi ve rolü var mı? (Switch Tenant yapınca gelecek)
    if (!user || !user.activeTenantId || !user.activeRole) {
       throw new ForbiddenException('Bu işlem için bir organizasyon seçmiş olmanız gerekir.');
    }

    // Rol yetiyor mu?
    const hasRole = requiredRoles.includes(user.activeRole);
    if (!hasRole) {
        throw new ForbiddenException('Bu işlem için yetkiniz yetersiz.');
    }

    return true;
  }
}