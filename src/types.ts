export interface ICacheBackend {
  set(key: string, data: string, expire: number): void
  get(key: string): Promise<any>
  delete(key: string): void
}

export interface Iserializer<T = any, U = string> {
  encode(data: T): U
  decode(data: U): T
}

export type GetterFunc = (key: string) => any
