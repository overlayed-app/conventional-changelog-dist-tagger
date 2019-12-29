const exec = require("child_process").execSync;
const semver = require("semver");
const commitParser = require("conventional-commits-parser");
const base = require("conventional-changelog-angular");

const truncateLogArr = (msg, arr, pretty = false, max = 3) => {
  if (arr.length > max) {
    arr = arr.filter((v, i) => i < max);
  }

  console.log(msg + JSON.stringify(arr, undefined, pretty ? 2 : undefined));
};

// from https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-recommended-bump/index.js#L10
const VERSIONS = ["major", "minor", "patch"];

// from https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/git-raw-commits/index.js#L10
const COMMIT_DELIMITER = "------------------------ >8 ------------------------";

module.exports = base.then(baseOpts => {
  return {
    ...baseOpts,
    recommendedBumpOpts: {
      ...baseOpts.recommendedBumpOpts,
      /**
       * We basically redo a bunch of work here, sync, because the api limits
       * our ability to retarget the commits we want to work against
       *
       * TL;DR - this isn't the right place for this, but is an attempt at a quick third-party approach
       */
      whatBump: function whatBump(_, opts) {
        const tagPrefix = opts.tagPrefix || "v";
        const findTags = `git tag --list --no-color --format="%(refname:strip=2)\t%(objectname)"`;
        const findBase = `git merge-base {0} {1}`;
        const findCommits = `git rev-list --format="%B%n-hash-%n%H%n${COMMIT_DELIMITER}" --no-color --ancestry-path {0}..{1}`;
        const procOpts = { maxBuffer: Infinity, cwd: process.cwd() };

        const tags = exec(findTags, procOpts)
          .toString()
          .split(/\r?\n|\r/)
          .filter(e => e.trim().length != 0)
          .map(tagLine => {
            const [rawName, rawSha1] = tagLine.split("\t");
            return {
              name: rawName.trim().replace(tagPrefix, ""),
              sha1: rawSha1.trim()
            };
          })
          .sort((a, b) => semver.rcompare(a.name, b.name));

        truncateLogArr("Found tags:", tags);

        const latestTag = tags[0];

        console.log(`Latest: ${JSON.stringify(latestTag)}`);

        const possibleBases = exec(
          findBase.replace("{0}", latestTag.sha1).replace("{1}", "HEAD"),
          procOpts
        )
          .toString()
          .split(/\r?\n|\r/)
          .filter(e => e.trim().length != 0)
          .map(sha1 => sha1.trim());

        truncateLogArr("Found possible bases:", possibleBases);

        const sharedBase = possibleBases[0];

        console.log(`Base: ${sharedBase}`);

        const rawCommits = exec(
          findCommits.replace("{0}", sharedBase).replace("{1}", "HEAD"),
          procOpts
        ).toString();

        console.log("Found commits (raw): " + rawCommits);

        const commits = rawCommits
          .split(COMMIT_DELIMITER + "\n")
          .filter(e => e.trim().length != 0)
          .map(c => {
            // because we're using reflog we get an "unexpected" line in our chunk:
            // commit <hash>\n
            // this removes that unexpected line so that commit-parser can work
            return c.split("\n")[1];
          })
          .map(c => commitParser.sync(c, baseOpts.parserOpts));

        truncateLogArr("Found commits:", commits, true);

        const result = baseOpts.recommendedBumpOpts.whatBump(commits, opts);

        console.log(`Determined bump to be ${VERSIONS[result.level]}.`);

        return result;
      }
    }
  };
});
