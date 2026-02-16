// src/subscriptions/entities/subscription.entity.ts
import { Entity, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../common/abstract.entity';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { PlanEntity } from './plan.entity';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  PAST_DUE = 'PAST_DUE', // Ödeme başarısız ama süre tanınmış
  CANCELED = 'CANCELED',
  UNPAID = 'UNPAID',
}

@Entity('subscriptions')
export class SubscriptionEntity extends AbstractBaseEntity {
  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.TRIALING })
  status!: SubscriptionStatus;

  @Column({ type: 'timestamptz' })
  current_period_end!: Date; // Abonelik bitiş tarihi

  @Column({ nullable: true })
  stripe_subscription_id!: string; // Ödeme sağlayıcısındaki ID

  // İlişkiler
  @OneToOne(() => TenantEntity, (tenant) => tenant.subscription)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @ManyToOne(() => PlanEntity)
  @JoinColumn({ name: 'plan_id' })
  plan!: PlanEntity;

  @Column({ type: 'uuid' })
  plan_id!: string;
}