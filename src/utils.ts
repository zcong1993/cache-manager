export const isEmpty = (d: any): boolean => {
  if (d === null || d === undefined) {
    return true
  }

  if (typeof d === 'string' && d === '') {
    return true
  }

  if (Array.isArray(d) && d.length === 0) {
    return true
  }

  if (typeof d === 'object') {
    return Object.entries(d).length === 0 && d.constructor === Object
  }

  return false
}

export const delay = (n: number) =>
  new Promise(resolve => setTimeout(resolve, n))
