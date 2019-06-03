import { Iserializer } from './types'

export class JsonSerizlizer<T = any> implements Iserializer<T> {
  encode(data: T): string {
    return JSON.stringify(data)
  }

  decode(data: string): T {
    return JSON.parse(data) as T
  }
}

export class RawSerializer implements Iserializer<string> {
  encode(data: string): string {
    return data
  }

  decode(data: string): string {
    return data
  }
}
