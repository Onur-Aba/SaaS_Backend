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
    email: string
    // DÜZELTME 1: hierarchyLevel ve profession parametreleri buradan da silindi
  ) {
    // 0. KRİTİK GÜVENLİK KONTROLÜ
    const inviterMembership = await this.membershipRepo.findOne({
      where: { user_id: inviterId, tenant_id: tenantId }
    });

    if (!inviterMembership) {
      throw new ForbiddenException('Bu şirkette üye değilsiniz.');
    }

    if (inviterMembership.hierarchy_level !== HierarchyLevel.OWNER && inviterMembership.hierarchy_level !== HierarchyLevel.ADMIN) {
      throw new ForbiddenException('Sadece Kurucu ve Yöneticiler (Admin) yeni üye davet edebilir.');
    }

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

    // DÜZELTME 2: GÜVENLİK MÜHRÜ (Herkes GUEST ve CLIENT olarak başlar)
    const invitation = this.invitationRepo.create({
      email,
      hierarchy_level: HierarchyLevel.GUEST, // ARTIK DIŞARIDAN DEĞİŞTİRİLEMEZ
      profession: Profession.CLIENT,         // ARTIK DIŞARIDAN DEĞİŞTİRİLEMEZ
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
        inviteLink: `http://localhost:3001/tr/accept-invite?token=${token}`,
        hierarchyLevel: HierarchyLevel.GUEST, // Mail servisine de sabit gidiyor
        profession: Profession.CLIENT
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

  // --- MEVCUT METOTLARIN ALTINA EKLE ---
  // --- YETKİ VE DEPARTMAN GÜNCELLEME METODU ---
// --- YETKİ VE DEPARTMAN GÜNCELLEME METODU ---
async updateRole(
    requesterId: string, 
    membershipId: string, 
    newHierarchy?: HierarchyLevel, 
    newProfession?: Profession
  ) {
    // 1. KRİTİK DÜZELTME: 'user' ilişkisini zorunlu olarak çekiyoruz!
    const targetMembership = await this.membershipRepo.findOne({ 
      where: { id: membershipId },
      relations: ['user'] // <-- TypeORM'un user_id'yi gizlemesini engelliyoruz
    });
    
    if (!targetMembership) throw new NotFoundException('Üyelik bulunamadı.');

    // Hedef kullanıcının ID'sini garantili ve hatasız şekilde alıyoruz
    const targetUserId = targetMembership.user?.id || targetMembership.user_id;

    if (!targetUserId) {
      throw new BadRequestException('Hedef üyenin kullanıcı kimliği okunamadı.');
    }

    // 2. ZORUNLU KİMLİK KONTROLÜ
    const safeReqId = String(requesterId).toLowerCase().trim();
    const safeTargetId = String(targetUserId).toLowerCase().trim();

    // =========================================================================
    // AŞILAMAZ GÜVENLİK DUVARI: KENDİ KENDİNE MÜDAHALE YASAĞI
    // =========================================================================
    if (safeReqId === safeTargetId) {
      throw new ForbiddenException('Güvenlik ihlali: Kendi rolünüze veya departmanınıza müdahale edemezsiniz!');
    }

    const requesterMembership = await this.membershipRepo.findOne({
      where: { user_id: requesterId, tenant_id: targetMembership.tenant_id }
    });

    if (!requesterMembership) {
      throw new ForbiddenException('Bu çalışma alanında yetki işlemi yapamazsınız.');
    }

    // 3. ZORUNLU ROL NORMALİZASYONU
    const reqRole = String(requesterMembership.hierarchy_level).toUpperCase() as HierarchyLevel;
    const targetRole = String(targetMembership.hierarchy_level).toUpperCase() as HierarchyLevel;

    const hierarchyWeight: Record<string, number> = {
      OWNER: 1, ADMIN: 2, MANAGER: 3, DEPARTMENT_LEAD: 4, TEAM_LEAD: 5,
      SENIOR: 6, MID_LEVEL: 7, JUNIOR: 8, GUEST: 9,
    };

    const reqWeight = hierarchyWeight[reqRole] || 99;
    const targetWeight = hierarchyWeight[targetRole] || 99;

    // 4. KENDİ RÜTBESİNE VE ÜSTÜNE MÜDAHALE KONTROLÜ
    if (reqWeight >= targetWeight) {
      throw new ForbiddenException('Sizinle aynı veya daha üst yetkiye sahip kişilere müdahale edemezsiniz.');
    }

    // 5. KİMSEYİ KENDİ RÜTBESİNE VEYA ÜSTÜNE ÇIKARAMAZ
    if (newHierarchy) {
      const newRoleWeight = hierarchyWeight[String(newHierarchy).toUpperCase()] || 99;
      if (reqWeight >= newRoleWeight) {
        throw new ForbiddenException('Kendi yetki seviyenizi veya daha üstünü başkasına veremezsiniz.');
      }
      targetMembership.hierarchy_level = newHierarchy;
    }

    if (newProfession) targetMembership.profession = newProfession;

    await this.membershipRepo.save(targetMembership);

    return { 
      message: 'Yetki başarıyla güncellendi.', 
      membership: targetMembership 
    };
  }
}