import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { AuthController } from './controllers/auth.controller';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key',
            signOptions: { expiresIn: '1d' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthGuard, RoleGuard],
    exports: [JwtModule, AuthGuard, RoleGuard],
})
export class SecurityModule {}
