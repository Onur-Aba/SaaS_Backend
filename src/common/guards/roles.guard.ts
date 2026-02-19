import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HIERARCHY_KEY, PROFESSION_KEY } from '../decorators/roles.decorator';
import { HierarchyLevel, Profession } from '../enums/roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Endpoint'in istediği Rütbeleri ve Meslekleri oku
    const requiredHierarchies = this.reflector.getAllAndOverride<HierarchyLevel[]>(HIERARCHY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredProfessions = this.reflector.getAllAndOverride<Profession[]>(PROFESSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Eğer endpoint'te hiçbir kısıtlama yoksa direkt geçiş ver
    if (!requiredHierarchies && !requiredProfessions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // 2. Kullanıcının aktif bir tenant'ı, rütbesi ve mesleği var mı?
    // Not: Auth sisteminde token payload'ına 'activeHierarchy' ve 'activeProfession' eklemen gerekecek.
    if (!user || !user.activeTenantId || !user.activeHierarchy || !user.activeProfession) {
       throw new ForbiddenException('Bu işlem için bir çalışma alanı (Tenant) seçmiş olmanız gerekir.');
    }

    // 3. Hiyerarşi (Rütbe) Kontrolü (Eğer endpoint rütbe şartı koşmuşsa)
    if (requiredHierarchies && requiredHierarchies.length > 0) {
      // OWNER her zaman her şeyi yapabilir (Sistemin mutlak hakimi)
      if (user.activeHierarchy !== HierarchyLevel.OWNER) {
        const hasHierarchy = requiredHierarchies.includes(user.activeHierarchy);
        if (!hasHierarchy) {
          throw new ForbiddenException('Bu işlem için yönetsel yetkiniz (Rütbeniz) yetersiz.');
        }
      }
    }

    // 4. Meslek (Disiplin) Kontrolü (Eğer endpoint meslek şartı koşmuşsa)
    if (requiredProfessions && requiredProfessions.length > 0) {
      // OWNER ve ADMIN'ler genellikle her disiplini görebilir (İsteğe bağlı kısıtlayabilirsin)
      if (user.activeHierarchy !== HierarchyLevel.OWNER && user.activeHierarchy !== HierarchyLevel.ADMIN) {
        const hasProfession = requiredProfessions.includes(user.activeProfession);
        if (!hasProfession) {
          throw new ForbiddenException('Bu işlem sizin uzmanlık/departman alanınızda bulunmuyor.');
        }
      }
    }

    return true;
  }
}