import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RecaptchaGuard implements CanActivate {
  private readonly logger = new Logger(RecaptchaGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { recaptchaToken } = request.body;
    
    // IP Adresini al
    const clientIp = request.headers['x-forwarded-for'] || request.socket.remoteAddress;

    // 1. TEST ORTAMI BYPASS
    const isDev = this.configService.get('NODE_ENV') === 'development';
    if (isDev && recaptchaToken === 'TEST_TOKEN') {
      this.logger.debug('Test ortamı için Recaptcha bypass edildi.');
      return true;
    }

    // 2. TOKEN YOKSA FRONTEND'İ TETİKLE
    // Frontend ilk isteği tokensiz atar. Eğer token yoksa, özel bir kod ile reddederiz.
    // Frontend bu kodu (CAPTCHA_REQUIRED) görünce görünmez captcha'yı çalıştırır.
    if (!recaptchaToken) {
      throw new ForbiddenException({
        message: 'Şüpheli işlem algılandı. Lütfen güvenlik doğrulamasını tamamlayın.',
        code: 'CAPTCHA_REQUIRED'
      });
    }

    // 3. GOOGLE V2 DOĞRULAMASI
    const secretKey = this.configService.get('RECAPTCHA_SECRET_KEY');
    
    try {
      const response = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify`,
        null,
        {
          params: {
            secret: secretKey,
            response: recaptchaToken,
            remoteip: clientIp,
          },
        }
      );

      // v2 Invisible sürümünde 'score' ve 'action' yoktur. Sadece 'success' döner.
      const { success, "error-codes": errorCodes } = response.data;

      if (!success) {
        this.logger.warn(`Bot/VPN aktivitesi engellendi! IP: ${clientIp}, Hatalar: ${errorCodes || 'Bilinmiyor'}`);
        throw new ForbiddenException('Güvenlik doğrulaması başarısız. Lütfen tekrar deneyin.');
      }

      return true;
    } catch (error) {
      // Bizim fırlattığımız özel ForbiddenException (CAPTCHA_REQUIRED) hatalarını ezmemek için kontrol:
      if (error instanceof ForbiddenException) {
        throw error; 
      }
      this.logger.error('Recaptcha servisine ulaşılamadı:', error);
      throw new ForbiddenException('Güvenlik servisi şu an yanıt vermiyor.');
    }
  }
}