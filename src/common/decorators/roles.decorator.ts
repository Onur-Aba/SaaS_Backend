import { SetMetadata } from '@nestjs/common';
import { HierarchyLevel, Profession } from '../enums/roles.enum';

export const HIERARCHY_KEY = 'hierarchy_levels';
export const PROFESSION_KEY = 'professions';

// Endpoint'e erişebilecek minimum/gerekli hiyerarşi seviyelerini belirler
export const RequireHierarchy = (...levels: HierarchyLevel[]) => SetMetadata(HIERARCHY_KEY, levels);

// Endpoint'e erişebilecek meslek gruplarını belirler
export const RequireProfession = (...professions: Profession[]) => SetMetadata(PROFESSION_KEY, professions);