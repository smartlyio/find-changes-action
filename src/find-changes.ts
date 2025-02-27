import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as path from 'path'
import {Context} from './context'
import {promises as fs} from 'fs'

interface GitResult {
  stdout: string
  stderr: string
}

interface StatError {
  code: string
}

async function execCommand(
  command: string,
  args: string[]
): Promise<GitResult> {
  let stderr = ''
  let stdout = ''
  const options: exec.ExecOptions = {}
  options.listeners = {
    stdout: (data: Buffer) => {
      stdout += data.toString()
    },
    stderr: (data: Buffer) => {
      stderr += data.toString()
    }
  }
  await exec.exec(command, args, options)
  core.debug(`Stderr from git: ${stderr}`)
  return {stdout, stderr}
}

export async function getBranchPoint(): Promise<string> {
  const eventName = process.env['GITHUB_EVENT_NAME']

  switch (eventName as string) {
    case 'pull_request':
      return handlePullRequest()
    case 'push':
      return handlePush()
  }
  throw new Error(
    'find-changed-packages only works on pull_request and push events'
  )
}

async function handlePullRequest(): Promise<string> {
  const event = await getEvent()
  if (event.action === 'closed') {
    throw new Error(
      'Running find-changes on: pull_request: closed is not supported in v2 - please migrate workflow to on: push:'
    )
  }
  if (event.repository && event.repository.default_branch) {
    const upstream = `origin/${event.repository.default_branch}`
    core.info(`Found branch point ${upstream}`)
    return upstream
  }
  throw new Error(
    'Unable to determine pull request branch point to compare changes.'
  )
}

async function handlePush(): Promise<string> {
  const event = await getEvent()
  if (event.before) {
    core.info(`Found branch point ${event.before}`)
    return event.before as string
  }
  throw new Error('Unable to determine push branch point to compare changes.')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEvent(): Promise<any> {
  const eventPath = process.env['GITHUB_EVENT_PATH']
  core.info(`Reading event from ${eventPath}`)
  if (!eventPath) {
    throw new Error(
      'Could not find event payload file to determine branch point.'
    )
  }
  const eventData: Buffer = await fs.readFile(eventPath)
  const event = JSON.parse(eventData.toString())
  if (!event) {
    throw new Error('Event payload does not provide data.')
  }
  return event
}

export async function gitDiff(diffBase: string): Promise<string> {
  core.info('Finding changed packages')
  const gitOutput = await execCommand('git', ['diff', '--name-only', diffBase])
  return gitOutput.stdout
}

export async function gitLsFiles(): Promise<string> {
  core.info('Finding all files')
  const gitOutput = await execCommand('git', ['ls', 'files'])
  return gitOutput.stdout
}

// todo: custom logic, not a repeat of getChangedDirectories like it is now
export async function getAllDirectories(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: Context
): Promise<string[]> {
  // git ls-files here
  return [] // dummy return for now
}

export async function getChangedDirectories(
  diffOutput: string,
  context: Context
): Promise<string[]> {
  const directoryLevels: number = context.directoryLevels
    ? context.directoryLevels
    : -1
  const changedDirectories = await Promise.all(
    diffOutput.split('\n').map(async line => {
      const parts = line.trim().split(path.sep)
      if (parts.length <= directoryLevels) {
        return null
      }
      const slice = parts.slice(0, directoryLevels)
      if (slice.length === 0) {
        return null
      }
      const directory = slice.join(path.sep)
      try {
        await fs.stat(directory)
        return directory
      } catch (e) {
        return null
      }
    })
  )

  const uniqueDirectories = new Set(
    changedDirectories.filter(item => item) as string[]
  )
  return [...uniqueDirectories]
}

function range(start: number, end: number): number[] {
  const length = end - start
  return Array.from({length}, (_, i) => start + i)
}

export async function containsFileFilter(
  directory: string,
  filename: string
): Promise<string | null> {
  const directoryParts = directory.split(path.sep)
  const sliceRanges = range(1, directoryParts.length + 1)
  for (const slice of sliceRanges) {
    const directoryPart = directoryParts.slice(0, slice).join(path.sep)
    const filepath = path.join(directoryPart, filename)
    try {
      const stat = await fs.stat(filepath)
      if (stat.isFile()) {
        return directoryPart
      }
    } catch (e) {
      const err = e as StatError
      if (err.code !== 'ENOENT') {
        throw e
      }
    }
  }
  return null
}

export function isExcludedFilter(directory: string, pattern: RegExp): boolean {
  return !!directory.match(pattern)
}

export async function filterGitOutputByFile(
  changedDirectories: string[],
  context: Context
): Promise<string[]> {
  const filteredDirectories: string[] = []

  for (const directory of changedDirectories) {
    if (!isExcludedFilter(directory, context.exclude)) {
      if (!context.directoryContaining) {
        filteredDirectories.push(directory)
      } else {
        const include = await containsFileFilter(
          directory,
          context.directoryContaining
        )
        if (include) {
          filteredDirectories.push(include)
        }
      }
    }
  }

  const uniqueDirectories = new Set(filteredDirectories)
  return [...uniqueDirectories]
}

export async function getForceMatchChanges(
  diffOutput: string,
  context: Context
): Promise<boolean> {
  if (!context.forceAllPattern) {
    return false
  }
  const pattern = context.forceAllPattern

  const changedFiles = diffOutput
    .split('\n')
    .filter(line => line.trim().length > 0)
  return changedFiles.some(file => file.match(pattern))
}
