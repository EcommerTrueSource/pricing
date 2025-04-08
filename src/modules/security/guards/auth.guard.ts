import { Injectable, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
    private readonly logger = new Logger(AuthGuard.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private reflector: Reflector,
    ) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        return super.canActivate(context);
    }

    handleRequest<TUser = any>(
        err: any,
        user: any,
        _info: any,
        _context: ExecutionContext,
        _status?: any,
    ): TUser {
        if (err || !user) {
            throw err || new UnauthorizedException();
        }
        return user;
    }

    private async validateTokenLegacy(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            this.logger.debug('Token não encontrado no header');
            return false;
        }

        try {
            const payload = await this.jwtService.verifyAsync(token);
            this.logger.debug('Token verificado com sucesso via método legado');

            const currentEnv = this.configService.get<string>('NODE_ENV') || 'development';
            if (!this.validateTokenEnvironment(payload, currentEnv)) {
                return false;
            }

            this.setupUserRoles(payload);
            request.user = payload;
            return true;
        } catch (error) {
            this.logTokenError(error);
            return false;
        }
    }

    private validateTokenEnvironment(payload: any, currentEnv: string): boolean {
        if (payload.env && payload.env !== currentEnv) {
            this.logger.warn(`Tentativa de usar token de ${payload.env} em ${currentEnv}`, {
                tokenEnv: payload.env,
                currentEnv,
                userEmail: payload.email,
            });
            return false;
        }
        return true;
    }

    private setupUserRoles(payload: any): void {
        if (!payload.roles) {
            this.logger.debug('Definindo roles padrão para usuário sem roles definidas');
            payload.roles = ['USER'];
        }
    }

    private logTokenError(error: any): void {
        this.logger.error('Erro ao verificar token:', {
            error: error.message,
            stack: error.stack,
        });
    }

    private extractTokenFromHeader(request: any): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
