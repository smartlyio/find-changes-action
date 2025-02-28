import * as path from 'path'
import {
  getBranchPoint,
  getChangedDirectories,
  containsFileFilter,
  isExcludedFilter,
  filterGitOutputByFile,
  getForceMatchChanges
} from '../src/find-changes'
import {Context} from '../src/context'

class FakeFsError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = message
  }
}

jest.mock('fs')
const {promises: fsMocked} = require('fs')
const {promises: fsReal} = jest.requireActual('fs')

const OLD_ENV = process.env
beforeEach(() => {
  process.env = {...OLD_ENV}
  fsMocked.stat.mockImplementation(async (path: string) => {
    return await fsReal.stat(path)
  })
  fsMocked.readFile.mockImplementation(async (path: string) => {
    return await fsReal.readFile(path)
  })
})

afterEach(() => {
  process.env = OLD_ENV
  jest.resetAllMocks()
})

describe('get branch point', () => {
  test('missing GITHUB_EVENT_NAME', async () => {
    delete process.env['GITHUB_EVENT_NAME']
    await expect(getBranchPoint()).rejects.toThrow(/only works on pull_request/)
  })

  test('wrong GITHUB_EVENT_NAME', async () => {
    process.env['GITHUB_EVENT_NAME'] = 'schedule'

    await expect(getBranchPoint()).rejects.toThrow(/only works on pull_request/)
  })

  test('missing GITHUB_EVENT_PATH', async () => {
    process.env['GITHUB_EVENT_NAME'] = 'pull_request'
    delete process.env['GITHUB_EVENT_PATH']
    await expect(getBranchPoint()).rejects.toThrow(
      /Could not find event payload/
    )
  })

  test('pull request event type closed', async () => {
    const eventPath = path.join(__dirname, 'pr_event_closed.json')
    const eventData = await fsReal.readFile(eventPath)
    const event = JSON.parse(eventData.toString())
    process.env['GITHUB_EVENT_NAME'] = 'pull_request'
    process.env['GITHUB_EVENT_PATH'] = eventPath

    await expect(getBranchPoint()).rejects.toThrow(
      /Running find-changes on: pull_request: closed is not supported in v2 - please migrate workflow to on: push:/
    )
  })

  test('get sha of main merged to PR', async () => {
    const eventPath = path.join(__dirname, 'pr_event.json')
    const eventData = await fsReal.readFile(eventPath)
    const event = JSON.parse(eventData.toString())
    process.env['GITHUB_EVENT_NAME'] = 'pull_request'
    process.env['GITHUB_EVENT_PATH'] = eventPath

    const branchPoint = await getBranchPoint()
    expect(branchPoint).toEqual('origin/master')
  })

  test('on push', async () => {
    const eventPath = path.join(__dirname, 'push_event.json')
    const eventData = await fsReal.readFile(eventPath)
    const event = JSON.parse(eventData.toString())
    process.env['GITHUB_EVENT_NAME'] = 'push'
    process.env['GITHUB_EVENT_PATH'] = eventPath

    const branchPoint = await getBranchPoint()
    expect(branchPoint).toEqual(event.before)
  })
})

describe('getChangedDirectories', () => {
  test('extract changed directories from git diff output', async () => {
    fsMocked.stat.mockReset()
    const gitOutput = `\
.github/actions/thing
.gitignore
package1/file
package2/file
package2/otherfile
nested/package/config.yml
nested/package/Dockerfile
deeply/nested/package/config.yml
deeply/nested/package/Dockerfile
deeply/nested/package/README
top-level-file
`
    const context: Context = {
      directoryContaining: null, // Not used by getChangedDirectories
      directoryLevels: null,
      exclude: /^\.github\/.*/, // Not used by getChangedDirectories
      forceAllPattern: null
    }
    const uniqueDirectories = await getChangedDirectories(gitOutput, context)
    const expected = new Set([
      'package1',
      'package2',
      'nested/package',
      'deeply/nested/package',
      '.github/actions' // Excluded later, not through getChangedDirectories
    ])
    expect(new Set(uniqueDirectories)).toEqual(expected)
  })

  test('extract changed directories of depth 1 from git diff output', async () => {
    fsMocked.stat.mockReset()
    const gitOutput = `\
.github/actions/thing
.gitignore
package1/file
package2/file
package2/otherfile
nested/package/config.yml
nested/package/Dockerfile
deeply/nested/package/config.yml
deeply/nested/package/Dockerfile
deeply/nested/package/README
top-level-file
`
    const context: Context = {
      directoryContaining: null,
      directoryLevels: 1,
      exclude: /^\.github\/.*/, // Not used by getChangedDirectories
      forceAllPattern: null
    }
    const uniqueDirectories = await getChangedDirectories(gitOutput, context)
    const expected = new Set([
      'package1',
      'package2',
      'nested',
      'deeply',
      '.github' // Excluded later, not through getChangedDirectories
    ])
    expect(new Set(uniqueDirectories)).toEqual(expected)
  })

  test('extract changed directories of depth 2 from git diff output', async () => {
    fsMocked.stat.mockReset()
    const gitOutput = `\
.github/actions/thing
.gitignore
package1/file
package2/file
package2/otherfile
nested/package/config.yml
nested/package/Dockerfile
deeply/nested/package/config.yml
deeply/nested/package/Dockerfile
deeply/nested/package/README
top-level-file
`
    const context: Context = {
      directoryContaining: null,
      directoryLevels: 2,
      exclude: /^\.github\/.*/, // Not used by getChangedDirectories
      forceAllPattern: null
    }
    const uniqueDirectories = await getChangedDirectories(gitOutput, context)
    const expected = new Set([
      'nested/package',
      'deeply/nested',
      '.github/actions' // Excluded later, not through getChangedDirectories
    ])
    expect(new Set(uniqueDirectories)).toEqual(expected)
  })

  test('should ignore deleted directories from git diff output', async () => {
    fsMocked.stat.mockReset()
    fsMocked.stat.mockImplementation(async (path: string) => {
      if (path === 'package1') {
        throw new FakeFsError('ENOENT')
      }
    })
    const gitOutput = `\
.github/actions/thing
.gitignore
package1/file
package2/file
package2/otherfile
nested/package/config.yml
nested/package/Dockerfile
deeply/nested/package/config.yml
deeply/nested/package/Dockerfile
deeply/nested/package/README
top-level-file
`
    const context: Context = {
      directoryContaining: null, // Not used by getChangedDirectories
      directoryLevels: null,
      exclude: /^\.github\/.*/, // Not used by getChangedDirectories
      forceAllPattern: null
    }
    const uniqueDirectories = await getChangedDirectories(gitOutput, context)
    const expected = new Set([
      'package2',
      'nested/package',
      'deeply/nested/package',
      '.github/actions' // Excluded later, not through getChangedDirectories
    ])
    expect(new Set(uniqueDirectories)).toEqual(expected)
  })
})

