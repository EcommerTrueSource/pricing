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

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key',
            signOptions: { expiresIn: '1d' },
        }),
        ThrottlerModule.forRoot([
            {
                name: 'default',
                ttl: 60,
                limit: 10,
            },
        ]),
        HttpModule,
        ConfigModule,
    ],
    controllers: [AuthController, InviteController],
    providers: [
        AuthService,
        InviteService,
        JwtStrategy,
        GoogleStrategy,
        LocalStrategy,
        AuthGuard,
        RoleGuard,
        PrismaService,
        ConfigService,
    ],
    exports: [JwtModule, PassportModule, AuthService, InviteService, AuthGuard, RoleGuard],
})
export class SecurityModule {}
