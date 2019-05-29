import * as debug from 'debug'

import { ICacheBackend, GetterFunc } from './types'
import { isEmpty } from './utils'

const debugCache = debug('cache')

export class CacheManager {
  private prefix: string
  private cacheBackend: ICacheBackend
  private getterFunc: GetterFunc
  private defaultExpires: number

  constructor(
    prefix: string,
    cacheBackend: ICacheBackend,
    getterFunc: GetterFunc,
    defaultExpires: number = 60
  ) {
    this.prefix = prefix
    this.cacheBackend = cacheBackend
    this.getterFunc = getterFunc
    this.defaultExpires = defaultExpires
  }

  async getWithCache(
    key: string,
    json: boolean = true,
    expires?: number,
    force?: boolean
  ): Promise<any> {
    const cacheKey = this.prefix + key

    if (!force) {
      const dataStr = await this.cacheBackend.get(cacheKey)
      if (dataStr) {
        if (!json) {
          debugCache(
            `string mode, return direct, key: ${key}, cacheKey: ${cacheKey}`,
            dataStr
          )
          return dataStr
        }
        try {
          const res = JSON.parse(dataStr)
          debugCache(`hit cache: key: ${key}, cacheKey: ${cacheKey}`, res)
          return res
        } catch (err) {
          console.warn(`bad json string: ${dataStr}`, err)
        }
      }
    } else {
      debugCache(`force get, ignore cache, key: ${key}, cacheKey: ${cacheKey}`)
    }

    const data = await this.getterFunc(key)

    if (data && !isEmpty(data)) {
      if (!json && typeof data !== 'string') {
        console.warn(
          `non json mode expect string data type but got ${typeof data}`
        )
      } else {
        await this.cacheBackend.set(
          cacheKey,
          json ? JSON.stringify(data) : data,
          expires || this.defaultExpires
        )
      }
    } else {
      debugCache(
        `empty data, cache ignore, key: ${key}, cacheKey: ${cacheKey}`,
        data
      )
    }

    return data
  }

  async delete(key: string) {
    const cacheKey = this.prefix + key
    debugCache(`delete cache, ${key}, cacheKey: ${cacheKey}`)
    await this.cacheBackend.delete(cacheKey)
  }
}
