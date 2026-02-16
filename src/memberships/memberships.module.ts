import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { InvitationEntity } from './entities/invitation.entity';
import { MembershipEntity } from './entities/membership.entity'; // <-- EKLE
import { TenantEntity } from '../tenants/entities/tenant.entity';
import { UserEntity } from '../users/entities/user.entity'; // <-- EKLE
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvitationEntity, 
      TenantEntity, 
      UserEntity, // <-- ARTIK USER TABLOSUNA DA YAZACAĞIZ
      MembershipEntity // <-- MEMBERSHIP TABLOSUNA DA YAZACAĞIZ
    ]),
    OutboxModule 
  ],
  controllers: [MembershipsController],
  providers: [MembershipsService],
})
export class MembershipsModule {}