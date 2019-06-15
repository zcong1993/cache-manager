import * as Redis from 'ioredis'
import { CacheManager } from '../src/cache'
import { RedisBackend } from '../src/backend'
import { delay } from '../src/utils'

const redis = new Redis()

afterEach(async () => {
  await redis.flushdb()
})

it('should work well', async () => {
  const prefix = '__TEST'
  const key = 'test'
  const data = { name: 'test' }
  const mockFn = jest.fn().mockResolvedValue(data)
  const cm = new CacheManager({
    prefix,
    cacheBackend: new RedisBackend(),
    defaultExpires: 1,
    singleFlight: false,
    getterFunc: mockFn
  })

  for (let i = 0; i < 10; i++) {
    const val = await cm.getWithCache(key)
    expect(val).toEqual(data)
  }

  expect(await redis.get(prefix + key)).not.toBeNull()
  expect(mockFn).toBeCalledTimes(1)

  // expired
  await delay(1000)

  expect(await redis.get(prefix + key)).toBeNull()
  for (let i = 0; i < 10; i++) {
    const val = await cm.getWithCache(key)
    expect(val).toEqual(data)
  }

  expect(await redis.get(prefix + key)).not.toBeNull()
  expect(mockFn).toBeCalledTimes(2)

  // force
  const val = await cm.getWithCache(key, 1, true)
  expect(val).toEqual(data)
  expect(mockFn).toBeCalledTimes(3)

  await delay(1000)

  // singleflight false
  await Promise.all(
    Array(10)
      .fill(null)
      .map(_ => {
        return cm.getWithCache(key).then(val => expect(val).toEqual(data))
      })
  )
  expect(mockFn).toBeCalledTimes(13)
})

it('singleflight should work well', async () => {
  const prefix = '__TEST'
  const key = 'test'
  const data = { name: 'test' }
  const mockFn = jest.fn().mockResolvedValue(data)
  const cm = new CacheManager({
    prefix,
    cacheBackend: new RedisBackend(),
    defaultExpires: 1,
    singleFlight: true,
    getterFunc: mockFn
  })

  // singleflight true
  await Promise.all(
    Array(10)
      .fill(null)
      .map(_ => {
        return cm.getWithCache(key).then(val => expect(val).toEqual(data))
      })
  )
  expect(mockFn).toBeCalledTimes(1)
})
