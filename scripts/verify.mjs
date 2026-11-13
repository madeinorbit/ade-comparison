#!/usr/bin/env node
// Runs the deploy checks against a clean checkout of a commit (default: HEAD), so files that exist
// only in your working tree cannot make a broken commit pass. Run it before every push to main:
//   npm run verify            # checks HEAD
//   npm run verify -- <ref>   # checks another commit
// It creates a throwaway git worktree, links this checkout's node_modules into it, runs the same
// steps as .github/workflows/deploy.yml and removes the worktree again.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const ref = process.argv[2] || 'HEAD'
const sha = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: root, encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()
if (dirty && ref === 'HEAD') console.warn('Note: your working tree has uncommitted changes. They are NOT part of this check:\n' + dirty + '\n')

const dir = mkdtempSync(join(tmpdir(), 'ade-verify-'))
const steps = [
  ['npm', ['run', 'data:check']],
  ['npm', ['run', 'research:validate']],
  ['npm', ['run', 'test:research']],
  ['npm', ['run', 'build']],
  ['npm', ['test']],
]
let failed = null
try {
  execFileSync('git', ['worktree', 'add', '--detach', '--quiet', dir, sha], { cwd: root, stdio: 'inherit' })
  const modules = resolve(root, 'node_modules')
  if (!existsSync(modules)) throw new Error('Run npm ci in this checkout first.')
  symlinkSync(modules, join(dir, 'node_modules'), 'dir')
  const env = { ...process.env, ADE_COMPARISON_PUBLIC_REPOSITORY_URL: 'https://github.com/madeinorbit/ade-comparison' }
  for (const [cmd, args] of steps) {
    const label = `${cmd} ${args.join(' ')}`
    console.log(`\n=== ${label}`)
    const run = spawnSync(cmd, args, { cwd: dir, env, stdio: 'inherit' })
    if (run.status !== 0) { failed = label; break }
  }
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'ignore' })
  rmSync(dir, { recursive: true, force: true })
}
if (failed) {
  console.error(`\nverify FAILED at "${failed}" for ${sha.slice(0, 7)}. Do not push this commit.`)
  process.exit(1)
}
console.log(`\nverify passed for ${sha.slice(0, 7)}: the commit is safe to push.`)
