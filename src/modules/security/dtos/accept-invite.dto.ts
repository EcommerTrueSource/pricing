import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class AcceptInviteDto {
    @ApiProperty({
        description: 'Token de convite recebido por email',
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({
        description: 'Nome do usuário',
        example: 'João',
    })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({
        description: 'Sobrenome do usuário',
        example: 'Silva',
    })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({
        description:
            'Senha do usuário (mínimo 8 caracteres, deve incluir letra maiúscula, minúscula, número e caractere especial)',
        example: 'Senha@123',
    })
    @IsString()
    @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
        message:
            'A senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial',
    })
    password: string;
}
