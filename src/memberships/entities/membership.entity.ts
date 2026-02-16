// src/memberships/entities/membership.entity.ts
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AbstractBaseEntity } from '../../common/abstract.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { TenantEntity } from '../../tenants/entities/tenant.entity';

export enum TenantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

@Entity('memberships')
// Bir kullanıcı aynı şirkete iki kere eklenemez:
@Index(['user_id', 'tenant_id'], { unique: true }) 
export class MembershipEntity extends AbstractBaseEntity {
  
  @Column({ type: 'enum', enum: TenantRole, default: TenantRole.MEMBER })
  role!: TenantRole;

  @Column({ default: false })
  is_accepted!: boolean; // Davet kabul edildi mi?

  // --- İlişkiler ---
  @ManyToOne(() => UserEntity, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => TenantEntity, (tenant) => tenant.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  tenant_id!: string;
}