import {getBasenames} from '../src/utils'

describe('getBasenames', () => {
  it('extracts the last path component', () => {
    const input = ['aws-cdk-apps/iam', 'services/auth', 'single-dir']
    const expected = ['iam', 'auth', 'single-dir']
    expect(getBasenames(input)).toEqual(expected)
  })

  it('handles empty array', () => {
    expect(getBasenames([])).toEqual([])
  })

  it('handles deep paths', () => {
    const input = ['very/deep/nested/path/component']
    expect(getBasenames(input)).toEqual(['component'])
  })
})
