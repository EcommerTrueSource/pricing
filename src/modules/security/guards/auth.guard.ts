import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
    private readonly logger = new Logger(AuthGuard.name);

    constructor(private jwtService: JwtService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Tenta autenticar usando o Passport
        try {
            const result = await super.canActivate(context);
            if (result) {
                const request = context.switchToHttp().getRequest();
                this.logger.debug(`Autenticação bem-sucedida para usuário: ${request.user?.email}`);
                return true;
            }
        } catch (error) {
            this.logger.warn(`Falha na autenticação via Passport: ${error.message}`);
        }

        // Fallback para o método antigo para compatibilidade
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            this.logger.debug('Token não encontrado no header');
            return false;
        }

        try {
            const payload = await this.jwtService.verifyAsync(token);
            this.logger.debug('Token verificado com sucesso via método legado:', payload);

            // Define as roles padrão se não existirem
            if (!payload.roles) {
                payload.roles = ['ADMIN', 'MANAGER'];
            }

            request.user = payload;
            return true;
        } catch (error) {
            this.logger.error('Erro ao verificar token (legado):', error);
            return false;
        }
    }

    private extractTokenFromHeader(request: any): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
