import * as IORedis from 'ioredis'
import { ICacheBackend } from './types'

export class RedisBackend implements ICacheBackend {
  private redis: IORedis.Redis
  constructor(options?: IORedis.RedisOptions) {
    this.redis = new IORedis(options)
  }

  async set(key: string, data: string, expire: number) {
    await this.redis.set(key, data, 'EX', expire)
  }

  async get(key: string): Promise<any> {
    return this.redis.get(key)
  }

  async delete(key: string) {
    await this.redis.del(key)
  }
}
