// src/tenants/entities/tenant.entity.ts
import { Entity, Column, OneToMany, OneToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../common/abstract.entity';
import { MembershipEntity } from '../../memberships/entities/membership.entity';
import { SubscriptionEntity } from '../../subscriptions/entities/subscription.entity';

@Entity('tenants')
export class TenantEntity extends AbstractBaseEntity {
  @Column()
  name!: string;

  // URL dostu isim (örn: acme-corp). Subdomain desteği için şart.
  @Column({ unique: true })
  slug!: string; 

  @Column({ nullable: true })
  logo_url!: string;

  // Şirket sahibi (Creator).
  @Column({ type: 'uuid' })
  owner_id!: string;

  // --- EKLENEN KISIM: settings ---
  // Fatura adresi, vergi no, tema ayarları gibi esnek verileri burada tutacağız.
  @Column({ type: 'jsonb', nullable: true })
  settings!: Record<string, any>;
  // -------------------------------

  // Organizasyonun aktif aboneliği
  @OneToOne(() => SubscriptionEntity, (sub) => sub.tenant, { cascade: true })
  subscription!: SubscriptionEntity;

  @OneToMany(() => MembershipEntity, (membership) => membership.tenant)
  memberships!: MembershipEntity[];
}