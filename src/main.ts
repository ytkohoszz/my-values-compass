import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, VIEW_TYPE_VALUES_COMPASS } from "./defaults";
import { ValuesCompassSettingTab } from "./settings";
import { ValuesStore } from "./store";
import { ValuesCompassSettings } from "./types";
import { ValuesCompassView } from "./view";

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
			void this.activateView("today");
		});

		this.addCommand({
			id: "open-values-compass",
			name: "Открыть Компас ценностей",
			callback: () => {
				void this.activateView("today");
			},
		});

		this.addCommand({
			id: "quick-log-value-action",
			name: "Записать ценностное действие",
			callback: () => {
				void this.activateView("today", true);
			},
		});

		this.addSettingTab(new ValuesCompassSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(async () => {
			await this.store.load();
		});
	}

	onunload(): void {
		// Obsidian очистит зарегистрированные ItemView автоматически
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<ValuesCompassSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	public async activateView(
		tab: "today" | "map" | "analytics" = "today",
		focusInput = false
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
			view.switchTab(tab, focusInput);
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