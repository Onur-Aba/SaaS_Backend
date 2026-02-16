import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { PlanEntity } from './entities/plan.entity';
import { SubscriptionEntity } from './entities/subscription.entity';

@Module({
  imports: [
    // Plan ve Subscription tablolarını yönetiyor
    TypeOrmModule.forFeature([PlanEntity, SubscriptionEntity])
  ],
  controllers: [], // Şimdilik dışa açık bir controller yok, sadece servis çalışacak
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}