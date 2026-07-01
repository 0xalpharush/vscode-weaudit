import { type ReviewListItem, type ReviewListLineRange } from "./types";

/**
 * Parses a git unified diff into review-list items with PR-added line ranges.
 * @param diff the stdout from git diff --unified=0
 * @param author the weAudit username that owns the generated review list
 * @returns one review-list item per changed file in the diff
 */
export function parseReviewListItemsFromGitDiff(diff: string, author: string): ReviewListItem[] {
    const itemsByPath = new Map<string, ReviewListItem>();
    let currentItem: ReviewListItem | undefined;
    let currentLine: number | undefined;
    let pendingRangeStart: number | undefined;

    const flushPendingRange = (): void => {
        if (currentItem === undefined || pendingRangeStart === undefined || currentLine === undefined) {
            return;
        }
        pushAddedRange(currentItem, { startLine: pendingRangeStart, endLine: currentLine });
        pendingRangeStart = undefined;
    };

    for (const line of diff.split(/\r?\n/)) {
        const diffPath = parseNewPathFromDiffHeader(line);
        if (diffPath !== undefined) {
            flushPendingRange();
            currentItem = getOrCreateReviewListItem(itemsByPath, diffPath, author);
            currentLine = undefined;
            continue;
        }

        const filePath = parseNewPathFromFileHeader(line);
        if (filePath !== undefined) {
            flushPendingRange();
            currentItem = getOrCreateReviewListItem(itemsByPath, filePath, author);
            currentLine = undefined;
            continue;
        }

        const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunk !== null) {
            flushPendingRange();
            currentLine = Number(hunk[1]) - 1;
            continue;
        }

        if (currentItem === undefined || currentLine === undefined) {
            continue;
        }

        if (line.startsWith("+") && !line.startsWith("+++")) {
            pendingRangeStart ??= currentLine;
            currentLine++;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
            flushPendingRange();
        } else if (line.startsWith(" ")) {
            flushPendingRange();
            currentLine++;
        } else {
            flushPendingRange();
        }
    }

    flushPendingRange();

    return Array.from(itemsByPath.values()).sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Gets an existing review-list item for a path or creates one without completed state.
 * @param itemsByPath the map of review-list items being built
 * @param filePath the diff path to look up
 * @param author the owner of the generated item
 * @returns the review-list item for the path
 */
function getOrCreateReviewListItem(itemsByPath: Map<string, ReviewListItem>, filePath: string, author: string): ReviewListItem {
    const existing = itemsByPath.get(filePath);
    if (existing !== undefined) {
        return existing;
    }
    const item = { path: filePath, author, completed: false, addedRanges: [] };
    itemsByPath.set(filePath, item);
    return item;
}

/**
 * Adds a line range to a review-list item, merging adjacent ranges.
 * @param item the review-list item to update
 * @param range the zero-based, end-exclusive range to append
 */
function pushAddedRange(item: ReviewListItem, range: ReviewListLineRange): void {
    if (range.endLine <= range.startLine) {
        return;
    }
    item.addedRanges ??= [];
    const previous = item.addedRanges[item.addedRanges.length - 1];
    if (previous !== undefined && previous.endLine === range.startLine) {
        previous.endLine = range.endLine;
        return;
    }
    item.addedRanges.push(range);
}

/**
 * Parses the destination file path from a git diff header.
 * @param line a line from git diff output
 * @returns the destination file path, or undefined if the line is not a diff header
 */
function parseNewPathFromDiffHeader(line: string): string | undefined {
    const quotedMatch = line.match(/^diff --git "a\/(.+)" "b\/(.+)"$/);
    if (quotedMatch !== null) {
        return unquoteGitPath(quotedMatch[2]);
    }

    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (match === null) {
        return undefined;
    }
    return unquoteGitPath(match[2]);
}

/**
 * Parses the destination file path from a +++ file header.
 * @param line a line from git diff output
 * @returns the destination file path, or undefined if the line is not a +++ header
 */
function parseNewPathFromFileHeader(line: string): string | undefined {
    if (!line.startsWith("+++ ")) {
        return undefined;
    }

    const filePath = line.slice(4).trim();
    if (filePath === "/dev/null") {
        return undefined;
    }
    return stripGitPrefix(filePath, "b");
}

/**
 * Removes a git a/ or b/ path prefix and best-effort strips surrounding quotes.
 * @param filePath the path as it appears in git diff output
 * @param prefix the expected git diff side prefix
 * @returns the path without the git prefix
 */
function stripGitPrefix(filePath: string, prefix: "a" | "b"): string {
    const unquoted = unquoteGitPath(filePath);
    const expectedPrefix = `${prefix}/`;
    if (unquoted.startsWith(expectedPrefix)) {
        return unquoted.slice(expectedPrefix.length);
    }
    return unquoted;
}

/**
 * Best-effort removes surrounding quotes from a git path token.
 * @param filePath the raw path token
 * @returns the path token without surrounding quotes
 */
function unquoteGitPath(filePath: string): string {
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
        return filePath.slice(1, -1).replace(/\\"/g, '"');
    }
    return filePath;
}
