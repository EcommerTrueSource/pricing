import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    private readonly logger = new Logger(GoogleStrategy.name);

    constructor(private readonly configService: ConfigService) {
        const callbackUrl = configService.get<string>('GOOGLE_CALLBACK_URL');
        const clientId = configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');

        if (!callbackUrl || !clientId || !clientSecret) {
            throw new Error('Configurações do Google OAuth não encontradas');
        }

        super({
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: callbackUrl,
            scope: ['email', 'profile'],
        });

        this.logger.log(
            `Google OAuth configurado com callback URL: ${this.hideCredentialsInUrl(callbackUrl)}`,
        );
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): Promise<any> {
        try {
            const { name, emails, photos } = profile;

            this.logger.debug('Processando autenticação Google', {
                email: emails[0].value,
                name: `${name.givenName} ${name.familyName}`,
            });

            const user = {
                email: emails[0].value,
                firstName: name.givenName,
                lastName: name.familyName,
                picture: photos[0].value,
                accessToken,
                roles: ['USER'],
            };

            this.logger.log(`Usuário autenticado via Google: ${user.email}`);
            done(null, user);
        } catch (error) {
            this.logger.error('Erro ao processar autenticação Google:', {
                error: error.message,
                stack: error.stack,
            });
            done(error, null);
        }
    }

    private hideCredentialsInUrl(url: string): string {
        if (!url) return 'URL não definida';
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        } catch (e) {
            this.logger.warn('URL de callback inválida:', e.message);
            return 'URL inválida';
        }
    }
}
