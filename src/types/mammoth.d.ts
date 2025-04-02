declare module 'mammoth' {
    interface ConversionResult {
        value: string;
        messages: Array<{
            type: string;
            message: string;
        }>;
    }

    interface ConversionOptions {
        buffer: Buffer;
    }

    export function convertToHtml(options: ConversionOptions): Promise<ConversionResult>;
}
