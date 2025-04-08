import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { AuthService } from './services/auth.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { InviteService } from './services/invite.service';
import { InviteController } from './controllers/invite.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Logger } from '@nestjs/common';

@Module({
    imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const secret = configService.get<string>('JWT_SECRET');
                if (!secret) {
                    const logger = new Logger('SecurityModule');
                    logger.warn(
                        'JWT_SECRET não configurado. Usando chave padrão para desenvolvimento.',
                    );
                }
                return {
                    secret: secret || 'your-secret-key',
                    signOptions: {
                        expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1d',
                    },
                };
            },
            inject: [ConfigService],
        }),
        ThrottlerModule.forRoot([
            {
                name: 'short',
                ttl: 60000,
                limit: 10,
            },
            {
                name: 'medium',
                ttl: 300000,
                limit: 100,
            },
        ]),
        HttpModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                timeout: configService.get<number>('HTTP_TIMEOUT') || 5000,
                maxRedirects: configService.get<number>('HTTP_MAX_REDIRECTS') || 5,
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController, InviteController],
    providers: [
        {
            provide: 'APP_GUARD',
            useClass: AuthGuard,
        },
        AuthService,
        InviteService,
        JwtStrategy,
        GoogleStrategy,
        LocalStrategy,
        RoleGuard,
        PrismaService,
        {
            provide: Logger,
            useValue: new Logger('SecurityModule'),
        },
    ],
    exports: [AuthService, InviteService, JwtStrategy, GoogleStrategy, LocalStrategy],
})
export class SecurityModule {}
