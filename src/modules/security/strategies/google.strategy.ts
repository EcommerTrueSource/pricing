import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    private readonly logger = new Logger(GoogleStrategy.name);

    constructor() {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL:
                process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): Promise<any> {
        const { name, emails, photos } = profile;

        this.logger.log(`Usuário autenticado via Google: ${emails[0].value}`);

        const user = {
            email: emails[0].value,
            firstName: name.givenName,
            lastName: name.familyName,
            picture: photos[0].value,
            accessToken,
            // Por padrão, usuários do Google recebem a role USER
            // Isso pode ser modificado depois baseado em regras de negócio
            roles: ['USER'],
        };

        done(null, user);
    }
}
