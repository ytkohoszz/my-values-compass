import { Plugin, WorkspaceLeaf } from "obsidian";
import {
	DEFAULT_DATA_FILE_PATH,
	DEFAULT_SETTINGS,
	LEGACY_JSON_DATA_PATH,
	VIEW_TYPE_VALUES_COMPASS,
} from "./defaults";
import { ValuesCompassSettingTab } from "./settings";
import { ValuesStore } from "./store";
import { CompassTabId, ValuesCompassSettings } from "./types";
import { ValuesCompassView } from "./view";
import { ValuesCompassWidget } from "./widget";

export default class ValuesCompassPlugin extends Plugin {
	public settings: ValuesCompassSettings = { ...DEFAULT_SETTINGS };
	public store!: ValuesStore;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.store = new ValuesStore(this.app, this.settings.dataFilePath);

		this.registerView(
			VIEW_TYPE_VALUES_COMPASS,
			(leaf: WorkspaceLeaf) => new ValuesCompassView(leaf, this)
		);

		this.addRibbonIcon("compass", "Компас ценностей", () => {
			void this.activateView("map");
		});

		this.addCommand({
			id: "open-values-compass",
			name: "Открыть Карту ценностей",
			callback: () => {
				void this.activateView("map");
			},
		});

		this.registerMarkdownCodeBlockProcessor(
			"values-compass",
			(source, el, ctx) => {
				ctx.addChild(new ValuesCompassWidget(el, this, source));
			}
		);

		this.addSettingTab(new ValuesCompassSettingTab(this.app, this));

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file.path === this.store.getFilePath()) {
					this.store.handleExternalChange();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file.path === this.store.getFilePath()) {
					this.store.handleExternalChange();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				const targetPath = this.store.getFilePath();
				if (file.path === targetPath || oldPath === targetPath) {
					this.store.handleExternalChange();
				}
			})
		);

		this.app.workspace.onLayoutReady(async () => {
			await this.store.load();
		});
	}

	onunload(): void {
		this.store?.dispose();
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<ValuesCompassSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

		if (this.settings.dataFilePath === LEGACY_JSON_DATA_PATH) {
			this.settings.dataFilePath = DEFAULT_DATA_FILE_PATH;
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	public async activateView(
		tab: CompassTabId = "map",
		domainId?: string
	): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_VALUES_COMPASS)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({
				type: VIEW_TYPE_VALUES_COMPASS,
				active: true,
			});
		}

		workspace.revealLeaf(leaf);

		const view = leaf.view;
		if (view instanceof ValuesCompassView) {
			view.switchTab(tab, domainId);
		}
	}

	public refreshView(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_VALUES_COMPASS);
		for (const leaf of leaves) {
			if (leaf.view instanceof ValuesCompassView) {
				leaf.view.render();
			}
		}
	}
}