const exec = require("child_process").execSync;

/**
 * Throw if the repo is empty (or transient error) - otherwise do nothing
 *
 * @param {Object} procOpts the options passed to exec
 */
const assertNonEmptyRepo = procOpts => {
  try {
    exec("git log", procOpts).toString();
  } catch (ex) {
    if (/fatal:.+does not have any commits.+/.test(ex.toString())) {
      // if we couldn't find any history (there's no commits) we must fail out
      throw new Error(`Unable to find history, cannot proceed.`);
    } else {
      // other failure, rethrow
      throw ex;
    }
  }
};

module.exports = {
  assertNonEmptyRepo
};
