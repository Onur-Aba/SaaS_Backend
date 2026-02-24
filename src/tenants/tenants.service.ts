// src/tenants/tenants.service.ts
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantEntity } from './entities/tenant.entity';
import { SubscriptionEntity, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { PlanEntity } from '../subscriptions/entities/plan.entity';
import { MembershipEntity } from '../memberships/entities/membership.entity';
import { UserEntity } from '../users/entities/user.entity';
import { HierarchyLevel, Profession } from '../common/enums/roles.enum';

@Injectable()
export class TenantsService {
  constructor(private dataSource: DataSource) {}

  async createCompany(createTenantDto: CreateTenantDto, user: UserEntity) {
    const { company_name, slug, plan_id, tax_id, billing_address } = createTenantDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingTenant = await queryRunner.manager.findOne(TenantEntity, { where: { slug } });
      if (existingTenant) {
        throw new ConflictException('Bu şirket URL adresi (slug) zaten kullanımda.');
      }

      const plan = await queryRunner.manager.findOne(PlanEntity, { where: { id: plan_id } });
      if (!plan) {
        throw new BadRequestException('Seçilen paket bulunamadı.');
      }

      const isPaymentSuccessful = this.mockPaymentGateway(plan.id); 
      if (!isPaymentSuccessful) {
        throw new BadRequestException('Ödeme işlemi başarısız oldu.');
      }

      const tenant = new TenantEntity();
      tenant.name = company_name;
      tenant.slug = slug;
      tenant.owner_id = user.id;
      tenant.settings = {
        tax_id,
        billing_address,
        onboarding_completed: true
      };
      
      const savedTenant = await queryRunner.manager.save(TenantEntity, tenant);

      const subscription = new SubscriptionEntity();
      subscription.tenant = savedTenant;
      subscription.plan = plan;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
      await queryRunner.manager.save(SubscriptionEntity, subscription);

      // 7. YENİ: Kullanıcıyı OWNER ve GENERAL_MANAGER olarak ekler
      const membership = new MembershipEntity();
      membership.user = user;
      membership.tenant = savedTenant;
      membership.hierarchy_level = HierarchyLevel.OWNER;
      membership.profession = Profession.GENERAL_MANAGER;
      membership.is_accepted = true; 
      await queryRunner.manager.save(MembershipEntity, membership);

      await queryRunner.commitTransaction();

      return {
        message: 'Şirket ve abonelik başarıyla oluşturuldu.',
        tenant_id: savedTenant.id,
        slug: savedTenant.slug
      };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    const { company_name, billing_address, tax_id, tax_office } = updateTenantDto;

    const tenantRepository = this.dataSource.getRepository(TenantEntity);

    const tenant = await tenantRepository.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Şirket bulunamadı.');

    tenant.name = company_name || tenant.name;
    tenant.settings = {
        ...tenant.settings,
        billing_address: billing_address || tenant.settings['billing_address'],
        tax_id: tax_id || tenant.settings['tax_id'],
        tax_office: tax_office || tenant.settings['tax_office']
    };

    return tenantRepository.save(tenant);
  }

  private mockPaymentGateway(planId: string): boolean {
    return true; 
  }
  // Şirkete ait tüm üyeleri ve e-posta adreslerini (user ilişkisi ile) getirir
  async getTenantMembers(tenantId: string) {
    return this.dataSource.getRepository(MembershipEntity).find({
      where: { tenant_id: tenantId },
      relations: ['user'], // E-posta ve profil detaylarını çekmek için
    });
  }
}