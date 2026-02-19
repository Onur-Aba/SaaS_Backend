import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request, 
  Patch, 
  Param, 
  ForbiddenException 
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto'; 
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserEntity } from '../users/entities/user.entity';
// --- YENİ DECORATOR VE ENUMLAR ---
import { RolesGuard } from '../common/guards/roles.guard'; 
import { RequireHierarchy } from '../common/decorators/roles.decorator'; 
import { HierarchyLevel } from '../common/enums/roles.enum';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createTenantDto: CreateTenantDto, @Request() req) {
    return this.tenantsService.createCompany(createTenantDto, req.user as UserEntity);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) 
  // Eski @Roles yerine YENİ @RequireHierarchy kullanıyoruz
  @RequireHierarchy(HierarchyLevel.OWNER, HierarchyLevel.ADMIN) 
  @Patch(':id')
  async update(
      @Param('id') id: string, 
      @Body() updateTenantDto: UpdateTenantDto,
      @Request() req
  ) {
      if (req.user.activeTenantId !== id) {
          throw new ForbiddenException('Sadece aktif olduğunuz şirketi güncelleyebilirsiniz.');
      }

      return this.tenantsService.update(id, updateTenantDto);
  }
}