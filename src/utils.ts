import * as core from '@actions/core'
import * as exec from '@actions/exec'

export async function gitDiff(): Promise<string> {
  core.info('Finding changed packages')
  let gitOutput = ''
  let gitError = ''
  const options: exec.ExecOptions = {}
  options.listeners = {
    stdout: (data: Buffer) => {
      gitOutput += data.toString()
    },
    stderr: (data: Buffer) => {
      gitError += data.toString()
    }
  }
  await exec.exec('git', ['diff', '--name-only', 'origin/master'], options)

  core.debug(`Stderr from git: ${gitError}`)

  return gitOutput
}

export function filterGitOutput(gitOutput: string): string[] {
  const packageNames: string[] = gitOutput
    .split('\n')
    .map(line => {
      const parts = line.trim().split('/')
      if (parts.length === 1) {
        return null
      }
      return parts[0]
    })
    .filter(item => item) as string[]
  const uniquePackageNames = new Set(
    packageNames.filter(packageName => {
      if (packageName.match(/^00_.*/) || packageName === '.github') {
        return false
      }
      return true
    })
  )

  return [...uniquePackageNames]
}
