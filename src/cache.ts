import * as debug from 'debug'

import { ICacheBackend, GetterFunc, Iserializer } from './types'
import { isEmpty, delay } from './utils'
import { JsonSerizlizer } from './serializer'

const debugCache = debug('cache')

/**
 * Options is construct params for CacheManager
 */
export interface Options {
  /**
   * prefix is cache key prefix for this CacheManager group
   */
  prefix: string
  /**
   * cacheBackend is cache backend for CacheManager
   */
  cacheBackend: ICacheBackend
  /**
   * getterFunc is origin data source we wrappered
   */
  getterFunc: GetterFunc
  /**
   * CacheManager use serializer in cache getter and setter,
   * encode: cache set,
   * decode: cache get,
   * default is JSON serializer
   */
  serializer?: Iserializer
  /**
   * defaultExpires is default expires second time for this CacheManager group
   * default is 60 s
   */
  defaultExpires?: number
  /**
   * singleFlight can protect origin data source be called multi times in a moment,
   * if enabled, default is true
   */
  singleFlight?: boolean
  /**
   * if missingOrEmptyExpires > 0 (enabled), CacheManager will cache the non exists or empty data from
   * origin data source, protected always request non exists data from origin data source,
   * default is 0 (disable)
   */
  missingOrEmptyExpires?: number
}

export class CacheManager {
  private options: Options
  private singleFlightQueue: Map<string, ((res: any) => void)[]>

  constructor({
    prefix,
    cacheBackend,
    getterFunc,
    defaultExpires = 60,
    singleFlight = true,
    serializer = new JsonSerizlizer(),
    missingOrEmptyExpires = 0
  }: Options) {
    this.options = {
      prefix,
      cacheBackend,
      getterFunc,
      defaultExpires,
      singleFlight,
      serializer,
      missingOrEmptyExpires
    }
    this.singleFlightQueue = new Map<string, ((res: any) => void)[]>()
  }

  async getWithCache(
    key: string,
    expires?: number,
    force?: boolean,
    serializer?: Iserializer
  ): Promise<any> {
    const cacheKey = this.options.prefix + key

    if (!force) {
      const dataStr = await this.options.cacheBackend.get(cacheKey)
      if (dataStr) {
        try {
          const res = serializer
            ? serializer.decode(dataStr)
            : this.options.serializer.decode(dataStr)
          debugCache(`hit cache: key: ${key}, cacheKey: ${cacheKey}`, res)
          return res
        } catch (err) {
          console.warn(`bad json string: ${dataStr}`, err)
        }
      }
    } else {
      debugCache(`force get, ignore cache, key: ${key}, cacheKey: ${cacheKey}`)
    }

    // single flight
    if (this.options.singleFlight) {
      const promise = new Promise(resolve => {
        const queue: ((res: any) => void)[] = this.singleFlightQueue.has(
          cacheKey
        )
          ? this.singleFlightQueue.get(cacheKey)
          : []
        queue.push(resolve)
        debugCache(
          `singleFlight add request to queue, key: ${key}, cacheKey: ${cacheKey}`
        )
        this.singleFlightQueue.set(cacheKey, queue)
        if (queue.length === 1) {
          debugCache(
            `singleFlight get data from source, key: ${key}, cacheKey: ${cacheKey}`
          )
          this.callAndAddCache(key, cacheKey, expires, serializer).then(res => {
            debugCache(
              `singleFlight got data, resolve all promises, key: ${key}, cacheKey: ${cacheKey}`
            )
            this.singleFlightQueue
              .get(cacheKey)
              .forEach(resolve => resolve(res))
            this.singleFlightQueue.delete(cacheKey)
            debugCache(
              `singleFlight delete promise queue, key: ${key}, cacheKey: ${cacheKey}, mapSize: ${
                this.singleFlightQueue.size
              }`
            )
          })
        }
      })

      return promise
    }

    return this.callAndAddCache(key, cacheKey, expires, serializer)
  }

  private async callAndAddCache(
    key: string,
    cacheKey: string,
    expires?: number,
    serializer?: Iserializer
  ) {
    const data = await this.options.getterFunc(key)
    debugCache(`get data from data source, key: ${key}, cacheKey: ${cacheKey}`)
    if (data && !isEmpty(data)) {
      debugCache(`set cache, key: ${key}, cacheKey: ${cacheKey}`, data)
      await this.options.cacheBackend.set(
        cacheKey,
        serializer
          ? serializer.encode(data)
          : this.options.serializer.encode(data),
        expires || this.options.defaultExpires
      )
    } else {
      if (this.options.missingOrEmptyExpires > 0) {
        debugCache(
          `set missing or empty cache, key: ${key}, cacheKey: ${cacheKey}`,
          data
        )
        await this.options.cacheBackend.set(
          cacheKey,
          serializer
            ? serializer.encode(data)
            : this.options.serializer.encode(data),
          this.options.missingOrEmptyExpires
        )
      } else {
        debugCache(
          `empty data, cache ignore, key: ${key}, cacheKey: ${cacheKey}`,
          data
        )
      }
    }

    return data
  }

  async delete(key: string) {
    const cacheKey = this.options.prefix + key
    debugCache(`delete cache, ${key}, cacheKey: ${cacheKey}`)
    await this.options.cacheBackend.delete(cacheKey)
  }
}
