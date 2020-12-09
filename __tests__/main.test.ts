import {promises as fs} from 'fs'
import * as path from 'path'
import {filterGitOutput, getBranchPoint} from '../src/utils'

const OLD_ENV = process.env
beforeEach(() => {
  process.env = {...OLD_ENV}
})

afterEach(() => {
  process.env = OLD_ENV
})

describe('filter git output', () => {
  test('gets only package directory names', async () => {
    const gitOutput = `
.github/actions/thing
.gitignore
package1/file
package2/file
package2/otherfile
00_skipme
`
    const packageNames: string[] = filterGitOutput(gitOutput)
    expect(new Set(packageNames)).toEqual(new Set(['package1', 'package2']))
  })

  test('gets only package directory names', async () => {
    const gitOutput = `
.github/actions/thing
.gitignore
00_skipme
`
    const packageNames: string[] = filterGitOutput(gitOutput)
    expect(packageNames).toEqual([])
  })
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
