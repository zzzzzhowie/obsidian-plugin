import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	TAbstractFile,
	Menu,
} from "obsidian";

interface PinnedItem {
	path: string;
	type: "file" | "folder";
	name: string;
}

interface MyPluginSettings {
	pinnedItems: PinnedItem[];
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	pinnedItems: [],
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	pinnedContainerEl: HTMLElement | null = null;
	private initializationAttempts = 0;
	private readonly MAX_INIT_ATTEMPTS = 10;
	private mutationObserver: MutationObserver | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize pinned items with retry logic for mobile
		this.app.workspace.onLayoutReady(() => {
			this.initializeWithRetry();
		});

		// Watch for layout changes (important for mobile when sidebars open/close)
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				// Small delay to let the layout settle
				setTimeout(() => {
					if (
						!this.pinnedContainerEl ||
						!this.pinnedContainerEl.isConnected
					) {
						this.pinnedContainerEl = null;
						this.initializeWithRetry();
						this.setupFileExplorerObserver();
					}
				}, 150);
			})
		);

		// Watch for workspace changes that might affect the file explorer
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				// Small delay to let the leaf change complete
				setTimeout(() => {
					if (
						!this.pinnedContainerEl ||
						!this.pinnedContainerEl.isConnected
					) {
						this.initializeWithRetry();
						this.setupFileExplorerObserver();
					}
				}, 150);
			})
		);

		// Register context menu event for files and folders
		this.registerEvent(
			this.app.workspace.on(
				"file-menu",
				(menu: Menu, file: TAbstractFile) => {
					this.addPinMenuItems(menu, file);
				}
			)
		);

		// Add settings tab
		this.addSettingTab(new PinnedItemsSettingTab(this.app, this));
	}

	private initializeWithRetry() {
		const success = this.addPinnedItemsToFileExplorer();

		if (!success && this.initializationAttempts < this.MAX_INIT_ATTEMPTS) {
			this.initializationAttempts++;
			// Retry with exponential backoff
			const delay = Math.min(
				1000 * Math.pow(1.5, this.initializationAttempts),
				5000
			);
			setTimeout(() => {
				this.initializeWithRetry();
			}, delay);
		} else if (success) {
			this.initializationAttempts = 0;
			// Set up observer to watch for file explorer changes
			this.setupFileExplorerObserver();
		}
	}

	onunload() {
		// Clean up the mutation observer
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = null;
		}

		// Clean up the pinned items container
		if (this.pinnedContainerEl) {
			this.pinnedContainerEl.remove();
			this.pinnedContainerEl = null;
		}
	}

	private setupFileExplorerObserver() {
		// Disconnect existing observer
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = null;
		}

		// On iOS, the mutation observer causes flickering
		// Instead, we'll rely on workspace events only
	}

	private setupObserverForContainer_DISABLED(containerEl: HTMLElement) {
		let debounceTimer: NodeJS.Timeout | null = null;

		// Watch for changes to the file explorer container
		this.mutationObserver = new MutationObserver((mutations) => {
			// Check if pinned container was removed
			let needsReinit = false;

			for (const mutation of mutations) {
				for (const removedNode of Array.from(mutation.removedNodes)) {
					if (
						removedNode === this.pinnedContainerEl ||
						(removedNode instanceof HTMLElement &&
							removedNode.contains(this.pinnedContainerEl))
					) {
						needsReinit = true;
						break;
					}
				}
				if (needsReinit) break;
			}

			// Also check if container is disconnected
			if (
				!needsReinit &&
				(!this.pinnedContainerEl || !this.pinnedContainerEl.isConnected)
			) {
				needsReinit = true;
			}

			if (needsReinit) {
				// Debounce to avoid excessive re-initialization
				if (debounceTimer) {
					clearTimeout(debounceTimer);
				}

				debounceTimer = setTimeout(() => {
					// Check if the nav-files-container is now present (means file explorer refreshed)
					const navFilesContainer = containerEl.querySelector(
						".nav-files-container"
					) as HTMLElement;

					if (navFilesContainer) {
						// Ensure the file list is visible
						navFilesContainer.style.display = "";
						navFilesContainer.style.visibility = "";

						// Re-initialize
						this.pinnedContainerEl = null;
						this.addPinnedItemsToFileExplorer();
					}
				}, 300);
			}
		});

		// Observe only direct children changes, not deep subtree
		this.mutationObserver.observe(containerEl, {
			childList: true,
			subtree: false, // Changed to false to reduce noise
		});

	}

	addPinMenuItems(menu: Menu, file: TAbstractFile) {
		const isPinned = this.settings.pinnedItems.some(
			(item) => item.path === file.path
		);

		if (!isPinned) {
			menu.addItem((item) => {
				item.setTitle("📌 Pin to top")
					.setIcon("pin")
					.onClick(async () => {
						await this.pinItem(file);
					});
			});
		} else {
			menu.addItem((item) => {
				item.setTitle("📌 Unpin")
					.setIcon("pin-off")
					.onClick(async () => {
						await this.unpinItem(file.path);
					});
			});
		}
	}

	async pinItem(file: TAbstractFile) {
		const item: PinnedItem = {
			path: file.path,
			type: file instanceof TFolder ? "folder" : "file",
			name: file.name,
		};

		// Check if already pinned
		if (!this.settings.pinnedItems.some((p) => p.path === file.path)) {
			this.settings.pinnedItems.push(item);
			await this.saveSettings();
			this.refreshPinnedItems();
			new Notice(`Pinned: ${file.name}`);
		}
	}

	async unpinItem(path: string) {
		const item = this.settings.pinnedItems.find((p) => p.path === path);
		this.settings.pinnedItems = this.settings.pinnedItems.filter(
			(item) => item.path !== path
		);
		await this.saveSettings();
		this.refreshPinnedItems();
		if (item) {
			new Notice(`Unpinned: ${item.name}`);
		}
	}

	addPinnedItemsToFileExplorer(): boolean {
		try {
			// Don't reinitialize if already exists and connected
			if (this.pinnedContainerEl && this.pinnedContainerEl.isConnected) {
				return true;
			}

			// Get the file explorer leaf
			const fileExplorerLeaves =
				this.app.workspace.getLeavesOfType("file-explorer");

			if (!fileExplorerLeaves || fileExplorerLeaves.length === 0) {
				return false;
			}

			const fileExplorer = fileExplorerLeaves[0];

			if (!fileExplorer || !fileExplorer.view) {
				return false;
			}

			// Access the file explorer view container
			const fileExplorerView = fileExplorer.view as {
				containerEl?: HTMLElement;
			};

			if (!fileExplorerView.containerEl) {
				return false;
			}

			const containerEl = fileExplorerView.containerEl;

			// Find the nav-files-container (the main file list)
			const navFilesContainer = containerEl.querySelector(
				".nav-files-container"
			) as HTMLElement;

			if (!navFilesContainer) {
				// Try alternative approach - just append to containerEl
				const existingContainer = containerEl.querySelector(
					".pinned-items-container"
				);
				if (existingContainer) {
					existingContainer.remove();
				}

				this.pinnedContainerEl = containerEl.createDiv({
					cls: "pinned-items-container pinned-items-fallback",
				});

				this.refreshPinnedItems();
				return true;
			}

			// Make sure nav-files-container is visible and properly styled
			navFilesContainer.style.display = "";
			navFilesContainer.style.visibility = "";

			// Remove old container if it exists but is disconnected
			if (this.pinnedContainerEl && !this.pinnedContainerEl.isConnected) {
				this.pinnedContainerEl = null;
			}

			// Check if pinned container already exists in the DOM to avoid duplicates
			const existingContainer = containerEl.querySelector(
				".pinned-items-container"
			);
			if (
				existingContainer &&
				existingContainer !== this.pinnedContainerEl
			) {
				existingContainer.remove();
			}

			// Create the pinned items container using Obsidian's createDiv method
			this.pinnedContainerEl = containerEl.createDiv({
				cls: "pinned-items-container",
			});

			// Move it to the beginning
			containerEl.insertBefore(
				this.pinnedContainerEl,
				containerEl.firstChild
			);

			// Render the pinned items after a slight delay to ensure DOM is ready
			setTimeout(() => {
				this.refreshPinnedItems();
			}, 100);

			return true;
		} catch (error) {
			console.error(
				"Failed to add pinned items to file explorer:",
				error
			);
			return false;
		}
	}

	refreshPinnedItems() {
		try {
			if (
				!this.pinnedContainerEl ||
				!this.pinnedContainerEl.isConnected
			) {
				// Try to reinitialize if container is missing
				this.initializeWithRetry();
				return;
			}

			// Clear existing items
			this.pinnedContainerEl.empty();

			if (this.settings.pinnedItems.length === 0) {
			// Completely remove the container when empty
			this.pinnedContainerEl.remove();
			this.pinnedContainerEl = null;
			return;
			}

			this.pinnedContainerEl.style.display = "block";
			this.pinnedContainerEl.style.visibility = "visible";
			this.pinnedContainerEl.style.opacity = "1";

		// Add each pinned item
		this.settings.pinnedItems.forEach((item) => {
			if (!this.pinnedContainerEl) return;

			const itemEl = this.pinnedContainerEl.createDiv({
					cls: "pinned-item",
				});

				// Icon based on type
				itemEl.createSpan({
					cls: "pinned-item-icon",
					text: item.type === "folder" ? "📁" : "📄",
				});

				// Name
				itemEl.createSpan({
					cls: "pinned-item-name",
					text: item.name,
				});

				// Click handler to open the file/folder
				// Handle both touch and click events for better mobile support
				const openFile = (evt: Event) => {
					evt.preventDefault();
					const file = this.app.vault.getAbstractFileByPath(
						item.path
					);
					if (file) {
						if (file instanceof TFile) {
							// Open the file in the active leaf or create a new one
							const leaf = this.app.workspace.getLeaf(false);
							leaf.openFile(file);
						} else if (file instanceof TFolder) {
							// For folders, just show a notice
							new Notice(`Folder: ${file.path}`);
						}
					} else {
						new Notice(`File not found: ${item.path}`);
						// Remove the missing item
						this.unpinItem(item.path);
					}
				};

				// Use touchstart for iOS to avoid double-tap requirement
				this.registerDomEvent(itemEl, "touchstart", openFile);
				// Keep click for desktop and fallback
				this.registerDomEvent(itemEl, "click", openFile);

				// Add unpin button
				const unpinBtn = itemEl.createSpan({
					cls: "pinned-item-unpin",
					text: "×",
				});

				// Handle unpin with both touch and click
				const handleUnpin = (e: Event) => {
					e.stopPropagation(); // Prevent opening the file
					e.preventDefault();
					this.unpinItem(item.path);
				};

				// Use touchstart for iOS immediate response
			this.registerDomEvent(unpinBtn, "touchstart", handleUnpin);
			// Keep click for desktop
			this.registerDomEvent(unpinBtn, "click", handleUnpin);
		});
	} catch (error) {
			console.error("Failed to refresh pinned items:", error);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class PinnedItemsSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Pinned Items Settings" });

		new Setting(containerEl)
			.setName("Pinned items")
			.setDesc(
				"Right-click on any file or folder in the file explorer to pin it to the top."
			);

		// Display current pinned items
		if (this.plugin.settings.pinnedItems.length > 0) {
			containerEl.createEl("h3", { text: "Currently pinned items:" });

			const listEl = containerEl.createEl("ul", {
				cls: "pinned-items-list",
			});

			this.plugin.settings.pinnedItems.forEach((item) => {
				const itemEl = listEl.createEl("li");
				itemEl.createSpan({
					text: `${item.type === "folder" ? "📁" : "📄"} ${
						item.path
					}`,
					cls: "pinned-item-path",
				});

				const removeBtn = itemEl.createEl("button", {
					text: "Remove",
					cls: "pinned-item-remove-btn",
				});

				removeBtn.addEventListener("click", async () => {
					await this.plugin.unpinItem(item.path);
					this.display(); // Refresh the settings display
				});
			});
		} else {
			containerEl.createEl("p", {
				text: "No items pinned yet. Right-click on any file or folder to pin it.",
				cls: "setting-item-description",
			});
		}

		new Setting(containerEl)
			.setName("Clear all pinned items")
			.setDesc("Remove all pinned items at once")
			.addButton((button) =>
				button
					.setButtonText("Clear all")
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.pinnedItems = [];
						await this.plugin.saveSettings();
						this.plugin.refreshPinnedItems();
						this.display();
						new Notice("All pinned items cleared");
					})
			);
	}
}
