import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../shared/services/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Valida as credenciais do usuário e retorna um token JWT
     */
    async validateUser(email: string, password: string): Promise<any> {
        try {
            // Busca o usuário no banco de dados
            const user = await (this.prisma as any).users.findUnique({
                where: { email },
            });

            // Se não encontrar ou usuário não estiver ativo
            if (!user || !user.active) {
                this.logger.warn(`Login falhou: usuário não encontrado ou inativo - ${email}`);
                this.logSecurityEvent('LOGIN_FAILED', {
                    email,
                    reason: 'user_not_found_or_inactive',
                });
                return null;
            }

            // Se for usuário de provedor externo (Google, etc.)
            if (user.provider !== 'local' || !user.password_hash) {
                this.logger.warn(
                    `Login falhou: usuário usa autenticação via ${user.provider} - ${email}`,
                );
                this.logSecurityEvent('LOGIN_FAILED', {
                    email,
                    reason: 'wrong_auth_provider',
                    provider: user.provider,
                });
                return null;
            }

            // Verifica a senha
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);

            if (!isPasswordValid) {
                this.logger.warn(`Login falhou: senha inválida para usuário ${email}`);
                this.logSecurityEvent('LOGIN_FAILED', { email, reason: 'invalid_password' });
                return null;
            }

            this.logSecurityEvent('LOGIN_SUCCESS', {
                userId: user.id,
                email: user.email,
                provider: 'local',
                roles: user.roles,
            });

            // Retorna dados do usuário sem a senha
            return {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                roles: user.roles,
                picture: user.picture,
            };
        } catch (error) {
            this.logger.error(`Erro ao validar usuário: ${error.message}`, error.stack);
            this.logSecurityEvent('LOGIN_ERROR', { email, error: error.message });
            return null;
        }
    }

    /**
     * Processa o login e gera um token JWT
     */
    async login(user: any) {
        const payload = {
            sub: user.id || user.userId || '1',
            email: user.email,
            roles: user.roles,
        };
        this.logger.log(`Gerando token JWT para usuário: ${user.email}`);

        const token = this.jwtService.sign(payload);
        this.logSecurityEvent('TOKEN_GENERATED', {
            userId: payload.sub,
            email: user.email,
            roles: user.roles,
        });

        return {
            access_token: token,
            user: {
                email: user.email,
                roles: user.roles,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                picture: user.picture || '',
            },
        };
    }

    /**
     * Processa o login social e cria/atualiza usuário
     */
    async handleSocialLogin(profile: any): Promise<any> {
        this.logger.log(`Processando login social para: ${profile.email}`);

        try {
            // Verifica se usuário já existe
            let user = await (this.prisma as any).users.findUnique({
                where: { email: profile.email },
            });

            if (user) {
                // Se o usuário existe mas está com provider diferente, atualiza
                if (user.provider !== 'google') {
                    this.logSecurityEvent('PROVIDER_CHANGE', {
                        userId: user.id,
                        email: user.email,
                        oldProvider: user.provider,
                        newProvider: 'google',
                    });

                    user = await (this.prisma as any).users.update({
                        where: { id: user.id },
                        data: {
                            provider: 'google',
                            provider_id: profile.email,
                            picture: profile.picture || user.picture,
                        },
                    });
                    this.logger.log(`Usuário ${user.email} atualizado para usar Google Auth`);
                }

                this.logSecurityEvent('SOCIAL_LOGIN_SUCCESS', {
                    userId: user.id,
                    email: user.email,
                    provider: 'google',
                });
            } else {
                // Se não existe, verificar se há um convite pendente para este email
                const invite = await (this.prisma as any).user_invites.findFirst({
                    where: {
                        email: profile.email,
                        accepted: false,
                        expires_at: { gt: new Date() },
                    },
                });

                // Se não tiver convite, rejeitar a criação automática
                if (!invite) {
                    this.logger.warn(
                        `Tentativa de login social rejeitada: ${profile.email} não possui convite`,
                    );
                    this.logSecurityEvent('SOCIAL_LOGIN_REJECTED', {
                        email: profile.email,
                        reason: 'no_invite',
                    });
                    throw new UnauthorizedException(
                        'Email não autorizado. Você precisa ser convidado para acessar o sistema.',
                    );
                }

                // Criar o usuário e marcar o convite como aceito
                user = await (this.prisma as any).users.create({
                    data: {
                        email: profile.email,
                        first_name: profile.firstName,
                        last_name: profile.lastName,
                        picture: profile.picture,
                        roles: invite.roles || ['USER'], // Usa as roles do convite ou USER como padrão
                        provider: 'google',
                        provider_id: profile.email,
                        active: true,
                    },
                });

                // Marcar o convite como aceito
                await (this.prisma as any).user_invites.update({
                    where: { id: invite.id },
                    data: {
                        accepted: true,
                        accepted_at: new Date(),
                    },
                });

                this.logger.log(
                    `Novo usuário ${user.email} criado via Google Auth a partir de convite`,
                );

                this.logSecurityEvent('USER_CREATED_FROM_INVITE', {
                    userId: user.id,
                    email: user.email,
                    provider: 'google',
                    roles: user.roles,
                    inviteId: invite.id,
                });
            }

            return {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                picture: user.picture,
                roles: user.roles,
            };
        } catch (error) {
            this.logger.error(`Erro ao processar login social: ${error.message}`, error.stack);
            this.logSecurityEvent('SOCIAL_LOGIN_ERROR', {
                email: profile.email,
                provider: 'google',
                error: error.message,
            });
            throw new UnauthorizedException(error.message || 'Erro ao processar login social');
        }
    }

    /**
     * Registra eventos de segurança importantes para auditoria
     * Esta função pode ser expandida para salvar os logs em um sistema dedicado
     */
    private logSecurityEvent(event: string, data: any): void {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                event,
                data,
                ip: 'N/A', // Em um cenário real, o IP seria capturado do request
            };

            this.logger.log(`[SECURITY_AUDIT] ${event}`, logEntry);

            // Aqui poderia ser adicionada lógica para salvar em banco de dados ou serviço externo
            // await this.prisma.security_logs.create({ data: logEntry });
        } catch (error) {
            this.logger.error(`Erro ao registrar evento de segurança: ${error.message}`);
        }
    }
}
