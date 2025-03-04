import {getBasenames, createMatrixObjects} from '../src/utils'

describe('getBasenames', () => {
  it('extracts the last path component from array', () => {
    const input = ['aws-cdk-apps/iam', 'services/auth', 'single-dir']
    const expected = ['iam', 'auth', 'single-dir']
    expect(getBasenames(input)).toEqual(expected)
  })

  it('extracts the last path component from single string', () => {
    expect(getBasenames('aws-cdk-apps/iam')).toEqual('iam')
  })

  it('handles empty array', () => {
    expect(getBasenames([])).toEqual([])
  })

  it('handles deep paths', () => {
    const input = 'very/deep/nested/path/component'
    expect(getBasenames(input)).toEqual('component')
  })
})

describe('createMatrixObjects', () => {
  it('creates matrix objects with directory and basename', () => {
    const input = ['aws-cdk-apps/iam', 'services/auth']
    const expected = [
      {directory: 'aws-cdk-apps/iam', basename: 'iam'},
      {directory: 'services/auth', basename: 'auth'}
    ]
    expect(createMatrixObjects(input)).toEqual(expected)
  })

  it('handles empty array', () => {
    expect(createMatrixObjects([])).toEqual([])
  })
})
