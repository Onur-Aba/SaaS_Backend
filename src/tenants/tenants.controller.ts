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
import { UpdateTenantDto } from './dto/update-tenant.dto'; // <-- DTO import edildi
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserEntity } from '../users/entities/user.entity';
// --- YENİ İMPORTLAR ---
import { RolesGuard } from '../common/guards/roles.guard'; 
import { Roles } from '../common/decorators/roles.decorator'; 
import { TenantRole } from '../memberships/entities/membership.entity';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // --- MEVCUT CREATE METODU ---
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createTenantDto: CreateTenantDto, @Request() req) {
    // req.user, JwtStrategy'den gelen validate edilmiş kullanıcıdır
    return this.tenantsService.createCompany(createTenantDto, req.user as UserEntity);
  }

  // --- YENİ EKLENEN UPDATE METODU ---
  // Sadece Owner ve Admin yetkisi olanlar güncelleyebilir.
  @UseGuards(JwtAuthGuard, RolesGuard) // <-- Önce Login, Sonra Rol Kontrolü
  @Roles(TenantRole.OWNER, TenantRole.ADMIN) // <-- Sadece Owner ve Admin
  @Patch(':id')
  async update(
      @Param('id') id: string, 
      @Body() updateTenantDto: UpdateTenantDto,
      @Request() req
  ) {
      // Ekstra Güvenlik: Token'daki tenant ID ile URL'deki ID uyuşuyor mu?
      // Kullanıcı sadece "o an aktif olduğu" şirketi güncelleyebilmeli.
      if (req.user.activeTenantId !== id) {
          throw new ForbiddenException('Sadece aktif olduğunuz şirketi güncelleyebilirsiniz.');
      }

      return this.tenantsService.update(id, updateTenantDto);
  }
}