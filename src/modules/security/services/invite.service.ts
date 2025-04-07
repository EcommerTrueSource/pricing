import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateInviteDto } from '../dtos/create-invite.dto';
import { AcceptInviteDto } from '../dtos/accept-invite.dto';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class InviteService {
    private readonly logger = new Logger(InviteService.name);
    private readonly zapiBaseUrl: string;
    private readonly zapiInstanceId: string;
    private readonly zapiToken: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.zapiBaseUrl = this.configService.get<string>('ZAPI_BASE_URL');
        this.zapiInstanceId = this.configService.get<string>('ZAPI_INSTANCE_ID');
        this.zapiToken = this.configService.get<string>('ZAPI_TOKEN');
    }

    /**
     * Cria um novo convite para um usuário
     */
    async createInvite(createInviteDto: CreateInviteDto, adminId: string): Promise<any> {
        const { email, roles = ['USER'] } = createInviteDto;

        // Verifica se já existe um usuário com esse email
        const existingUser = await (this.prisma as any).users.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new ConflictException(`Já existe um usuário com o email ${email}`);
        }

        // Verifica se já existe um convite ativo para esse email
        const existingInvite = await (this.prisma as any).user_invites.findFirst({
            where: {
                email,
                accepted: false,
                expires_at: {
                    gt: new Date(),
                },
            },
        });

        if (existingInvite) {
            throw new ConflictException(`Já existe um convite ativo para ${email}`);
        }

        // Gera token único
        const token = uuidv4();

        // Define data de expiração (7 dias)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Cria o convite
        const invite = await (this.prisma as any).user_invites.create({
            data: {
                email,
                token,
                roles,
                expires_at: expiresAt,
                sent_by_id: adminId,
            },
        });

        this.logger.log(`Convite criado para ${email} com token ${token}`);

        // Verifica se temos um número de telefone associado a este email
        // (normalmente seria buscado da tabela de usuários ou do payload do convite)
        const phoneNumber = await this.findPhoneNumberForEmail(email);

        if (phoneNumber) {
            await this.sendInviteViaWhatsApp(phoneNumber, token, expiresAt);
        } else {
            this.logger.warn(
                `Não foi possível enviar convite via WhatsApp para ${email}: número de telefone não encontrado`,
            );
        }

        return {
            id: invite.id,
            email: invite.email,
            token: invite.token,
            expiresAt: invite.expires_at,
        };
    }

    /**
     * Obtém todos os convites ativos
     */
    async findAllInvites() {
        return (this.prisma as any).user_invites.findMany({
            where: {
                accepted: false,
                expires_at: {
                    gt: new Date(),
                },
            },
            include: {
                sent_by: {
                    select: {
                        id: true,
                        email: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
            orderBy: {
                created_at: 'desc',
            },
        });
    }

    /**
     * Verifica se um convite é válido
     */
    async validateInvite(token: string) {
        const invite = await (this.prisma as any).user_invites.findUnique({
            where: { token },
        });

        if (!invite) {
            throw new NotFoundException('Convite não encontrado');
        }

        if (invite.accepted) {
            throw new BadRequestException('Este convite já foi aceito');
        }

        if (invite.expires_at < new Date()) {
            throw new BadRequestException('Este convite expirou');
        }

        return {
            email: invite.email,
            roles: invite.roles,
            expiresAt: invite.expires_at,
        };
    }

    /**
     * Aceita um convite e cria um novo usuário
     */
    async acceptInvite(acceptInviteDto: AcceptInviteDto) {
        const { token, firstName, lastName, password } = acceptInviteDto;

        // Valida o convite
        const invite = await (this.prisma as any).user_invites.findUnique({
            where: { token },
        });

        if (!invite) {
            throw new NotFoundException('Convite não encontrado');
        }

        if (invite.accepted) {
            throw new BadRequestException('Este convite já foi aceito');
        }

        if (invite.expires_at < new Date()) {
            throw new BadRequestException('Este convite expirou');
        }

        // Hash da senha
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Criação de transação para garantir a atomicidade
        return this.prisma.$transaction(async (prisma) => {
            // Cria o usuário
            const newUser = await (prisma as any).users.create({
                data: {
                    email: invite.email,
                    password_hash: passwordHash,
                    first_name: firstName,
                    last_name: lastName,
                    roles: invite.roles,
                    provider: 'local',
                },
            });

            // Marca o convite como aceito
            await (prisma as any).user_invites.update({
                where: { id: invite.id },
                data: {
                    accepted: true,
                    accepted_at: new Date(),
                },
            });

            this.logger.log(`Convite aceito: usuário ${newUser.email} criado com sucesso`);

            return {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                roles: newUser.roles,
            };
        });
    }

    /**
     * Cancela (exclui) um convite
     */
    async cancelInvite(inviteId: string, adminId: string) {
        const invite = await (this.prisma as any).user_invites.findUnique({
            where: { id: inviteId },
        });

        if (!invite) {
            throw new NotFoundException('Convite não encontrado');
        }

        await (this.prisma as any).user_invites.delete({
            where: { id: inviteId },
        });

        this.logger.log(`Convite para ${invite.email} cancelado pelo administrador ${adminId}`);

        return { message: 'Convite cancelado com sucesso' };
    }

    /**
     * Busca um número de telefone associado a um email
     * Esta é uma função de exemplo que deve ser adaptada para buscar dados reais
     */
    private async findPhoneNumberForEmail(email: string): Promise<string | null> {
        try {
            // Buscar em sellers ou em outro local onde telefone esteja armazenado
            const seller = await (this.prisma as any).sellers.findFirst({
                where: { email },
                select: { telefone: true },
            });

            if (seller && seller.telefone) {
                // Formatar o telefone para o formato exigido pelo WhatsApp (apenas números)
                return seller.telefone.replace(/\D/g, '');
            }

            return null;
        } catch (error) {
            this.logger.error(`Erro ao buscar telefone para ${email}: ${error.message}`);
            return null;
        }
    }

    /**
     * Envia um convite via WhatsApp usando a Z-API
     */
    private async sendInviteViaWhatsApp(
        phoneNumber: string,
        token: string,
        expiresAt: Date,
    ): Promise<boolean> {
        try {
            // Formatação do número de telefone (adicionar 55 se necessário)
            const formattedNumber = phoneNumber.startsWith('55') ? phoneNumber : `55${phoneNumber}`;

            // Geração da URL de convite
            const baseUrl =
                this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';
            const inviteUrl = `${baseUrl}/auth/register?token=${token}`;

            // Formatação da data de expiração
            const expireDate = expiresAt.toLocaleDateString('pt-BR');

            // Mensagem do convite
            const message = `Olá! Você foi convidado para criar uma conta no sistema de gerenciamento de contratos da True Brands.

Para criar sua conta, acesse o link: ${inviteUrl}

Este convite expira em: ${expireDate}

Se você não solicitou este convite, por favor, ignore esta mensagem.`;

            // Enviar a mensagem via Z-API
            await lastValueFrom(
                this.httpService.post(
                    `${this.zapiBaseUrl}/instances/${this.zapiInstanceId}/token/${this.zapiToken}/send-text`,
                    {
                        phone: formattedNumber,
                        message: message,
                    },
                ),
            );

            this.logger.log(`Convite enviado com sucesso via WhatsApp para ${phoneNumber}`);
            return true;
        } catch (error) {
            this.logger.error(`Erro ao enviar convite via WhatsApp: ${error.message}`);
            return false;
        }
    }
}
