import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(private readonly configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        });
        this.logger.log('JwtStrategy inicializada');
    }

    async validate(payload: any) {
        this.logger.debug(`Validando token JWT para usuário: ${payload.email}`);

        const user = {
            userId: payload.sub,
            email: payload.email,
            roles: payload.roles || ['USER'],
        };

        this.logger.debug('Token JWT validado com sucesso', { user });
        return user;
    }
}
