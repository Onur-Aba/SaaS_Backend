// src/memberships/entities/invitation.entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AbstractBaseEntity } from '../../common/abstract.entity';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { UserEntity } from '../../users/entities/user.entity'; // Davet eden kişi
import { TenantRole } from './membership.entity';

@Entity('invitations')
export class InvitationEntity extends AbstractBaseEntity {
  @Column()
  email!: string; // Davet edilen e-posta

  @Column({ type: 'enum', enum: TenantRole, default: TenantRole.MEMBER })
  role!: TenantRole; // Hangi yetkiyle davet edildi?

  @Column({ unique: true })
  token!: string; // Benzersiz davet kodu

  @Column({ type: 'timestamptz' })
  expires_at!: Date; // Davet süresi (örn: 7 gün)

  @Column({ nullable: true })
  accepted_at!: Date; // Ne zaman kabul edildi?

  @Column({ default: false })
  is_revoked!: boolean; // Davet geri çekildi mi?

  // --- İlişkiler ---

  // Hangi şirkete davet ediliyor?
  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  // Kim davet etti?
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'inviter_id' })
  inviter!: UserEntity;

  @Column({ type: 'uuid' })
  inviter_id!: string;
}