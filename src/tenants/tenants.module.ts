import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantEntity } from './entities/tenant.entity';
import { PlanEntity } from '../subscriptions/entities/plan.entity';
import { SubscriptionEntity } from '../subscriptions/entities/subscription.entity';
import { MembershipEntity } from '../memberships/entities/membership.entity';

@Module({
  imports: [
    // Servis içinde bu tablolarla işlem yapıyoruz
    TypeOrmModule.forFeature([
      TenantEntity, 
      PlanEntity, 
      SubscriptionEntity, 
      MembershipEntity
    ])
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService], // Başka modüller kullanmak isterse diye dışa açıyoruz
})
export class TenantsModule {}