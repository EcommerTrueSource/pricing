import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateInviteDto {
    @ApiProperty({
        description: 'Email do usuário a ser convidado',
        example: 'novo.usuario@empresa.com.br',
    })
    @IsEmail({}, { message: 'Email inválido' })
    email: string;

    @ApiProperty({
        description: 'Roles que serão atribuídas ao usuário',
        example: ['USER'],
        default: ['USER'],
        isArray: true,
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    roles?: string[];
}
