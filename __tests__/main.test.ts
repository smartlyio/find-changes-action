import {promises as fs} from 'fs'
import * as path from 'path'
import {
  getBranchPoint,
  getChangedDirectories,
  containsFileFilter,
  isExcludedFilter,
  filterGitOutputByFile
} from '../src/findChanges'
import {Context} from '../src/context'

const OLD_ENV = process.env
beforeEach(() => {
  process.env = {...OLD_ENV}
})

afterEach(() => {
  process.env = OLD_ENV
})

describe('get branch point', () => {
  test('missing GITHUB_EVENT_NAME', async () => {
    delete process.env['GITHUB_EVENT_NAME']
    await expect(getBranchPoint()).rejects.toThrow(/only works on pull_request/)
  })

  test('wrong GITHUB_EVENT_NAME', async () => {
    process.env['GITHUB_EVENT_NAME'] = 'push'
    await expect(getBranchPoint()).rejects.toThrow(/only works on pull_request/)
  })

  test('missing GITHUB_EVENT_PATH', async () => {
    process.env['GITHUB_EVENT_NAME'] = 'pull_request'
    delete process.env['GITHUB_EVENT_PATH']
    await expect(getBranchPoint()).rejects.toThrow(
      /Could not find event payload/
    )
  })

  test('read event file', async () => {
    const eventPath = path.join(__dirname, 'pr_event.json')
    const eventData = await fs.readFile(eventPath)
    const event = JSON.parse(eventData.toString())
    process.env['GITHUB_EVENT_NAME'] = 'pull_request'
    process.env['GITHUB_EVENT_PATH'] = eventPath

    const branchPoint = await getBranchPoint()
    expect(branchPoint).toEqual(event.pull_request.base.sha)
  })
})

describe('getChangedDirectories', () => {
  test('extract changed directories from git diff output', () => {
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
      exclude: /^\.github\/.*/ // Not used by getChangedDirectories
    }
    const uniqueDirectories = getChangedDirectories(gitOutput, context)
    const expected = new Set([
      'package1',
      'package2',
      'nested/package',
      'deeply/nested/package',
      '.github/actions' // Excluded later, not through getChangedDirectories
    ])
    expect(new Set(uniqueDirectories)).toEqual(expected)
  })

  test('extract changed directories of depth 1 from git diff output', () => {
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
      exclude: /^\.github\/.*/ // Not used by getChangedDirectories
    }
    const uniqueDirectories = getChangedDirectories(gitOutput, context)
    const expected = new Set([
      'package1',
      'package2',
      'nested',
      'deeply',
      '.github' // Excluded later, not through getChangedDirectories
    ])
    expect(new Set(uniqueDirectories)).toEqual(expected)
  })

  test('extract changed directories of depth 2 from git diff output', () => {
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
      exclude: /^\.github\/.*/ // Not used by getChangedDirectories
    }
    const uniqueDirectories = getChangedDirectories(gitOutput, context)
    const expected = new Set([
      'nested/package',
      'deeply/nested',
      '.github/actions' // Excluded later, not through getChangedDirectories
    ])
    expect(new Set(uniqueDirectories)).toEqual(expected)
  })
})

describe('containsFileFilter', () => {
  test('determines that the provided directory contains the file requested', async () => {
    const directory = __dirname
    const filename = 'pr_event.json'
    expect(await containsFileFilter(directory, filename)).toEqual(true)
  })

  test('determines a parent directory the file requested', async () => {
    const directory = path.join(__dirname, 'sub/directory')
    const filename = 'pr_event.json'
    expect(await containsFileFilter(directory, filename)).toEqual(true)
  })

  test('correctly determines that the provided directory does not contain the file requested', async () => {
    const directory = __dirname
    const filename = 'dont-exist'
    expect(await containsFileFilter(directory, filename)).toEqual(false)
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
      exclude: /^\.github($|\/.*)/
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
      exclude: /^\.github($|\/.*)/
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
      exclude: /^\.github($|\/.*)/
    }
    expect(await filterGitOutputByFile(changedDirectories, context)).toEqual(
      expected
    )
  })
})
