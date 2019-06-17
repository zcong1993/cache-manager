import * as Redis from 'ioredis'
import { CacheManager } from '../src/cache'
import { RedisBackend } from '../src/backend'
import { delay } from '../src/utils'

const redis = new Redis()

afterEach(async () => {
  await redis.flushdb()
})

it('should work well', async () => {
  const prefix = 'TEST'
  const key = 'test'
  const data = { name: 'test' }
  const mockFn = jest.fn().mockResolvedValue(data)
  const cm = new CacheManager({
    cacheBackend: new RedisBackend(redis),
    defaultExpires: 1
  })

  const getterOpts = {
    prefix,
    getterFunc: mockFn
  }

  for (let i = 0; i < 10; i++) {
    const val = await cm.getWithCache(key, getterOpts)
    expect(val).toEqual(data)
  }

  expect(await redis.get(`${prefix}:${key}`)).not.toBeNull()
  expect(mockFn).toBeCalledTimes(1)
  expect(cm.stats).toEqual({ hits: 9, misses: 1, queueMapSize: 0 })

  // expired
  await delay(1000)

  expect(await redis.get(prefix + key)).toBeNull()
  for (let i = 0; i < 10; i++) {
    const val = await cm.getWithCache(key, getterOpts)
    expect(val).toEqual(data)
  }

  expect(await redis.get(`${prefix}:${key}`)).not.toBeNull()
  expect(mockFn).toBeCalledTimes(2)
  expect(cm.stats).toEqual({ hits: 18, misses: 2, queueMapSize: 0 })

  // force
  const val = await cm.getWithCache(key, { ...getterOpts, force: true })
  expect(val).toEqual(data)
  expect(mockFn).toBeCalledTimes(3)
  expect(cm.stats).toEqual({ hits: 18, misses: 3, queueMapSize: 0 })

  await delay(1000)

  // singleflight false
  await Promise.all(
    Array(10)
      .fill(null)
      .map(_ => {
        return cm
          .getWithCache(key, getterOpts)
          .then(val => expect(val).toEqual(data))
      })
  )
  expect(mockFn).toBeCalledTimes(13)
  expect(cm.stats).toEqual({ hits: 18, misses: 13, queueMapSize: 0 })
})

it('singleflight should work well', async () => {
  const prefix = 'TEST:'
  const key = 'test'
  const data = { name: 'test' }
  const mockFn = jest.fn().mockResolvedValue(data)
  const cm = new CacheManager({
    cacheBackend: new RedisBackend(redis),
    defaultExpires: 1
  })

  // singleflight true
  await Promise.all(
    Array(10)
      .fill(null)
      .map(_ => {
        return cm
          .getWithCache(key, {
            prefix,
            getterFunc: mockFn,
            singleFlight: true
          })
          .then(val => expect(val).toEqual(data))
      })
  )
  expect(mockFn).toBeCalledTimes(1)
  // singlefilght and no OOM
  expect(cm.stats).toEqual({ hits: 9, misses: 1, queueMapSize: 0 })
})
