// src/tenants/tenants.service.ts
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto'; // <-- DTO Eklendi
import { TenantEntity } from './entities/tenant.entity';
import { SubscriptionEntity, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { PlanEntity } from '../subscriptions/entities/plan.entity';
import { MembershipEntity, TenantRole } from '../memberships/entities/membership.entity';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class TenantsService {
  constructor(private dataSource: DataSource) {}

  async createCompany(createTenantDto: CreateTenantDto, user: UserEntity) {
    const { company_name, slug, plan_id, tax_id, billing_address } = createTenantDto;

    // 1. Transaction Başlat (Her şey ya hep ya hiç)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Slug Kontrolü
      const existingTenant = await queryRunner.manager.findOne(TenantEntity, { where: { slug } });
      if (existingTenant) {
        throw new ConflictException('Bu şirket URL adresi (slug) zaten kullanımda.');
      }

      // 3. Plan Kontrolü
      const plan = await queryRunner.manager.findOne(PlanEntity, { where: { id: plan_id } });
      if (!plan) {
        throw new BadRequestException('Seçilen paket bulunamadı.');
      }

      // 4. MOCK ÖDEME SİMÜLASYONU
      // Gerçek hayatta burada Stripe/Paddle servisine gidip "Charge" işlemi yaparız.
      const isPaymentSuccessful = this.mockPaymentGateway(plan.id); 
      if (!isPaymentSuccessful) {
        throw new BadRequestException('Ödeme işlemi başarısız oldu.');
      }

      // 5. Tenant Oluşturma
      const tenant = new TenantEntity();
      tenant.name = company_name;
      tenant.slug = slug;
      tenant.owner_id = user.id;
      // Geleceğe dönük vergi ve adres bilgilerini settings JSON içinde tutabiliriz
      tenant.settings = {
        tax_id,
        billing_address,
        onboarding_completed: true
      };
      
      const savedTenant = await queryRunner.manager.save(TenantEntity, tenant);

      // 6. Abonelik (Subscription) Oluşturma
      const subscription = new SubscriptionEntity();
      subscription.tenant = savedTenant;
      subscription.plan = plan;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Günlük
      await queryRunner.manager.save(SubscriptionEntity, subscription);

      // 7. Kullanıcıyı OWNER Olarak Ekler (Membership)
      const membership = new MembershipEntity();
      membership.user = user;
      membership.tenant = savedTenant;
      membership.role = TenantRole.OWNER;
      membership.is_accepted = true; // Kurucu olduğu için davet gerekmez
      await queryRunner.manager.save(MembershipEntity, membership);

      // 8. Transaction Commit
      await queryRunner.commitTransaction();

      return {
        message: 'Şirket ve abonelik başarıyla oluşturuldu.',
        tenant_id: savedTenant.id,
        slug: savedTenant.slug
      };

    } catch (err) {
      // Hata durumunda yapılan her şeyi geri al
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // --- YENİ EKLENEN UPDATE METODU ---
  async update(id: string, updateTenantDto: UpdateTenantDto) {
    // Sadece izin verilen alanları güncelle (Slug değişmemeli mesela, linkler kırılır)
    const { company_name, billing_address, tax_id, tax_office } = updateTenantDto;

    // Repository'yi dataSource üzerinden alıyoruz
    const tenantRepository = this.dataSource.getRepository(TenantEntity);

    const tenant = await tenantRepository.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Şirket bulunamadı.');

    // Merge et
    tenant.name = company_name || tenant.name;
    // Settings içindeki verileri güncelle
    tenant.settings = {
        ...tenant.settings,
        billing_address: billing_address || tenant.settings['billing_address'],
        tax_id: tax_id || tenant.settings['tax_id'],
        tax_office: tax_office || tenant.settings['tax_office']
    };

    return tenantRepository.save(tenant);
  }
  // ----------------------------------

  // Ödeme Simülasyonu
  private mockPaymentGateway(planId: string): boolean {
    // Burada %100 başarılı dönüyoruz ama ilerde buraya mantık eklenebilir.
    return true; 
  }
}