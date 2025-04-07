import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(LocalStrategy.name);

    constructor(private readonly authService: AuthService) {
        super({
            usernameField: 'email',
            passwordField: 'password',
        });
    }

    async validate(email: string, password: string): Promise<any> {
        this.logger.debug(`Tentativa de login para usuário: ${email}`);

        const user = await this.authService.validateUser(email, password);

        if (!user) {
            this.logger.warn(`Login falhou para usuário: ${email}`);
            throw new UnauthorizedException('Credenciais inválidas');
        }

        this.logger.log(`Login bem-sucedido para usuário: ${email}`);
        return user;
    }
}
