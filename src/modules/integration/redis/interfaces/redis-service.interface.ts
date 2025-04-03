export interface IRedisService {
    set(key: string, value: string, ttl?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<void>;
    lpush(key: string, value: string): Promise<void>;
    rpop(key: string): Promise<string | null>;
    exists(key: string): Promise<boolean>;
    llen(key: string): Promise<number>;
}
