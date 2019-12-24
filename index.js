#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

// gather version info
const version_filename = path.join(process.cwd(), "package.json");
const version = JSON.parse(fs.readFileSync(version_filename)).version;

// gather state info
const dist_files = process.env["DIST_FILES"] || "dist/*";
const rel_branch = process.env["REL_BRANCH"] || "master";
const tag_branch = process.env["TAG_BRANCH"] || `tagger/well-known/${version}`;
const head_sha = runCommand("git", "rev-parse", "HEAD");
const rel_sha = runCommand("git", "rev-parse", rel_branch);

// built tag with dists
runCommand("git", "checkout", "-b", tag_branch);
runCommand("git", "add", dist_files);
runCommand("git", "commit", "-m", `'chore(release): v${version} dist'`);
runCommand("git", "tag", `v${version}`);

// reset state
if (rel_sha === head_sha) {
  runCommand("git", "checkout", rel_branch);
} else {
  runCommand("git", "checkout", head_sha);
}

// helper to run a local command
function runCommand(cmd, ...args) {
  const proc = child_process.spawnSync(cmd, args);
  if (proc.error) {
    throw proc.error;
  }
  process.stdout.write(proc.stdout);
  process.stderr.write(proc.stderr);

  return `${proc.stdout}`.replace(/\r?\n|\r/g, "");
}
