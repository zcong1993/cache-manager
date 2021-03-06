import * as debug from 'debug'

import { ICacheBackend, GetterFunc, Iserializer } from './types'
import { isEmpty } from './utils'
import { JsonSerizlizer } from './serializer'

const debugCache = debug('cache')

export type ResolveFn = (res: any) => void

export interface Call {
  resolveFns: ResolveFn[]
  rejectFns: ResolveFn[]
}

/**
 * Options is construct params for CacheManager
 */
export interface Options {
  /**
   * cacheBackend is cache backend for CacheManager
   */
  cacheBackend: ICacheBackend
  /**
   * CacheManager use serializer in cache getter and setter,
   * encode: cache set,
   * decode: cache get,
   * default is JSON serializer
   */
  serializer?: Iserializer
  /**
   * expires is default expires second time for this CacheManager group
   * default is 60 s
   */
  expires?: number
  /**
   * if missingOrEmptyExpires > 0 (enabled), CacheManager will cache the non exists or empty data from
   * origin data source, protected always request non exists data from origin data source,
   * default is 0 (disable)
   */
  missingOrEmptyExpires?: number
}

export interface GetterOptions<T = any> {
  /**
   * prefix is cache key prefix for this CacheManager group
   */
  prefix: string
  /**
   * getterFunc is origin data source we wrappered
   */
  getterFunc: GetterFunc<T>
  /**
   * if force get data from backend
   */
  force?: boolean
  /**
   * cache expires in second
   */
  expires?: number
  /**
   * singleFlight can protect origin data source be called multi times in a moment,
   * if enabled, default is true
   */
  singleFlight?: boolean
  /**
   * CacheManager use serializer in cache getter and setter,
   * encode: cache set,
   * decode: cache get,
   * default is JSON serializer
   */
  serializer?: Iserializer
  missingOrEmptyExpires?: number
}

export interface Stats {
  hits: number
  misses: number
  queueMapSize: number
  errors: number
}

export class CacheManager {
  private options: Options
  private singleFlightQueue = new Map<string, Call>()
  private internalStats: Stats = {
    hits: 0,
    misses: 0,
    queueMapSize: 0,
    errors: 0
  }

  constructor({
    cacheBackend,
    expires = 60,
    serializer = new JsonSerizlizer(),
    missingOrEmptyExpires = 0
  }: Options) {
    this.options = {
      cacheBackend,
      expires,
      serializer,
      missingOrEmptyExpires
    }
  }

  async getWithCache<T = any>(key: string, options: GetterOptions): Promise<T> {
    const opts = {
      ...this.options,
      ...options
    }

    if (!opts.force) {
      opts.force = false
    }

    if (!opts.singleFlight) {
      opts.singleFlight = false
    }

    if (!opts.expires) {
      throw new Error('no expires')
    }

    const cacheKey = `${opts.prefix}:${key}`

    if (!opts.force) {
      const dataStr = await this.options.cacheBackend.get(cacheKey)
      if (dataStr) {
        try {
          const res = opts.serializer.decode(dataStr)
          debugCache(`hit cache: key: ${key}, cacheKey: ${cacheKey}`, res)
          this.internalStats.hits += 1
          return res
        } catch (err) {
          console.warn(`bad json string: ${dataStr}`, err)
        }
      }
    } else {
      debugCache(`force get, ignore cache, key: ${key}, cacheKey: ${cacheKey}`)
    }

    // single flight
    if (opts.singleFlight) {
      const promise = new Promise((resolve, reject) => {
        const call: Call = this.singleFlightQueue.get(cacheKey) || {
          resolveFns: [],
          rejectFns: []
        }

        this.internalStats.queueMapSize = this.singleFlightQueue.size
        call.resolveFns.push(resolve)
        call.rejectFns.push(reject)
        debugCache(
          `singleFlight add request to queue, key: ${key}, cacheKey: ${cacheKey}`
        )
        this.singleFlightQueue.set(cacheKey, call)
        if (call.resolveFns.length === 1) {
          debugCache(
            `singleFlight get data from source, key: ${key}, cacheKey: ${cacheKey}`
          )
          this.callAndAddCache(key, cacheKey, opts)
            .then(res => {
              debugCache(
                `singleFlight got data, resolve all promises, key: ${key}, cacheKey: ${cacheKey}`
              )
              const waitCall = this.singleFlightQueue.get(cacheKey)
              waitCall.resolveFns.forEach(resolve => resolve(res))
              this.internalStats.hits += waitCall.resolveFns.length - 1
              this.singleFlightQueue.delete(cacheKey)
              this.internalStats.queueMapSize = this.singleFlightQueue.size
              debugCache(
                `singleFlight delete promise queue, key: ${key}, cacheKey: ${cacheKey}, mapSize: ${
                  this.singleFlightQueue.size
                }`
              )
            })
            .catch(err => {
              debugCache(
                `singleFlight got error, reject all promises, key: ${key}, cacheKey: ${cacheKey}, error: ${
                  err.message
                }`
              )
              const waitCall = this.singleFlightQueue.get(cacheKey)
              waitCall.rejectFns.forEach(reject => reject(err))
              this.internalStats.errors += waitCall.rejectFns.length
              this.singleFlightQueue.delete(cacheKey)
              this.internalStats.queueMapSize = this.singleFlightQueue.size
              debugCache(
                `singleFlight delete promise queue, key: ${key}, cacheKey: ${cacheKey}, mapSize: ${
                  this.singleFlightQueue.size
                }`
              )
            })
        }
      })

      return promise as Promise<T>
    }

    return this.callAndAddCache<T>(key, cacheKey, opts).catch(err => {
      debugCache(
        `got error, key: ${key}, cacheKey: ${cacheKey}, error: ${err.message}`
      )
      this.internalStats.errors += 1
      throw err
    })
  }

  async delete(key: string, prefix: string) {
    const cacheKey = `${prefix}:${key}`
    debugCache(`delete cache, ${key}, cacheKey: ${cacheKey}`)
    await this.options.cacheBackend.delete(cacheKey)
  }

  get stats(): Stats {
    return this.internalStats
  }

  private async callAndAddCache<T = any>(
    key: string,
    cacheKey: string,
    opt: GetterOptions<T>
  ): Promise<T> {
    const data = await opt.getterFunc(key)
    debugCache(`get data from data source, key: ${key}, cacheKey: ${cacheKey}`)
    this.internalStats.misses += 1
    if (data && !isEmpty(data)) {
      debugCache(
        `set cache, key: ${key}, cacheKey: ${cacheKey}, expire: ${opt.expires}`,
        data
      )
      await this.options.cacheBackend.set(
        cacheKey,
        opt.serializer.encode(data),
        opt.expires
      )
    } else {
      if (opt.missingOrEmptyExpires > 0) {
        debugCache(
          `set missing or empty cache, key: ${key}, cacheKey: ${cacheKey}, expire: ${
            opt.missingOrEmptyExpires
          }`,
          data
        )
        await this.options.cacheBackend.set(
          cacheKey,
          opt.serializer.encode(data),
          opt.missingOrEmptyExpires
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
}
