import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from '../dtos/login.dto';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
    constructor(private readonly jwtService: JwtService) {}

    @Post('login')
    @ApiOperation({ summary: 'Realizar login' })
    @ApiResponse({
        status: 200,
        description: 'Login realizado com sucesso',
        schema: {
            properties: {
                access_token: {
                    type: 'string',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
            },
        },
    })
    async login(@Body() loginDto: LoginDto) {
        // TODO: Implementar validação de usuário
        // Por enquanto, vamos gerar um token com role ADMIN para teste
        const payload = {
            email: loginDto.email,
            role: 'ADMIN',
        };

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
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
        const payload = {
            sub: '1',
            email: 'admin@truebrands.com.br',
            roles: ['ADMIN', 'MANAGER'],
        };

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }
}
