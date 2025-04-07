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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from '../dtos/login.dto';
import { AuthService } from '../services/auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(private readonly authService: AuthService) {}

    @Post('login')
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
    async login(@Req() req, @Body() loginDto: LoginDto) {
        this.logger.log(`Login via credenciais para: ${loginDto.email}`);
        return this.authService.login(req.user);
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Iniciar autenticação com Google' })
    async googleAuth() {
        // Este método não faz nada, apenas inicia o fluxo de autenticação do Google
        // O redirecionamento é tratado pelo Passport.js
    }

    @Get('google/callback')
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
            // Em produção, seria melhor usar um redirecionamento para uma página que armazena
            // o token em localStorage ou usar cookies HTTP-only
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
            res.redirect(`${frontendUrl}/auth/callback?token=${authResult.access_token}`);
        } catch (error) {
            this.logger.error(`Erro no callback do Google: ${error.message}`);
            res.status(HttpStatus.UNAUTHORIZED).json({
                message: 'Falha na autenticação',
            });
        }
    }

    @Get('token')
    @ApiOperation({ summary: 'Gerar token JWT para testes' })
    @ApiResponse({
        status: 200,
        description: 'Token gerado com sucesso',
        schema: {
            properties: {
                access_token: {
                    type: 'string',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
            },
        },
    })
    async generateToken() {
        const user = {
            id: '1',
            email: 'admin@truebrands.com.br',
            roles: ['ADMIN', 'MANAGER'],
        };

        return this.authService.login(user);
    }

    @Get('profile')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obter perfil do usuário autenticado' })
    getProfile(@Req() req) {
        return req.user;
    }
}
