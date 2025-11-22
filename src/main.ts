import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	Menu,
	TAbstractFile,
	TFolder,
} from "obsidian";
import { MyPluginSettings, DEFAULT_SETTINGS } from "./settings";
import { PinnedItemsManager } from "./pinned-items";
import { FolderNoteManager } from "./folder-note";
import { FileCountManager } from "./file-count";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	pinnedItemsManager: PinnedItemsManager;
	folderNoteManager: FolderNoteManager;
	fileCountManager: FileCountManager;

	async onload() {
		await this.loadSettings();

		// Initialize managers
		this.pinnedItemsManager = new PinnedItemsManager(this.app, this);
		this.folderNoteManager = new FolderNoteManager(this.app, this);
		this.fileCountManager = new FileCountManager(this.app, this);

		// Initialize features
		this.pinnedItemsManager.initialize();
		this.folderNoteManager.initialize();
		this.fileCountManager.initialize();

		// Register context menu event for files and folders
		this.registerEvent(
			this.app.workspace.on(
				"file-menu",
				(menu: Menu, file: TAbstractFile) => {
					this.addContextMenuItems(menu, file);
				}
			)
		);

		// Add settings tab
		this.addSettingTab(new MyPluginSettingTab(this.app, this));
	}

	onunload() {
		this.pinnedItemsManager.cleanup();
	}

	addContextMenuItems(menu: Menu, file: TAbstractFile) {
		// Add pin/unpin menu item
		const isPinned = this.settings.pinnedItems.some(
			(item) => item.path === file.path
		);

		if (!isPinned) {
			menu.addItem((item) => {
				item.setTitle("📌 Pin to top")
					.setIcon("pin")
					.onClick(async () => {
						await this.pinnedItemsManager.pinItem(file);
					});
			});
		} else {
			menu.addItem((item) => {
				item.setTitle("📌 Unpin")
					.setIcon("pin-off")
					.onClick(async () => {
						await this.pinnedItemsManager.unpinItem(file.path);
					});
			});
		}

		// Add folder note menu items for folders
		if (file instanceof TFolder) {
			this.folderNoteManager.addContextMenuItems(menu, file);
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

class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "File Explorer Enhancements" });

		// Folder note settings
		new Setting(containerEl)
			.setName("Show folder notes")
			.setDesc(
				"Show an indicator (📝) next to folders that have a folder note (a markdown file with the same name as the folder)."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showFolderNotes)
					.onChange(async (value) => {
						this.plugin.settings.showFolderNotes = value;
						await this.plugin.saveSettings();
						this.plugin.folderNoteManager.updateAllFolderNotes();
					})
			);

		// File count settings
		new Setting(containerEl)
			.setName("Show file count")
			.setDesc(
				"Show the number of files in each folder. Displays as 'direct/total' where direct is the number of files directly in the folder and total includes subfolders."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showFileCount)
					.onChange(async (value) => {
						this.plugin.settings.showFileCount = value;
						await this.plugin.saveSettings();
						this.plugin.fileCountManager.updateAllFileCounts();
					})
			);

		containerEl.createEl("h3", { text: "Pinned Items" });

		new Setting(containerEl)
			.setName("Pin files and folders")
			.setDesc(
				"Right-click on any file or folder in the file explorer to pin it to the top for quick access."
			);

		// Display current pinned items
		if (this.plugin.settings.pinnedItems.length > 0) {
			containerEl.createEl("h4", { text: "Currently pinned:" });

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
					await this.plugin.pinnedItemsManager.unpinItem(item.path);
					this.display(); // Refresh the settings display
				});
			});

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
							this.plugin.pinnedItemsManager.refreshPinnedItems();
							this.display();
						})
				);
		} else {
			containerEl.createEl("p", {
				text: "No items pinned yet. Right-click on any file or folder to pin it.",
				cls: "setting-item-description",
			});
		}
	}
}

