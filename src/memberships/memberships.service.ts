// src/memberships/memberships.service.ts
import { 
  Injectable, 
  BadRequestException, 
  NotFoundException, 
  ForbiddenException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm'; 
import * as crypto from 'crypto';
import * as argon2 from 'argon2'; 

import { InvitationEntity } from './entities/invitation.entity';
import { TenantEntity } from '../tenants/entities/tenant.entity';
import { MembershipEntity } from './entities/membership.entity'; 
import { UserEntity, AccountStatus } from '../users/entities/user.entity'; 
import { OutboxService } from '../outbox/outbox.service';
import { AcceptInviteDto } from './dto/accept-invite.dto'; 
import { HierarchyLevel, Profession } from '../common/enums/roles.enum';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(InvitationEntity)
    private readonly invitationRepo: Repository<InvitationEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(MembershipEntity)
    private readonly membershipRepo: Repository<MembershipEntity>,
    private readonly outboxService: OutboxService,
  ) {}

  async inviteUser(
    inviterId: string,
    tenantId: string, 
    email: string, 
    hierarchyLevel: HierarchyLevel,
    profession: Profession
  ) {
    // 1. ŞİRKET VE PLAN KONTROLÜ
    const tenant = await this.tenantRepo.findOne({
        where: { id: tenantId },
        relations: ['subscription', 'subscription.plan']
    });

    if (!tenant) throw new NotFoundException('Şirket bulunamadı.');

    const currentMemberCount = await this.membershipRepo.count({
        where: { tenant_id: tenantId }
    });

    const maxUsers = tenant.subscription?.plan?.features['max_users'] || 1;

    if (currentMemberCount >= maxUsers) {
        throw new ForbiddenException(
            `Paket limitiniz (${maxUsers} kullanıcı) doldu. Yeni kullanıcı eklemek için paketinizi yükseltin.`
        );
    }

    // 3. Daha önce davet edilmiş mi?
    const existingInvite = await this.invitationRepo.findOne({
      where: { 
        email, 
        tenant_id: tenantId, 
        is_revoked: false, 
        accepted_at: IsNull() 
      }
    });

    if (existingInvite) {
        throw new BadRequestException('Bu kullanıcı zaten davet edilmiş.');
    }

    // 4. Davet Oluştur
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.invitationRepo.create({
      email,
      hierarchy_level: hierarchyLevel,
      profession: profession,
      token,
      expires_at: expiresAt,
      tenant_id: tenantId,
      inviter_id: inviterId
    });

    await this.invitationRepo.save(invitation);

    // 5. Mail Gönder
    await this.outboxService.create({
      type: 'SEND_INVITATION_EMAIL',
      payload: {
        email,
        inviteLink: `http://localhost:3001/accept-invite?token=${token}`,
        hierarchyLevel,
        profession
      }
    });

    return { message: 'Davet gönderildi.' };
  }

  // --- DAVETİ KABUL ETME ---
  async acceptInvite(acceptInviteDto: AcceptInviteDto) {
    const { token, password, username } = acceptInviteDto;

    const invitation = await this.invitationRepo.findOne({
      where: { token },
      relations: ['tenant'],
    });

    if (!invitation) throw new NotFoundException('Davet bulunamadı veya geçersiz.');
    if (invitation.is_revoked) throw new ForbiddenException('Bu davet iptal edilmiş.');
    if (invitation.accepted_at) throw new ForbiddenException('Bu davet zaten kullanılmış.');
    if (invitation.expires_at < new Date()) throw new ForbiddenException('Davet süresi dolmuş.');

    let user = await this.userRepo.findOne({ where: { email: invitation.email } });

    if (!user) {
      if (!password) {
        throw new BadRequestException('Yeni hesap oluşturmak için şifre belirlemelisiniz.');
      }

      user = new UserEntity();
      user.email = invitation.email;
      user.username = username || invitation.email.split('@')[0]; 
      user.password_hash = await argon2.hash(password);
      user.account_status = AccountStatus.ACTIVE; 
      user.security_stamp = crypto.randomUUID(); 

      await this.userRepo.save(user);
    }

    const existingMembership = await this.membershipRepo.findOne({
      where: { user_id: user.id, tenant_id: invitation.tenant_id }
    });

    if (existingMembership) {
      invitation.accepted_at = new Date();
      await this.invitationRepo.save(invitation);
      return { message: 'Zaten bu şirketin üyesisiniz.' };
    }

    // YENİ: Davetteki Rütbe ve Meslek bilgileri ile üyeliği başlat
    const membership = new MembershipEntity();
    membership.user = user;
    membership.tenant = invitation.tenant;
    membership.hierarchy_level = invitation.hierarchy_level;
    membership.profession = invitation.profession;
    membership.is_accepted = true;

    await this.membershipRepo.save(membership);

    invitation.accepted_at = new Date();
    await this.invitationRepo.save(invitation);

    return { 
      message: 'Davet başarıyla kabul edildi. Şimdi giriş yapabilirsiniz.',
      email: user.email 
    };
  }
}