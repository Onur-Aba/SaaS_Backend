// src/subscriptions/entities/plan.entity.ts
import { Entity, Column } from 'typeorm';
import { AbstractBaseEntity } from '../../common/abstract.entity';

@Entity('plans')
export class PlanEntity extends AbstractBaseEntity {
  @Column({ unique: true })
  name!: string; // Örn: 'Free', 'Pro', 'Enterprise'

  @Column({ nullable: true })
  description!: string;

  // Stripe veya Paddle tarafındaki ID (Webhooklar için kritik)
  @Column({ nullable: true })
  external_price_id!: string; 

  // KRİTİK: Paket özellikleri JSON olarak tutulur.
  // Örn: { "max_users": 5, "can_use_ai": true, "storage_limit_mb": 1000 }
  // Bu sayede veritabanı şemasını değiştirmeden yeni özellikler satabilirsiniz.
  @Column({ type: 'jsonb', default: {} })
  features!: Record<string, any>;

  @Column({ default: true })
  is_active!: boolean;
}