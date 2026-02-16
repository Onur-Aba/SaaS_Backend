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
import { MembershipEntity, TenantRole } from './entities/membership.entity'; 
import { UserEntity, AccountStatus } from '../users/entities/user.entity'; 
import { OutboxService } from '../outbox/outbox.service';
import { AcceptInviteDto } from './dto/accept-invite.dto'; 

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
    role: TenantRole
  ) {
    // --- 1. ŞİRKET VE PLAN KONTROLÜ (GELİR MODELİ KORUMASI) ---
    const tenant = await this.tenantRepo.findOne({
        where: { id: tenantId },
        relations: ['subscription', 'subscription.plan']
    });

    if (!tenant) throw new NotFoundException('Şirket bulunamadı.');

    // 2. Limit Kontrolü
    const currentMemberCount = await this.membershipRepo.count({
        where: { tenant_id: tenantId }
    });

    // Plan özelliklerinde 'max_users' anahtarı var mı? Yoksa varsayılan 1 olsun.
    // (tenant.subscription?.plan?.features kısmına güvenli erişim)
    const maxUsers = tenant.subscription?.plan?.features['max_users'] || 1;

    if (currentMemberCount >= maxUsers) {
        throw new ForbiddenException(
            `Paket limitiniz (${maxUsers} kullanıcı) doldu. Yeni kullanıcı eklemek için paketinizi yükseltin.`
        );
    }
    // ------------------------------------------------------------

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
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 Gün geçerli

    const invitation = this.invitationRepo.create({
      email,
      role,
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
        inviteLink: `https://app.senin-saas.com/accept-invite?token=${token}`,
        role
      }
    });

    return { message: 'Davet gönderildi.' };
  }

  // --- DAVETİ KABUL ETME ---
  async acceptInvite(acceptInviteDto: AcceptInviteDto) {
    const { token, password, username } = acceptInviteDto;

    // 1. Daveti Bul
    const invitation = await this.invitationRepo.findOne({
      where: { token },
      relations: ['tenant'], // Hangi şirkete davet edildiğini bilmemiz lazım
    });

    if (!invitation) {
      throw new NotFoundException('Davet bulunamadı veya geçersiz.');
    }

    // 2. Kontroller (Süresi dolmuş mu? İptal edilmiş mi?)
    if (invitation.is_revoked) {
      throw new ForbiddenException('Bu davet iptal edilmiş.');
    }

    if (invitation.accepted_at) {
      throw new ForbiddenException('Bu davet zaten kullanılmış.');
    }

    if (invitation.expires_at < new Date()) {
      throw new ForbiddenException('Davet süresi dolmuş.');
    }

    // 3. Kullanıcı Sistemde Var mı?
    let user = await this.userRepo.findOne({ where: { email: invitation.email } });

    // SENARYO A: Kullanıcı Yoksa -> OLUŞTUR
    // (Yeni kullanıcı kaydı + Şirket üyeliği)
    if (!user) {
      if (!password) {
        throw new BadRequestException('Yeni hesap oluşturmak için şifre belirlemelisiniz.');
      }

      user = new UserEntity();
      user.email = invitation.email;
      // Username yoksa emailin başını al (örn: ahmet@mail.com -> ahmet)
      user.username = username || invitation.email.split('@')[0]; 
      user.password_hash = await argon2.hash(password);
      user.account_status = AccountStatus.ACTIVE; // Davetle geldiği için direkt aktif
      user.security_stamp = crypto.randomUUID(); 

      await this.userRepo.save(user);
    }

    // SENARYO B: Kullanıcı Varsa (Veya yeni oluşturulduysa) -> MEMBERSHIP OLUŞTUR

    // Önce zaten üye mi diye bak?
    const existingMembership = await this.membershipRepo.findOne({
      where: { user_id: user.id, tenant_id: invitation.tenant_id }
    });

    if (existingMembership) {
      // Zaten üyeyse sadece daveti kapat (Tekrar eklemeye çalışma)
      invitation.accepted_at = new Date();
      await this.invitationRepo.save(invitation);
      return { message: 'Zaten bu şirketin üyesisiniz.' };
    }

    // Üyelik Kaydı (Membership)
    const membership = new MembershipEntity();
    membership.user = user;
    membership.tenant = invitation.tenant;
    membership.role = invitation.role;
    membership.is_accepted = true; // Daveti kabul ettiği için true

    await this.membershipRepo.save(membership);

    // 4. Daveti "Kullanıldı" Olarak İşaretle
    invitation.accepted_at = new Date();
    await this.invitationRepo.save(invitation);

    return { 
      message: 'Davet başarıyla kabul edildi. Şimdi giriş yapabilirsiniz.',
      email: user.email 
    };
  }
}