process.cwd = jest.fn();
process.exit = jest.fn();

// remove this to better debug the tests
//console.log = jest.fn();

const fs = require("fs");
const exec = require("child_process").execSync;

/* eslint-env node, jest */

describe("tagger", () => {
  let testDir;

  beforeAll(() => {
    testDir = fs.mkdtempSync(".test-fixtures-tagger");
  });

  afterAll(() => {
    fs.rmdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe("empty repos", () => {
    let emptyRepoDir;
    beforeAll(() => {
      emptyRepoDir = fs.mkdtempSync(`${testDir}/empty-repo`);
      fs.writeFileSync(
        `${emptyRepoDir}/package.json`,
        JSON.stringify({
          name: "test-module",
          version: "1.0.0"
        })
      );
      console.log(
        exec("git init", {
          cwd: emptyRepoDir
        }).toString()
      );
      fs.mkdirSync(`${emptyRepoDir}/dist`);
      fs.writeFileSync(`${emptyRepoDir}/dist/file.txt`, "some-release-file");

      process.cwd.mockReturnValue(emptyRepoDir);
    });

    it("should exit, failing", () => {
      require("../tagger");

      expect(process.exit).toHaveBeenCalledTimes(1);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe("repos with commits", () => {
    let commitRepoDir;
    beforeAll(() => {
      commitRepoDir = fs.mkdtempSync(`${testDir}/commit-repo`);
      fs.writeFileSync(
        `${commitRepoDir}/package.json`,
        JSON.stringify({
          name: "test-module",
          version: "1.0.0"
        })
      );
      console.log(
        exec("git init", {
          cwd: commitRepoDir
        }).toString()
      );
      console.log(
        exec("git add .", {
          cwd: commitRepoDir
        }).toString()
      );
      console.log(
        exec('git commit -m "feat: initial commit"', {
          cwd: commitRepoDir
        }).toString()
      );
      fs.mkdirSync(`${commitRepoDir}/dist`);
      fs.writeFileSync(`${commitRepoDir}/dist/file.txt`, "some-release-file");

      process.cwd.mockReturnValue(commitRepoDir);
    });

    it("should tag a release and land on master", () => {
      require("../tagger");

      const status = exec("git status", { cwd: process.cwd() }).toString();
      const branch = exec("git branch --list", {
        cwd: process.cwd()
      }).toString();

      expect(status).toMatch(/^[Oo]n branch master/);
      expect(branch).toMatch(/tagger\/well-known\/1.0.0/);
    });
  });
});
