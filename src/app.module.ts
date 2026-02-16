import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OutboxModule } from './outbox/outbox.module';
import { AuditLogsModule } from './audit_logs/audit_logs.module';
import { CommonModule } from './common/common.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
// --- YENİ EKLENEN MODÜLLER ---
import { TenantsModule } from './tenants/tenants.module';
import { MembershipsModule } from './memberships/memberships.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // 1. ConfigModule (Global Ayarlar)
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),

    // 2. Veritabanı Bağlantısı
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // Development ortamında true
        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),

    // GÜVENLİK: İstek Sınırlandırma (Rate Limiting) - Basit Mod
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 dakika
      limit: 10,  // 10 istek hakkı
    }]),

    // 3. Mevcut Feature Modüller
    CommonModule,
    UsersModule,
    AuthModule,
    OutboxModule,
    AuditLogsModule,
    HealthModule,

    // --- YENİ SAAS MODÜLLERİ ---
    TenantsModule,
    MembershipsModule,
    SubscriptionsModule, 
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Uygulamadaki TÜM endpointleri otomatik olarak default limite sokar
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}