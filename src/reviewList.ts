import * as vscode from "vscode";
import * as path from "path";

import { FullReviewListItem } from "./types";

/**
 * Provides review-list tree items for the weAudit sidebar.
 */
export class ReviewListTree implements vscode.TreeDataProvider<FullReviewListItem> {
    private items: FullReviewListItem[] = [];

    private _onDidChangeTreeDataEmitter = new vscode.EventEmitter<FullReviewListItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeDataEmitter.event;

    /**
     * Refreshes the review-list tree view.
     */
    refresh(): void {
        this._onDidChangeTreeDataEmitter.fire();
    }

    /**
     * Replaces the review-list items shown in the tree.
     * @param items the review-list items to display
     */
    setItems(items: FullReviewListItem[]): void {
        this.items = items;
        this.refresh();
    }

    /**
     * Gets child nodes for the review-list tree.
     * @param element the current tree item, or undefined for root items
     * @returns root review-list items or an empty child list
     */
    getChildren(element?: FullReviewListItem): FullReviewListItem[] {
        if (element === undefined) {
            return this.items;
        }
        return [];
    }

    /**
     * Gets the parent node for a review-list item.
     * @returns undefined because the review list is flat
     */
    getParent(_element: FullReviewListItem): undefined {
        return undefined;
    }

    /**
     * Builds the VS Code tree item for a review-list item.
     * @param item the review-list item to render
     * @returns the VS Code tree item
     */
    getTreeItem(item: FullReviewListItem): vscode.TreeItem {
        const addedLineCount = (item.addedRanges ?? []).reduce((count, range) => count + range.endLine - range.startLine, 0);
        const treeItem = new vscode.TreeItem(item.path, vscode.TreeItemCollapsibleState.None);
        treeItem.description = item.rootLabel;
        treeItem.tooltip = `${item.completed ? "Reviewed" : "Pending"}: ${path.join(item.rootLabel, item.path)} (${addedLineCount} added lines)`;
        treeItem.iconPath = new vscode.ThemeIcon(item.completed ? "pass" : "circle-large-outline");
        treeItem.contextValue = item.completed ? "reviewListItemCompleted" : "reviewListItemPending";
        treeItem.command = {
            command: "weAudit.openFileLines",
            title: "Open File",
            arguments: [vscode.Uri.file(path.join(item.rootPath, item.path)), 0, 0],
        };
        return treeItem;
    }
}

/**
 * Owns the review-list tree view registration and updates.
 */
export class ReviewList {
    private treeDataProvider: ReviewListTree;

    /**
     * Registers the Review List tree view.
     * @param context the extension context that owns the tree view subscription
     */
    constructor(context: vscode.ExtensionContext) {
        this.treeDataProvider = new ReviewListTree();
        const colorThemeListener = vscode.window.onDidChangeActiveColorTheme(() => this.treeDataProvider.refresh());
        const treeView = vscode.window.createTreeView("reviewList", { treeDataProvider: this.treeDataProvider });
        context.subscriptions.push(colorThemeListener, treeView);
    }

    /**
     * Replaces all review-list items shown in the tree.
     * @param items the review-list items to display
     */
    setItems(items: FullReviewListItem[]): void {
        this.treeDataProvider.setItems(items);
    }

    /**
     * Refreshes the review-list tree view.
     */
    refresh(): void {
        this.treeDataProvider.refresh();
    }
}
