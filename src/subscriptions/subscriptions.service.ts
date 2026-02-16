import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanEntity } from './entities/plan.entity';

@Injectable()
export class SubscriptionsService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
  ) {}

  // Uygulama her başladığında burası çalışır
  async onModuleInit() {
    await this.seedPlans();
  }

  private async seedPlans() {
    const count = await this.planRepository.count();
    if (count > 0) return; // Zaten plan varsa tekrar ekleme

    this.logger.log('🌱 Varsayılan paketler (Plans) veritabanına ekleniyor...');

    const plans = [
      {
        name: 'Free',
        description: 'Bireysel geliştiriciler için başlangıç paketi.',
        features: { max_users: 1, storage_mb: 100 },
        is_active: true,
      },
      {
        name: 'Pro',
        description: 'Küçük ekipler için ideal.',
        features: { max_users: 5, storage_mb: 1000 },
        is_active: true,
      },
      {
        name: 'Enterprise',
        description: 'Büyük organizasyonlar için sınırsız erişim.',
        features: { max_users: 9999, storage_mb: 10000 },
        is_active: true,
      },
    ];

    for (const p of plans) {
      await this.planRepository.save(this.planRepository.create(p));
    }

    this.logger.log('✅ Paketler başarıyla oluşturuldu.');
  }
}