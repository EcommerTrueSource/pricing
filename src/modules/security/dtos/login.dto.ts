import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'Email do usuário',
        example: 'admin@example.com',
    })
    @IsString()
    email: string;

    @ApiProperty({
        description: 'Senha do usuário',
        example: 'senha123',
    })
    @IsString()
    password: string;
}
