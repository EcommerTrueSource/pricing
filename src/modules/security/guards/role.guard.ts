import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());

    this.logger.debug('Roles requeridas:', requiredRoles);

    if (!requiredRoles) {
      this.logger.debug('Nenhuma role requerida');
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    this.logger.debug('Usuário:', user);
    this.logger.debug('Roles do usuário:', user.roles);

    // Verifica se o usuário tem alguma das roles requeridas
    const hasRole = user.roles?.some((role) => requiredRoles.includes(role));
    this.logger.debug('Tem permissão?', hasRole);

    return hasRole;
  }
}
