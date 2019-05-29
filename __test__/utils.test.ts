import { isEmpty } from '../src/utils'

it('should work well', () => {
  interface fixture {
    in: any
    want: boolean
  }

  const f: fixture[] = [
    {
      in: '',
      want: true
    },
    {
      in: {},
      want: true
    },
    {
      in: [],
      want: true
    },
    {
      in: { a: 1 },
      want: false
    },
    {
      in: [1],
      want: false
    },
    {
      in: 'xsxs',
      want: false
    }
  ]

  f.forEach(ff => {
    expect(isEmpty(ff.in)).toBe(ff.want)
  })
})
