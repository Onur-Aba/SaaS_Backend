import { Controller, Post, Body, UseGuards, Request, Patch, Param, UnauthorizedException } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// Eski TenantRole silindi, yeni Enumlar eklendi:
import { HierarchyLevel, Profession } from '../common/enums/roles.enum'; 
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto'; // YENİ DTO

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('invite')
  async inviteUser(
    @Request() req,
    @Body('tenantId') tenantId: string,
    @Body('email') email: string,
    // DÜZELTME: hierarchyLevel ve profession parametreleri tamamen kaldırıldı!
  ) {
    // Servise sadece kimin, hangi şirkete, kimi davet ettiğini gönderiyoruz
    return this.membershipsService.inviteUser(req.user.id, tenantId, email);
  }

  @Post('accept')
  async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return this.membershipsService.acceptInvite(acceptInviteDto);
  }

  // YENİ: ROL VE MESLEK GÜNCELLEME ENDPOINT'İ
  @UseGuards(JwtAuthGuard)
  @Patch(':id/role')
  async updateRole(
    @Request() req,
    @Param('id') membershipId: string,
    @Body() updateDto: any // updateDto.hierarchyLevel olarak alıyoruz
  ) {
    // KESİN KONTROL: Eğer kimlik boşsa anında reddet!
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Kullanıcı kimliği doğrulanamadı.');
    }

    return this.membershipsService.updateRole(
      String(req.user.id), // Garantili String
      String(membershipId),
      updateDto.hierarchyLevel,
      updateDto.profession
    );
  } 
}