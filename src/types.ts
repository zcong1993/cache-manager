export interface ICacheBackend {
  set(key: string, data: string, expire: number): void
  get(key: string): Promise<any>
  delete(key: string): void
}

export type GetterFunc = (key: string) => any
