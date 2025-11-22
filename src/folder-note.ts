import { App, TFolder, TFile, Menu } from "obsidian";
import { getFolderNote, escapeCSSSelector } from "./utils";
import type MyPlugin from "./main";

export class FolderNoteManager {
	app: App;
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	initialize() {
		// Add folder note indicator to file explorer when layout is ready
		this.app.workspace.onLayoutReady(() => {
			// Immediately hide folder notes to prevent flash
			this.hideAllFolderNotesQuick();
			
			// Multiple retries with increasing delays for better compatibility
			setTimeout(() => {
				this.updateAllFolderNotes();
			}, 50);
			
			setTimeout(() => {
				this.updateAllFolderNotes();
			}, 200);
			
			setTimeout(() => {
				this.updateAllFolderNotes();
			}, 500);
			
			setTimeout(() => {
				this.updateAllFolderNotes();
			}, 1000);
			
			setTimeout(() => {
				this.updateAllFolderNotes();
			}, 2000);
		});

		// Update when files are created/renamed/deleted
		this.plugin.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					setTimeout(() => {
						this.updateFolderNoteForFile(file);
					}, 100);
				}
			})
		);

		this.plugin.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile && file.extension === "md") {
					setTimeout(() => {
						this.updateFolderNoteForFile(file);
						// Also update the old location
						const oldParent = this.getParentFromPath(oldPath);
						if (oldParent) {
							this.updateFolderNote(oldParent);
						}
					}, 100);
				}
			})
		);

		this.plugin.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					const parent = file.parent;
					if (parent) {
						setTimeout(() => {
							this.updateFolderNote(parent);
						}, 100);
					}
				}
			})
		);

		// Update on layout changes
		this.plugin.registerEvent(
			this.app.workspace.on("layout-change", () => {
				// Immediately hide to prevent flash
				this.hideAllFolderNotesQuick();
				setTimeout(() => {
					this.updateAllFolderNotes();
				}, 100);
				setTimeout(() => {
					this.updateAllFolderNotes();
				}, 500);
			})
		);

		// Update when files are opened (clicking on files might refresh DOM)
		this.plugin.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				setTimeout(() => {
					this.updateAllFolderNotes();
				}, 100);
			})
		);

		// Update when active leaf changes
		this.plugin.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				setTimeout(() => {
					this.updateAllFolderNotes();
				}, 100);
			})
		);
	}

	private getParentFromPath(path: string): TFolder | null {
		const parts = path.split("/");
		parts.pop(); // Remove file name
		const parentPath = parts.join("/");
		if (!parentPath) return this.app.vault.getRoot();
		
		const parent = this.app.vault.getAbstractFileByPath(parentPath);
		return parent instanceof TFolder ? parent : null;
	}

	private updateFolderNoteForFile(file: TFile) {
		const parent = file.parent;
		if (parent) {
			this.updateFolderNote(parent);
		}
	}

	updateAllFolderNotes() {
		// First, show all previously hidden folder notes (even if disabled)
		this.showAllHiddenFolderNotes();

		if (!this.plugin.settings.showFolderNotes) {
			// Remove all folder note styling
			this.removeAllFolderNoteStyles();
			return;
		}

		// Then update each folder
		const folders = this.getAllFolders();
		folders.forEach((folder) => this.updateFolderNote(folder));
	}

	private showAllHiddenFolderNotes() {
		const fileExplorerLeaves = this.app.workspace.getLeavesOfType("file-explorer");
		if (!fileExplorerLeaves || fileExplorerLeaves.length === 0) {
			return;
		}

		const fileExplorer = fileExplorerLeaves[0];
		const fileExplorerView = fileExplorer.view as {
			containerEl?: HTMLElement;
		};

		if (!fileExplorerView.containerEl) {
			return;
		}

		// Remove the hidden class from all previously hidden files
		const hiddenFiles = fileExplorerView.containerEl.querySelectorAll('.is-folder-note-hidden');
		hiddenFiles.forEach((el) => {
			el.removeClass('is-folder-note-hidden');
		});
	}

	private removeAllFolderNoteStyles() {
		const fileExplorerLeaves = this.app.workspace.getLeavesOfType("file-explorer");
		if (!fileExplorerLeaves || fileExplorerLeaves.length === 0) {
			return;
		}

		const fileExplorer = fileExplorerLeaves[0];
		const fileExplorerView = fileExplorer.view as {
			containerEl?: HTMLElement;
		};

		if (!fileExplorerView.containerEl) {
			return;
		}

		// Remove all folder note classes and click handlers
		const folderTitles = fileExplorerView.containerEl.querySelectorAll('.nav-folder-title.has-folder-note');
		folderTitles.forEach((folderTitle) => {
			const el = folderTitle as HTMLElement;
			el.removeClass('has-folder-note');

			// Remove click handler from the title content
			const folderTitleContent = el.querySelector('.nav-folder-title-content') as HTMLElement;
			if (folderTitleContent) {
				const existingContentHandler = (folderTitleContent as any)._folderNoteClickHandler;
				if (existingContentHandler) {
					folderTitleContent.removeEventListener("click", existingContentHandler);
					delete (folderTitleContent as any)._folderNoteClickHandler;
				}
			}
		});
	}

	private hideAllFolderNotesQuick() {
		if (!this.plugin.settings.showFolderNotes) return;

		const folders = this.getAllFolders();
		folders.forEach((folder) => {
			const folderNote = getFolderNote(folder, this.app);
			if (folderNote) {
				// Quickly hide the file element
				const fileEl = this.getFileElement(folderNote);
				if (fileEl) {
					fileEl.addClass("is-folder-note-hidden");
				}
			}
		});
	}

	private getAllFolders(): TFolder[] {
		const folders: TFolder[] = [];
		
		const collectFolders = (folder: TFolder) => {
			folders.push(folder);
			folder.children.forEach((child) => {
				if (child instanceof TFolder) {
					collectFolders(child);
				}
			});
		};

		collectFolders(this.app.vault.getRoot());
		return folders;
	}

	updateFolderNote(folder: TFolder) {
		if (!this.plugin.settings.showFolderNotes) return;

		const folderNote = getFolderNote(folder, this.app);
		const folderTitleEl = this.getFolderElement(folder);

		if (!folderTitleEl) {
			// Folder not visible in DOM (probably collapsed), skip silently
			return;
		}

		// Get the folder title content element (the text part)
		const folderTitleContent = folderTitleEl.querySelector(".nav-folder-title-content") as HTMLElement;

		// Remove existing click handler
		const existingContentHandler = (folderTitleContent as any)._folderNoteClickHandler;
		if (existingContentHandler) {
			folderTitleContent.removeEventListener("click", existingContentHandler);
			delete (folderTitleContent as any)._folderNoteClickHandler;
		}

		if (folderNote) {
			// Add folder note class for styling (underline text)
			folderTitleEl.addClass("has-folder-note");

			// Hide the folder note file in the file explorer
			this.hideFolderNoteFile(folderNote);

			// Add click handler ONLY to the text content
			if (folderTitleContent) {
				const contentHandler = (e: MouseEvent) => {
					// Check if the click is actually on the text (not the padding/whitespace)
					const target = e.target as HTMLElement;
					
					// Only handle if clicking directly on the content element itself
					if (target === folderTitleContent || target.classList.contains('nav-folder-title-content')) {
						// Get the text width to determine if click is on actual text
						const range = document.createRange();
						const textNode = folderTitleContent.firstChild;
						
						if (textNode && textNode.nodeType === Node.TEXT_NODE) {
							range.selectNodeContents(textNode);
							const textRect = range.getBoundingClientRect();
							const clickX = e.clientX;
							
							// Only open folder note if click is within the text bounds
							if (clickX >= textRect.left && clickX <= textRect.right) {
								e.preventDefault();
								e.stopPropagation();
								const leaf = this.app.workspace.getLeaf(false);
								leaf.openFile(folderNote);
							}
							// Otherwise, let the default toggle behavior happen
						}
					}
				};

				(folderTitleContent as any)._folderNoteClickHandler = contentHandler;
				folderTitleContent.addEventListener("click", contentHandler);
			}
		} else {
			// Remove folder note class if no longer has a folder note
			folderTitleEl.removeClass("has-folder-note");
		}
	}

	private hideFolderNoteFile(file: TFile) {
		const fileEl = this.getFileElement(file);
		if (fileEl) {
			fileEl.addClass("is-folder-note-hidden");
		}
	}

	private getFileElement(file: TFile): HTMLElement | null {
		const fileExplorerLeaves = this.app.workspace.getLeavesOfType("file-explorer");
		if (!fileExplorerLeaves || fileExplorerLeaves.length === 0) {
			return null;
		}

		const fileExplorer = fileExplorerLeaves[0];
		const fileExplorerView = fileExplorer.view as {
			containerEl?: HTMLElement;
		};

		if (!fileExplorerView.containerEl) {
			return null;
		}

		// Find the file element by data-path attribute with escaped path
		const escapedPath = escapeCSSSelector(file.path);
		const fileElements = fileExplorerView.containerEl.querySelectorAll(
			`.nav-file-title[data-path="${escapedPath}"]`
		);

		if (fileElements.length > 0) {
			// Return the parent tree-item element
			const fileTitle = fileElements[0] as HTMLElement;
			return fileTitle.closest('.tree-item.nav-file') as HTMLElement;
		}

		return null;
	}

	private getFolderElement(folder: TFolder): HTMLElement | null {
		const fileExplorerLeaves = this.app.workspace.getLeavesOfType("file-explorer");
		if (!fileExplorerLeaves || fileExplorerLeaves.length === 0) {
			return null;
		}

		const fileExplorer = fileExplorerLeaves[0];
		const fileExplorerView = fileExplorer.view as {
			containerEl?: HTMLElement;
		};

		if (!fileExplorerView.containerEl) {
			return null;
		}

		// Find the folder title element by data-path attribute with escaped path
		const escapedPath = escapeCSSSelector(folder.path);
		const folderTitleElements = fileExplorerView.containerEl.querySelectorAll(
			`.nav-folder-title[data-path="${escapedPath}"]`
		);

		return folderTitleElements.length > 0 ? (folderTitleElements[0] as HTMLElement) : null;
	}

	addContextMenuItems(menu: Menu, folder: TFolder) {
		if (!this.plugin.settings.showFolderNotes) return;

		const folderNote = getFolderNote(folder, this.app);

		if (folderNote) {
			menu.addItem((item) => {
				item.setTitle("📝 Open folder note")
					.setIcon("document")
					.onClick(() => {
						const leaf = this.app.workspace.getLeaf(false);
						leaf.openFile(folderNote);
					});
			});
		} else {
			menu.addItem((item) => {
				item.setTitle("📝 Create folder note")
					.setIcon("document-create")
					.onClick(async () => {
						const notePath = `${folder.path}/${folder.name}.md`;
						const newFile = await this.app.vault.create(
							notePath,
							`# ${folder.name}\n\n`
						);
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(newFile);
					});
			});
		}
	}
}

