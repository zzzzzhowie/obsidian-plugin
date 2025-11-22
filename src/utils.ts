import { TFolder, TFile, App } from "obsidian";

/**
 * Check if a folder has a folder note (a markdown file with the same name)
 */
export function getFolderNote(folder: TFolder, app: App): TFile | null {
	// Check for a file with the same name as the folder
	const folderNotePath = `${folder.path}/${folder.name}.md`;
	const file = app.vault.getAbstractFileByPath(folderNotePath);
	
	if (file instanceof TFile) {
		return file;
	}
	
	return null;
}

/**
 * Count the number of files in a folder (recursive)
 */
export function countFilesInFolder(folder: TFolder, countSubfolders = true): number {
	let count = 0;
	
	for (const child of folder.children) {
		if (child instanceof TFile) {
			count++;
		} else if (child instanceof TFolder && countSubfolders) {
			count += countFilesInFolder(child, true);
		}
	}
	
	return count;
}

/**
 * Count only direct children files in a folder (non-recursive)
 */
export function countDirectFiles(folder: TFolder): number {
	return folder.children.filter(child => child instanceof TFile).length;
}

/**
 * Count only direct children folders
 */
export function countDirectFolders(folder: TFolder): number {
	return folder.children.filter(child => child instanceof TFolder).length;
}

/**
 * Escape special characters in CSS selector
 */
export function escapeCSSSelector(str: string): string {
	// Escape special CSS selector characters
	return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

