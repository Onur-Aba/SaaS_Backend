// src/memberships/entities/membership.entity.ts
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AbstractBaseEntity } from '../../common/abstract.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
// YENİ ENUMLARI İÇERİ AKTARIYORUZ (Dosya yolunu kendi klasör yapına göre ayarlayabilirsin)
import { HierarchyLevel, Profession } from '../../common/enums/roles.enum';

@Entity('memberships')
// Bir kullanıcı aynı şirkete iki kere eklenemez:
@Index(['user_id', 'tenant_id'], { unique: true }) 
export class MembershipEntity extends AbstractBaseEntity {
  
  // 1. EKSEN: Hiyerarşi (Eski 'role' alanının yerini alıyor)
  @Column({ type: 'enum', enum: HierarchyLevel, default: HierarchyLevel.JUNIOR })
  hierarchy_level!: HierarchyLevel;

  // 2. EKSEN: Meslek / Departman
  @Column({ type: 'enum', enum: Profession, default: Profession.FULLSTACK_DEV })
  profession!: Profession;

  // Davet kabul edildi mi? (MEVCUT MANTIĞI KORUDUK)
  @Column({ default: false })
  is_accepted!: boolean; 

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