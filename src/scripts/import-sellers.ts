/* eslint-disable prettier/prettier */
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as process from 'process';
import { authenticate } from '@google-cloud/local-auth';
import { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import * as dotenv from 'dotenv';

// Carrega as variáveis do .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

// Se você modificar esses escopos, exclua o arquivo token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

function extractPhoneNumber(phone: string): string {
  // Remove todos os caracteres não numéricos
  const numbers = phone.replace(/[^\d]/g, '');

  // Se não tiver números, retorna o valor padrão
  if (!numbers) return '0000000000';

  // Se tiver mais de 11 dígitos, pega apenas os primeiros 11
  if (numbers.length > 11) {
    return numbers.slice(0, 11);
  }

  return numbers;
}

async function getSheetDataWithRetry(
  auth: OAuth2Client,
  spreadsheetId: string,
  sheetName: string,
): Promise<any[][]> {
  const sheets = google.sheets({ version: 'v4', auth });
  const range = `${sheetName}!A:D`; // Lê todas as linhas das colunas A até D

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      return response.data.values || [];
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`Tentativa ${attempt} falhou, aguardando 5 segundos...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Todas as tentativas falharam');
}

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content.toString());
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client: OAuth2Client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content.toString());
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize(): Promise<OAuth2Client> {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = (await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  })) as OAuth2Client;

  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

async function updatePhoneNumbers() {
  try {
    const auth = await authorize();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID não configurado no arquivo .env');
    }

    // Obtém os dados da planilha
    const sheetName = 'pag1';
    const sheetData = await getSheetDataWithRetry(auth, spreadsheetId, sheetName);

    if (!sheetData || sheetData.length === 0) {
      throw new Error('Nenhum dado encontrado na planilha');
    }

    // Remove o cabeçalho da planilha
    const dataWithoutHeader = sheetData.slice(1);
    console.log(`Total de linhas na planilha (sem cabeçalho): ${dataWithoutHeader.length}`);

    // Cria um mapa de CNPJ -> Telefone da planilha
    const cnpjPhoneMap = new Map<string, string>();
    for (const row of dataWithoutHeader) {
      const cnpj = row[0]?.replace(/[^\d]/g, '') || '';
      const phone = row[3] || ''; // Coluna D (índice 3)

      if (cnpj && phone) {
        cnpjPhoneMap.set(cnpj, phone);
      }
    }

    console.log(`Total de CNPJs com telefone na planilha: ${cnpjPhoneMap.size}`);

    // Obtém todos os CNPJs do banco
    const sellers = await prisma.sellers.findMany({
      select: {
        cnpj: true,
        telefone: true,
      },
    });

    console.log(`Total de CNPJs no banco: ${sellers.length}`);

    // Atualiza os telefones no banco
    let updatedCount = 0;
    let errorCount = 0;
    const now = new Date();
    const utcMinus3 = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    for (const seller of sellers) {
      try {
        const phone = cnpjPhoneMap.get(seller.cnpj);
        if (!phone) {
          console.log(`CNPJ ${seller.cnpj} não possui telefone na planilha`);
          continue;
        }

        const cleanPhone = extractPhoneNumber(phone);
        console.log(`Atualizando CNPJ: ${seller.cnpj}`);
        console.log(`Telefone atual: ${seller.telefone}`);
        console.log(`Novo telefone: ${cleanPhone}`);

        await prisma.sellers.update({
          where: { cnpj: seller.cnpj },
          data: {
            telefone: cleanPhone,
            updated_at: utcMinus3,
          },
        });

        updatedCount++;
        console.log(`Telefone atualizado com sucesso para CNPJ: ${seller.cnpj}`);
      } catch (error) {
        errorCount++;
        console.error(`Erro ao atualizar telefone do CNPJ ${seller.cnpj}:`, error);
      }
    }

    console.log('\nResumo da atualização:');
    console.log(`Total de CNPJs no banco: ${sellers.length}`);
    console.log(`Total de CNPJs com telefone na planilha: ${cnpjPhoneMap.size}`);
    console.log(`Telefones atualizados com sucesso: ${updatedCount}`);
    console.log(`Erros durante a atualização: ${errorCount}`);
    console.log(`Data/hora de atualização (UTC-3): ${utcMinus3.toISOString()}`);
  } catch (error) {
    console.error('Erro durante a atualização:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePhoneNumbers();
