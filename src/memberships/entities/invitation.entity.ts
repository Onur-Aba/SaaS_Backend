// src/memberships/entities/invitation.entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AbstractBaseEntity } from '../../common/abstract.entity';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { HierarchyLevel, Profession } from '../../common/enums/roles.enum';

@Entity('invitations')
export class InvitationEntity extends AbstractBaseEntity {
  @Column()
  email!: string;

  // YENİ: Hiyerarşi (Rütbe)
  @Column({ type: 'enum', enum: HierarchyLevel, default: HierarchyLevel.JUNIOR })
  hierarchy_level!: HierarchyLevel;

  // YENİ: Meslek (Departman)
  @Column({ type: 'enum', enum: Profession, default: Profession.FULLSTACK_DEV })
  profession!: Profession;

  @Column({ unique: true })
  token!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ nullable: true })
  accepted_at!: Date;

  @Column({ default: false })
  is_revoked!: boolean;

  // --- İlişkiler ---
  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'inviter_id' })
  inviter!: UserEntity;

  @Column({ type: 'uuid' })
  inviter_id!: string;
}