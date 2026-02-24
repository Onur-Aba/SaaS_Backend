import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, AccountStatus } from '../../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Payload: { sub: 'uuid', email: '...', family: '...', activeTenantId?: '...', activeHierarchy?: '...', activeProfession?: '...' }
    
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'username', 'account_status'],
    });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı.');
    }

    if (user.account_status === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException('Hesabınız askıya alınmıştır.');
    }

    // --- DEĞİŞİKLİK BURADA ---
    return { 
        ...user, 
        activeTenantId: payload.activeTenantId || null,
        activeHierarchy: payload.activeHierarchy || null,   // <-- YENİ
        activeProfession: payload.activeProfession || null,  // <-- YENİ
        tokenFamily: payload.family // <-- YENİ: Gerçek oturumu bulmak için JWT'deki family değerini alıyoruz
    }; 
  }
}