import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
    private readonly logger = new Logger(AuthGuard.name);

    constructor(private jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            this.logger.debug('Token não encontrado no header');
            return false;
        }

        try {
            const payload = await this.jwtService.verifyAsync(token);
            this.logger.debug('Token verificado com sucesso:', payload);

            // Define as roles padrão se não existirem
            if (!payload.roles) {
                payload.roles = ['ADMIN', 'MANAGER'];
            }

            request.user = payload;
            return true;
        } catch (error) {
            this.logger.error('Erro ao verificar token:', error);
            return false;
        }
    }

    private extractTokenFromHeader(request: any): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
