import * as assert from "node:assert";

import { parseReviewListItemsFromGitDiff } from "../../src/reviewListDiff";

describe("reviewListDiff.ts", () => {
    describe("parseReviewListItemsFromGitDiff", () => {
        it("should parse changed files and added line ranges from a unified diff", () => {
            const diff = [
                "diff --git a/src/a.ts b/src/a.ts",
                "index 1111111..2222222 100644",
                "--- a/src/a.ts",
                "+++ b/src/a.ts",
                "@@ -1,0 +2,2 @@",
                "+const a = 1;",
                "+const b = 2;",
                "@@ -4 +6,0 @@",
                "-const removed = true;",
                "@@ -8,0 +9 @@",
                "+const c = 3;",
                "diff --git a/src/b.ts b/src/b.ts",
                "new file mode 100644",
                "index 0000000..3333333",
                "--- /dev/null",
                "+++ b/src/b.ts",
                "@@ -0,0 +1,2 @@",
                "+export const one = 1;",
                "+export const two = 2;",
                "diff --git a/src/old.ts b/src/renamed.ts",
                "similarity index 100%",
                "rename from src/old.ts",
                "rename to src/renamed.ts",
                "diff --git a/media/image.png b/media/image.png",
                "new file mode 100644",
                "index 0000000..4444444",
                "Binary files /dev/null and b/media/image.png differ",
            ].join("\n");

            assert.deepStrictEqual(parseReviewListItemsFromGitDiff(diff, "alice"), [
                {
                    path: "media/image.png",
                    author: "alice",
                    completed: false,
                    addedRanges: [],
                },
                {
                    path: "src/a.ts",
                    author: "alice",
                    completed: false,
                    addedRanges: [
                        { startLine: 1, endLine: 3 },
                        { startLine: 8, endLine: 9 },
                    ],
                },
                {
                    path: "src/b.ts",
                    author: "alice",
                    completed: false,
                    addedRanges: [{ startLine: 0, endLine: 2 }],
                },
                {
                    path: "src/renamed.ts",
                    author: "alice",
                    completed: false,
                    addedRanges: [],
                },
            ]);
        });

        it("should parse replacements as added ranges at the new file line", () => {
            const diff = [
                "diff --git a/src/replaced.ts b/src/replaced.ts",
                "index 1111111..2222222 100644",
                "--- a/src/replaced.ts",
                "+++ b/src/replaced.ts",
                "@@ -10 +10 @@",
                "-oldValue();",
                "+newValue();",
            ].join("\n");

            assert.deepStrictEqual(parseReviewListItemsFromGitDiff(diff, "alice"), [
                {
                    path: "src/replaced.ts",
                    author: "alice",
                    completed: false,
                    addedRanges: [{ startLine: 9, endLine: 10 }],
                },
            ]);
        });
    });
});