describe('containsFileFilter', () => {
  test('determines that the provided directory contains the file requested', async () => {
    const directory = __dirname
    const filename = 'pr_event.json'
    expect(await containsFileFilter(directory, filename)).toEqual(__dirname)
  })

  test('determines a parent directory the file requested', async () => {
    const directory = path.join(__dirname, 'sub/directory')
    const filename = 'pr_event.json'
    expect(await containsFileFilter(directory, filename)).toEqual(__dirname)
  })

  test('correctly determines that the provided directory does not contain the file requested', async () => {
    const directory = __dirname
    const filename = 'dont-exist'
    expect(await containsFileFilter(directory, filename)).toEqual(null)
  })
})

describe('isExcludedFilter', () => {
  test('directories are excluded by the exclusion filter', () => {
    const directory = '00_test'
    const pattern = new RegExp('^00_.*')
    expect(isExcludedFilter(directory, pattern)).toEqual(true)
  })

  test('unmatching directories are not filtered', () => {
    const directory = 'grafana'
    const pattern = new RegExp('^00_.*')
    expect(isExcludedFilter(directory, pattern)).toEqual(false)
  })
})

describe('filterGitOutputByFile', () => {
  test('filter out excluded entries', async () => {
    const changedDirectories = [
      'package1',
      'package2',
      'nested',
      'deeply',
      '.github'
    ]
    const expected = ['package1', 'package2', 'nested', 'deeply']
    const context: Context = {
      directoryContaining: null,
      directoryLevels: null,
      exclude: /^\.github($|\/.*)/,
      forceAllPattern: null
    }
    expect(await filterGitOutputByFile(changedDirectories, context)).toEqual(
      expected
    )
  })

  test('filter out excluded entries with nested directories', async () => {
    const changedDirectories = [
      'nested/package',
      'deeply/nested',
      '.github/actions'
    ]
    const expected = ['nested/package', 'deeply/nested']
    const context: Context = {
      directoryContaining: null,
      directoryLevels: null,
      exclude: /^\.github($|\/.*)/,
      forceAllPattern: null
    }
    expect(await filterGitOutputByFile(changedDirectories, context)).toEqual(
      expected
    )
  })

  test('filter to only directory containing file', async () => {
    const changedDirectories = ['__tests__', 'deeply/nested', '.github/actions']
    const expected = ['__tests__']
    const context: Context = {
      directoryContaining: 'pr_event.json',
      directoryLevels: null,
      exclude: /^\.github($|\/.*)/,
      forceAllPattern: null
    }
    expect(await filterGitOutputByFile(changedDirectories, context)).toEqual(
      expected
    )
  })
})

describe('getForceMatchChanges', () => {
  test('returns false when pattern is null', async () => {
    const diffOutput = `\
package1/file
package2/file
package2/otherfile`
    const context: Context = {
      directoryContaining: null,
      directoryLevels: null,
      exclude: /^\.github($|\/.*)/,
      forceAllPattern: null
    }
    expect(await getForceMatchChanges(diffOutput, context)).toEqual(false)
  })

  test('returns true when pattern matches any changed file', async () => {
    const gitOutput = `\
package1/file
package2/package.json
package2/otherfile`
    const context: Context = {
      directoryContaining: null,
      directoryLevels: null,
      exclude: /^\.github($|\/.*)/,
      forceAllPattern: /package\.json$/
    }
    expect(await getForceMatchChanges(gitOutput, context)).toEqual(true)
  })

  test('returns false when pattern does not match any changed file', async () => {
    const diffOutput = `\
package1/file
package2/configuration.yaml
package2/otherfile`
    const context: Context = {
      directoryContaining: null,
      directoryLevels: null,
      exclude: /^\.github($|\/.*)/,
      forceAllPattern: /package\.json$/
    }
    expect(await getForceMatchChanges(diffOutput, context)).toEqual(false)
  })

  test('handles empty git output correctly', async () => {
    const diffOutput = ''
    const context: Context = {
      directoryContaining: null,
      directoryLevels: null,
      exclude: /^\.github($|\/.*)/,
      forceAllPattern: /package\.json$/
    }
    expect(await getForceMatchChanges(diffOutput, context)).toEqual(false)
  })
})
