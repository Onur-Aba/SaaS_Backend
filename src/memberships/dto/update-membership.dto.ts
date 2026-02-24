import { IsEnum, IsOptional } from 'class-validator';
import { HierarchyLevel, Profession } from '../../common/enums/roles.enum';

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(HierarchyLevel, { message: 'Geçersiz hiyerarşi seviyesi.' })
  hierarchyLevel?: HierarchyLevel;

  @IsOptional()
  @IsEnum(Profession, { message: 'Geçersiz meslek/departman.' })
  profession?: Profession;
}