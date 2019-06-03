import { Iserializer } from './types'

export class JsonSerizlizer implements Iserializer {
  encode(data: any): string {
    return JSON.stringify(data)
  }

  decode(data: string): any {
    return JSON.parse(data)
  }
}

export class RawSerializer implements Iserializer {
  encode(data: string): string {
    return data
  }

  decode(data: string): string {
    return data
  }
}
