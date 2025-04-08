import {
    Controller,
    Post,
    Body,
    Get,
    UseGuards,
    Req,
    Res,
    HttpStatus,
    Logger,
    UnauthorizedException,
    InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from '../dtos/login.dto';
import { AuthService } from '../services/auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../decorators/public.decorator';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {
        this.logger.log('AuthController inicializado');
    }

    @Post('login')
    @Public()
    @UseGuards(AuthGuard('local'))
    @ApiOperation({ summary: 'Realizar login com email e senha' })
    @ApiResponse({
        status: 200,
        description: 'Login realizado com sucesso',
        schema: {
            properties: {
                access_token: {
                    type: 'string',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                user: {
                    type: 'object',
                    properties: {
                        email: { type: 'string' },
                        roles: { type: 'array', items: { type: 'string' } },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        picture: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Credenciais inválidas',
    })
    async login(@Req() req, @Body() loginDto: LoginDto) {
        try {
            this.logger.debug(`Tentativa de login para usuário: ${loginDto.email}`);

            if (!req.user) {
                this.logger.warn(`Login falhou: usuário não autenticado - ${loginDto.email}`);
                throw new UnauthorizedException('Credenciais inválidas');
            }

            const result = await this.authService.login(req.user);
            this.logger.log(`Login bem-sucedido para usuário: ${loginDto.email}`);

            return result;
        } catch (error) {
            this.logger.error(`Erro no processo de login: ${error.message}`, error.stack);

            if (error instanceof UnauthorizedException) {
                throw error;
            }

            throw new InternalServerErrorException('Erro interno no servidor');
        }
    }

    @Get('google')
    @Public()
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Iniciar autenticação com Google' })
    async googleAuth() {
        this.logger.log('Iniciando autenticação com Google');
        // Este método não faz nada, apenas inicia o fluxo de autenticação do Google
        // O redirecionamento é tratado pelo Passport.js
    }

    @Get('google/callback')
    @Public()
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Callback para autenticação com Google' })
    async googleAuthCallback(@Req() req, @Res() res: Response) {
        this.logger.log('Recebido callback do Google Auth');

        try {
            // Processar o perfil recebido do Google
            const user = await this.authService.handleSocialLogin(req.user);

            // Gerar token JWT
            const authResult = await this.authService.login(user);

            // Redirecionar para a página principal com o token como query param
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
            res.redirect(`${frontendUrl}/auth/callback?token=${authResult.access_token}`);
        } catch (error) {
            this.logger.error(`Erro no callback do Google: ${error.message}`);
            res.status(HttpStatus.UNAUTHORIZED).json({
                message: 'Falha na autenticação',
            });
        }
    }

    @Get('dev-token')
    @UseGuards(AuthGuard('local'))
    @ApiOperation({
        summary: 'Gerar token JWT para desenvolvimento (requer autenticação)',
        description:
            'Este endpoint só está disponível em ambiente de desenvolvimento e requer autenticação válida.',
    })
    @ApiResponse({
        status: 200,
        description: 'Token gerado com sucesso',
        schema: {
            properties: {
                access_token: {
                    type: 'string',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                environment: {
                    type: 'string',
                    example: 'development',
                },
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Endpoint disponível apenas em ambiente de desenvolvimento',
    })
    async generateDevToken(@Req() req) {
        const currentEnv = this.configService.get<string>('NODE_ENV');

        if (currentEnv !== 'development') {
            this.logger.warn('Tentativa de acessar endpoint de desenvolvimento em produção');
            throw new UnauthorizedException(
                'Este endpoint só está disponível em ambiente de desenvolvimento',
            );
        }

        try {
            const token = await this.authService.login(req.user);
            this.logger.log(`Token de desenvolvimento gerado para usuário: ${req.user.email}`);

            return {
                ...token,
                environment: currentEnv,
                warning: 'Este token só deve ser usado em ambiente de desenvolvimento',
            };
        } catch (error) {
            this.logger.error(
                `Erro ao gerar token de desenvolvimento: ${error.message}`,
                error.stack,
            );
            throw new InternalServerErrorException('Erro ao gerar token de desenvolvimento');
        }
    }

    @Get('profile')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obter perfil do usuário autenticado' })
    @ApiResponse({
        status: 200,
        description: 'Perfil do usuário',
        schema: {
            properties: {
                email: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                picture: { type: 'string' },
            },
        },
    })
    async getProfile(@Req() req) {
        try {
            this.logger.debug(`Obtendo perfil do usuário: ${req.user.email}`);
            return req.user;
        } catch (error) {
            this.logger.error(`Erro ao obter perfil do usuário: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Erro ao obter perfil do usuário');
        }
    }
}
