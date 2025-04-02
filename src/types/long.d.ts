declare module 'long' {
    export class Long {
        constructor(low: number, high: number, unsigned?: boolean);
        toString(): string;
        toNumber(): number;
        equals(other: Long): boolean;
    }
}
