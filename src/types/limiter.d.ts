declare module 'limiter' {
    export class RateLimiter {
        constructor(options: { tokensPerInterval: number; interval: string });
        removeTokens(count: number): Promise<number>;
    }
}
