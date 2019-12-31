process.cwd = jest.fn();

// remove this to better debug the tests
console.log = jest.fn();

const fs = require("fs");
const exec = require("child_process").execSync;
const preset = require("../preset");

/* eslint-env node, jest */

describe("preset", () => {
  let testDir;
  let whatBump;

  beforeAll(async () => {
    testDir = fs.mkdtempSync(".test-fixtures-preset");

    const lib = await preset;
    whatBump = lib.recommendedBumpOpts.whatBump;
  });

  afterAll(() => {
    fs.rmdirSync(testDir, { recursive: true });
  });

  describe("empty repos", () => {
    let emptyRepoDir;

    beforeAll(() => {
      emptyRepoDir = fs.mkdtempSync(`${testDir}/empty-repo`);
      console.log(
        exec("git init", {
          cwd: emptyRepoDir
        }).toString()
      );

      process.cwd.mockReturnValue(emptyRepoDir);
    });

    afterAll(() => {
      fs.rmdirSync(emptyRepoDir, { recursive: true });
    });

    it("should fail because there is no history", () => {
      expect(() => whatBump()).toThrowError(/Unable to find history/);
    });
  });

  describe("single commit repos", () => {
    let singleCommitRepoDir;

    beforeAll(() => {
      singleCommitRepoDir = fs.mkdtempSync(`${testDir}/single-commit-repo`);
      console.log(
        exec("git init", {
          cwd: singleCommitRepoDir
        }).toString()
      );
      fs.writeFileSync(`${singleCommitRepoDir}/test.txt`, "test");
      console.log(
        exec("git add .", {
          cwd: singleCommitRepoDir
        }).toString()
      );
      console.log(
        exec('git commit -m "feat(test): add test file"', {
          cwd: singleCommitRepoDir
        }).toString()
      );
      process.cwd.mockReturnValue(singleCommitRepoDir);
    });

    afterAll(() => {
      fs.rmdirSync(singleCommitRepoDir, { recursive: true });
    });

    it("should use only commit in history", () => {
      expect(whatBump()).toEqual({
        level: 1,
        reason: "There are 0 BREAKING CHANGES and 1 features"
      });
    });
  });

  describe("many commit repos", () => {
    let manyCommitRepoDir;

    beforeAll(() => {
      manyCommitRepoDir = fs.mkdtempSync(`${testDir}/many-commit-repo`);
      console.log(
        exec("git init", {
          cwd: manyCommitRepoDir
        }).toString()
      );
      fs.writeFileSync(`${manyCommitRepoDir}/test.txt`, "test");
      console.log(
        exec("git add .", {
          cwd: manyCommitRepoDir
        }).toString()
      );
      console.log(
        exec('git commit -m "feat(test): add test file"', {
          cwd: manyCommitRepoDir
        }).toString()
      );
      fs.writeFileSync(`${manyCommitRepoDir}/test.txt`, "test, appended");
      console.log(
        exec("git add .", {
          cwd: manyCommitRepoDir
        }).toString()
      );
      console.log(
        exec(
          'git commit -m "fix(test): update test file" -m "blah" -m "BREAKING CHANGE: Breaks something"',
          {
            cwd: manyCommitRepoDir
          }
        ).toString()
      );
      process.cwd.mockReturnValue(manyCommitRepoDir);
    });

    afterAll(() => {
      fs.rmdirSync(manyCommitRepoDir, { recursive: true });
    });

    it("should use complete history", () => {
      expect(whatBump()).toEqual({
        level: 0,
        reason: "There is 1 BREAKING CHANGE and 1 features"
      });
    });
  });

  describe("many commit repos, with tag", () => {
    let manyCommitTagRepoDir;

    beforeAll(() => {
      manyCommitTagRepoDir = fs.mkdtempSync(`${testDir}/many-commit-tag-repo`);
      console.log(
        exec("git init", {
          cwd: manyCommitTagRepoDir
        }).toString()
      );
      fs.writeFileSync(`${manyCommitTagRepoDir}/test.txt`, "test");
      console.log(
        exec("git add .", {
          cwd: manyCommitTagRepoDir
        }).toString()
      );
      console.log(
        exec('git commit -m "feat(test): add test file"', {
          cwd: manyCommitTagRepoDir
        }).toString()
      );
      console.log(
        exec("git tag v1.0.0", {
          cwd: manyCommitTagRepoDir
        }).toString()
      );
      fs.writeFileSync(`${manyCommitTagRepoDir}/test.txt`, "test, appended");
      console.log(
        exec("git add .", {
          cwd: manyCommitTagRepoDir
        }).toString()
      );
      console.log(
        exec(
          'git commit -m "fix(test): update test file" -m "blah" -m "BREAKING CHANGE: Breaks something"',
          {
            cwd: manyCommitTagRepoDir
          }
        ).toString()
      );
      process.cwd.mockReturnValue(manyCommitTagRepoDir);
    });

    afterAll(() => {
      fs.rmdirSync(manyCommitTagRepoDir, { recursive: true });
    });

    it("should use history from tag onward history", () => {
      // it should exclude the tag commit itself, hence no features
      expect(whatBump()).toEqual({
        level: 0,
        reason: "There is 1 BREAKING CHANGE and 0 features"
      });
    });
  });

  describe("many commit repos, with dist tag", () => {
    let distTagRepoDir;

    beforeAll(() => {
      distTagRepoDir = fs.mkdtempSync(`${testDir}/dist-tag-repo`);
      console.log(
        exec("git init", {
          cwd: distTagRepoDir
        }).toString()
      );
      fs.writeFileSync(`${distTagRepoDir}/test.txt`, "test");
      console.log(
        exec("git add .", {
          cwd: distTagRepoDir
        }).toString()
      );
      console.log(
        exec('git commit -m "feat(test): add test file"', {
          cwd: distTagRepoDir
        }).toString()
      );
      fs.writeFileSync(`${distTagRepoDir}/dist-manifest.txt`, "manifest file");
      console.log(
        exec("git add .", {
          cwd: distTagRepoDir
        }).toString()
      );
      console.log(
        exec('git commit -m "chore(release): add manifest"', {
          cwd: distTagRepoDir
        }).toString()
      );
      fs.writeFileSync(`${distTagRepoDir}/dist.txt`, "dist file");
      console.log(
        exec("git checkout -b tag/v1.0.0", {
          cwd: distTagRepoDir
        }).toString()
      );
      console.log(
        exec("git add .", {
          cwd: distTagRepoDir
        }).toString()
      );
      console.log(
        exec('git commit -m "chore(release): add dist file"', {
          cwd: distTagRepoDir
        }).toString()
      );
      console.log(
        exec("git tag v1.0.0", {
          cwd: distTagRepoDir
        }).toString()
      );
      console.log(
        exec("git checkout master", {
          cwd: distTagRepoDir
        }).toString()
      );
      fs.writeFileSync(`${distTagRepoDir}/test.txt`, "test, appended");
      console.log(
        exec("git add .", {
          cwd: distTagRepoDir
        }).toString()
      );
      console.log(
        exec(
          'git commit -m "fix(test): update test file" -m "blah" -m "BREAKING CHANGE: Breaks something"',
          {
            cwd: distTagRepoDir
          }
        ).toString()
      );
      process.cwd.mockReturnValue(distTagRepoDir);
    });

    afterAll(() => {
      fs.rmdirSync(distTagRepoDir, { recursive: true });
    });

    it("should use history from tag onward history", () => {
      // should include the breaking change, the only thing that has occurred since
      // the commit from which the dist-tag split off (the manifest commit)
      expect(whatBump()).toEqual({
        level: 0,
        reason: "There is 1 BREAKING CHANGE and 0 features"
      });
    });
  });

  describe("many commit repos, with multi-dist tag", () => {
    let multiTagRepoDir;

    const addRelease = ver => {
      fs.writeFileSync(
        `${multiTagRepoDir}/dist-manifest.txt`,
        `manifest file ${ver}`
      );
      console.log(
        exec("git add .", {
          cwd: multiTagRepoDir
        }).toString()
      );
      console.log(
        exec(`git commit -m "chore(release): add manifest ${ver}"`, {
          cwd: multiTagRepoDir
        }).toString()
      );
      fs.writeFileSync(`${multiTagRepoDir}/dist.txt`, `dist file ${ver}`);
      console.log(
        exec(`git checkout -b tag/v${ver}`, {
          cwd: multiTagRepoDir
        }).toString()
      );
      console.log(
        exec("git add .", {
          cwd: multiTagRepoDir
        }).toString()
      );
      console.log(
        exec(`git commit -m "chore(release): add dist file ${ver}"`, {
          cwd: multiTagRepoDir
        }).toString()
      );
      console.log(
        exec(`git tag v${ver}`, {
          cwd: multiTagRepoDir
        }).toString()
      );
      console.log(
        exec("git checkout master", {
          cwd: multiTagRepoDir
        }).toString()
      );
    };

    beforeAll(() => {
      multiTagRepoDir = fs.mkdtempSync(`${testDir}/multi-tag-repo`);
      console.log(
        exec("git init", {
          cwd: multiTagRepoDir
        }).toString()
      );
      fs.writeFileSync(`${multiTagRepoDir}/test.txt`, "test");
      console.log(
        exec("git add .", {
          cwd: multiTagRepoDir
        }).toString()
      );
      console.log(
        exec('git commit -m "feat(test): add test file"', {
          cwd: multiTagRepoDir
        }).toString()
      );
      addRelease("1.1.0");
      addRelease("1.2.0");
      fs.writeFileSync(`${multiTagRepoDir}/test.txt`, "test, appended");
      console.log(
        exec("git add .", {
          cwd: multiTagRepoDir
        }).toString()
      );
      console.log(
        exec(
          'git commit -m "fix(test): update test file" -m "blah" -m "BREAKING CHANGE: Breaks something"',
          {
            cwd: multiTagRepoDir
          }
        ).toString()
      );
      process.cwd.mockReturnValue(multiTagRepoDir);
    });

    afterAll(() => {
      fs.rmdirSync(multiTagRepoDir, { recursive: true });
    });

    it("should use history from latest tag onward history", () => {
      // should include the breaking change, the only thing that has occurred since
      // the commit from which the dist-tag split off (the manifest commit)
      expect(whatBump()).toEqual({
        level: 0,
        reason: "There is 1 BREAKING CHANGE and 0 features"
      });
    });
  });
});
