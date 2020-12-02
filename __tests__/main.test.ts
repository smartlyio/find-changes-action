import {filterGitOutput} from '../src/utils'

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
