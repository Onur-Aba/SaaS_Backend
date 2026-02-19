import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// Eski TenantRole silindi, yeni Enumlar eklendi:
import { HierarchyLevel, Profession } from '../common/enums/roles.enum'; 
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('invite')
  async inviteUser(
    @Request() req,
    @Body('tenantId') tenantId: string,
    @Body('email') email: string,
    @Body('hierarchyLevel') hierarchyLevel: HierarchyLevel, // <-- YENİ
    @Body('profession') profession: Profession,             // <-- YENİ
  ) {
    // Servise artık iki ayrı parametre gönderiyoruz
    return this.membershipsService.inviteUser(req.user.id, tenantId, email, hierarchyLevel, profession);
  }

  @Post('accept')
  async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return this.membershipsService.acceptInvite(acceptInviteDto);
  }
}