// src/outbox/outbox.service.ts;

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { OutboxEntity, OutboxStatus } from './entities/outbox.entity';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // --- 1. CREATE METODU (Diğer servislerin buraya iş atması için) ---
  async create(data: { type: string; payload: any }) {
    const outbox = this.outboxRepository.create({
      type: data.type,
      payload: data.payload,
      status: OutboxStatus.PENDING,
    });
    
    return await this.outboxRepository.save(outbox);
  }
  // ------------------------------------------------------------------

  // --- 2. WORKER (Her 10 saniyede bir çalışır) ---
  @Cron('*/10 * * * * *')
  async processOutboxMessages() {
    // Transaction başlatıyoruz (Veri tutarlılığı ve kilit mekanizması için)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // A. KİLİTLİ SORGULAMA (SKIP LOCKED)
      // Bu yapı sayesinde birden fazla sunucu (instance) çalışsa bile aynı maili iki kere atmazlar.
      const pendingEvents = await queryRunner.manager
        .createQueryBuilder(OutboxEntity, 'outbox')
        .where('outbox.status = :status', { status: OutboxStatus.PENDING })
        .orderBy('outbox.created_at', 'ASC')
        .take(5) // Her turda 5 iş al
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (pendingEvents.length === 0) {
        await queryRunner.rollbackTransaction();
        return; // İş yoksa çık
      }

      this.logger.log(`${pendingEvents.length} adet yeni iş bulundu. İşleniyor...`);

      // B. İŞLERİ SIRAYLA İŞLE
      for (const event of pendingEvents) {
        try {
          // Durumu PROCESSING yap
          event.status = OutboxStatus.PROCESSING;
          await queryRunner.manager.save(event);

          const payload = event.payload as any;

          // --- EVENT TİPİNE GÖRE İŞLEM VE LOGLAMA ---
          
          if (event.type === 'USER_REGISTERED') {
            await this.simulateSendEmail(
              payload.email,
              'Hoşgeldiniz! Hesabınız oluşturuldu.'
            );
          } 
          
          else if (event.type === 'VERIFY_EMAIL') {
            // GELİŞTİRME LOGU: Token'ı konsola basıyoruz
            this.logger.warn(`📨 [SİMÜLASYON] Kime: ${payload.email}`);
            this.logger.warn(`🔗 [TOKEN BURADA]: ${payload.verifyLink}`); // <-- EKLENDİ

            await this.simulateSendEmail(
              payload.email,
              `Aramıza hoşgeldin ${payload.name}! Lütfen hesabınızı doğrulamak için şu linke tıklayın: ${payload.verifyLink}`
            );
          } 
          
          else if (event.type === 'PASSWORD_RESET_REQUESTED') {
            // GELİŞTİRME LOGU
            this.logger.warn(`🔐 [ŞİFRE SIFIRLAMA] Kime: ${payload.email}`);
            this.logger.warn(`🔗 [LİNK BURADA]: ${payload.resetLink}`); // <-- EKLENDİ

            await this.simulateSendEmail(
              payload.email,
              `Şifre Sıfırlama Bağlantınız: ${payload.resetLink}`
            );
          } 
          
          else if (event.type === 'TWO_FACTOR_OTP') {
            // GELİŞTİRME LOGU: 2FA Kodunu konsola basıyoruz
            this.logger.warn(`🛡️ [2FA SİMÜLASYON] Kime: ${payload.email}`);
            this.logger.warn(`🔑 [KOD BURADA]: ${payload.code}`); // <-- EKLENDİ

            await this.simulateSendEmail(
              payload.email,
              `Güvenlik Kodunuz (3 dakika geçerlidir): ${payload.code}`
            );
          } 
          
          else if (event.type === 'SEND_INVITATION_EMAIL') { 
            // GELİŞTİRME LOGU: Davet Linki
            this.logger.warn(`🤝 [DAVET SİMÜLASYON] Kime: ${payload.email}`);
            this.logger.warn(`🔗 [DAVET LİNKİ]: ${payload.inviteLink}`); // <-- EKLENDİ

            await this.simulateSendEmail(
              payload.email,
              `Sizi davet ettiler! Rolünüz: ${payload.role}. Kabul etmek için tıklayın: ${payload.inviteLink}`
            );
          }

          // Başarılı olursa durumu COMPLETED yap
          event.status = OutboxStatus.COMPLETED;
          event.processed_at = new Date(); // İşlenme zamanını kaydet
          this.logger.log(`İşlem BAŞARILI: [${event.type}] - ID: ${event.id}`);

        } catch (error: any) {
          // C. HATA YÖNETİMİ (RETRY)
          const currentRetries = event.retry_count || 0;
          
          if (currentRetries >= 3) {
            event.status = OutboxStatus.FAILED;
            event.last_error = error.message;
            this.logger.error(`İşlem BAŞARISIZ (Kalıcı): [${event.type}] - Sebep: ${error.message}`);
          } else {
            event.status = OutboxStatus.PENDING;
            event.retry_count = currentRetries + 1;
            event.last_error = error.message;
            this.logger.warn(`İşlem Hatası (Tekrar denenecek): [${event.type}] - Deneme: ${event.retry_count}`);
          }
        }

        // Değişiklikleri kaydet (Transaction içinde)
        await queryRunner.manager.save(event);
      }

      // 4. TRANSACTION'I ONAYLA
      await queryRunner.commitTransaction();

    } catch (error: any) {
      this.logger.error('Outbox Worker genel bir hata ile karşılaştı:', error);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  // --- SİMÜLASYON METODU ---
  private async simulateSendEmail(email: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const isEmailServiceDown = Math.random() < 0.1; // %10 hata ihtimali
        
        if (isEmailServiceDown) {
          reject(new Error('SMTP Sunucusuna bağlanılamadı (Timeout)'));
        } else {
          // Log çıktısını temiz tutalım, detaylar yukarıda warn ile basıldı zaten
          this.logger.debug(`[SMTP] Mail gönderildi -> ${email}`);
          resolve();
        }
      }, Math.floor(Math.random() * 1000) + 500);
    });
  }
}