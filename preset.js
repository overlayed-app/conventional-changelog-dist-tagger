const exec = require("child_process").execSync;
const semver = require("semver");
const commitParser = require("conventional-commits-parser");
const base = require("conventional-changelog-angular");
const helpers = require("./helpers");

// from https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-recommended-bump/index.js#L10
const VERSIONS = ["major", "minor", "patch"];

// from https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/git-raw-commits/index.js#L10
const COMMIT_DELIMITER = "------------------------ >8 ------------------------";

/**
 * Log an array value, truncating to a limit, if necessary
 *
 * @param {String} msg the message to accompany the array in the log
 * @param {Array} arr the array to log, truncating if needed
 * @param {Boolean} pretty flag indicating if we should pretty-print the array
 * @param {Number} max the max array elements to include in the log
 */
const truncateLogArr = (msg, arr, pretty = false, max = 3) => {
  if (arr.length > max) {
    arr = arr.filter((v, i) => i < max);
  }

  console.log(msg + JSON.stringify(arr, undefined, pretty ? 2 : undefined));
};

/**
 * Finds a shared base, on the mainline tree (in HEAD's history) that is common with a given tag
 *
 * @param {{name: String, sha1: String}} tag the tag to search for a shared base with
 * @param {Object} procOpts the options passed to exec
 */
const findSharedBaseFromTag = (tag, procOpts) => {
  const cmd = `git merge-base {0} {1}`;

  console.log(`Finding shared base with tag: ${JSON.stringify(tag)}`);

  const possibleBases = exec(
    cmd.replace("{0}", tag.sha1).replace("{1}", "HEAD"),
    procOpts
  )
    .toString()
    .split(/\r?\n|\r/)
    .filter(e => e.trim().length != 0)
    .map(sha1 => sha1.trim());

  truncateLogArr("Found possible bases:", possibleBases);

  const sharedBase = possibleBases[0];

  console.log(`Base: ${sharedBase}`);

  return sharedBase;
};

/**
 * Find the first commit on the mainline tree (in HEAD's history)
 *
 * @param {Object} procOpts the options passed to exec
 */
const findFirstCommit = procOpts => {
  const cmd = "git rev-list --max-parents=0 HEAD";

  try {
    const firstCommit = exec(cmd, procOpts)
      .toString()
      .trim();

    console.log(`First commit: ${firstCommit}`);

    return firstCommit;
  } catch (ex) {
    // it's likely this is an empty repo - if so, this assertion will fail
    helpers.assertNonEmptyRepo(procOpts);

    // if it didn't fail, rethrow the error - we don't know what's wrong
    throw ex;
  }
};

/**
 * extend the angular preset with our new whatBump logic, inheriting everything else
 */
module.exports = base.then(baseOpts => {
  return {
    ...baseOpts,
    recommendedBumpOpts: {
      ...baseOpts.recommendedBumpOpts,
      /**
       * We basically redo a bunch of work here, sync, because the api limits
       * our ability to re-target the commits we want to work against
       *
       * TL;DR - this isn't the right place for this, but is an attempt at a quick third-party approach
       */
      whatBump: function whatBump(_, opts) {
        opts = opts || {};
        const tagPrefix = opts.tagPrefix || "v";

        // derived from https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/git-raw-commits/index.js#L58
        const procOpts = {
          maxBuffer: Infinity,
          cwd: process.cwd()
        };

        const findTags = `git tag --list --no-color --format="%(refname:strip=2)\t%(objectname)"`;

        // query all tags, removing the tagPrefix from their name value
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

        // find the sharedBase, from which we'll interpret all history
        // it's calculated from the tag if one exists, otherwise it's the full repo history
        // note: if there's no history, findFirstCommit will assert and error out
        const sharedBase =
          tags.length > 0
            ? findSharedBaseFromTag(tags[0], procOpts)
            : findFirstCommit(procOpts);

        console.log(`Found relevant base commit: ${sharedBase}`);

        // since {0}..{1} is non-inclusive, we also need to manually select the first commit in the range
        const findSingleCommit = `git rev-list --format="%B%n-hash-%n%H%n${COMMIT_DELIMITER}" --no-color --max-count=1 {0}`;
        const findCommits = `git rev-list --format="%B%n-hash-%n%H%n${COMMIT_DELIMITER}" --no-color --ancestry-path {0}..{1}`;

        // query all relevant commits, as formatted strings (the format is part of the findCommit command)
        // if we have no tags, we include the commit data from sharedBase
        const relevantCommits =
          (tags.length === 0
            ? exec(
                findSingleCommit.replace("{0}", sharedBase),
                procOpts
              ).toString()
            : "") +
          exec(
            findCommits.replace("{0}", sharedBase).replace("{1}", "HEAD"),
            procOpts
          ).toString();

        console.log("Found commits (raw): " + relevantCommits);

        // parse the relevant commits, from the formatted string, to the conventional-commits format
        // note: this only works because our git format in findCommit matches that of the underlying commitParser
        // if that format changes, this will likely start dropping information
        const commits = relevantCommits
          .split(COMMIT_DELIMITER + "\n")
          .filter(e => e.trim().length != 0)
          .map(c => {
            // because we're using reflog we get an "unexpected" line in our chunk:
            // commit <hash>\n
            // this removes that unexpected line so that commit-parser can work
            const chunks = c.split("\n");
            return chunks.slice(1).join("\n");
          })
          .map(c => commitParser.sync(c, baseOpts.parserOpts));

        truncateLogArr("Found commits:", commits, true);

        // finally, run the relevant commits, in the conventional-commits format using the original angular preset parser
        // this returns an object with a level indicating bump size
        const result = baseOpts.recommendedBumpOpts.whatBump(commits, opts);

        // we can calculate what the version string for the level is, using the same structure that conventional-changelog uses
        // note: if conventional-changelog changed the meaning of levels, our VERSIONS array would need to be updated to make this accurate
        console.log(`Determined bump to be ${VERSIONS[result.level]}.`);

        return result;
      }
    }
  };
});
