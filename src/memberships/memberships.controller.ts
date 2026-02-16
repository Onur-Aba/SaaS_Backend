import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantRole } from './entities/membership.entity';
import { AcceptInviteDto } from './dto/accept-invite.dto'; // <-- DTO İmport Edildi

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('invite')
  async inviteUser(
    @Request() req,
    @Body('tenantId') tenantId: string,
    @Body('email') email: string,
    @Body('role') role: TenantRole,
  ) {
    // NOT: İleride burada kullanıcının o tenant'ta yetkisi var mı diye 
    // kontrol eden bir Guard (RolesGuard) ekleyeceğiz.
    return this.membershipsService.inviteUser(req.user.id, tenantId, email, role);
  }

  // YENİ ENDPOINT: Login gerektirmez! (Public)
  // Kullanıcı davet linkine tıkladığında bu endpoint çalışır.
  @Post('accept')
  async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return this.membershipsService.acceptInvite(acceptInviteDto);
  }
}