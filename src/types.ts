export interface ICacheBackend {
  set(key: string, data: string, expire: number): void
  get(key: string): Promise<any>
  delete(key: string): void
}

export interface Iserializer {
  encode(data: any): string
  decode(data: string): any
}

export type GetterFunc<T = any> = (key: string) => T | Promise<T>
