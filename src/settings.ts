import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_DATA_FILE_PATH } from "./defaults";
import type ValuesCompassPlugin from "./main";

export class ValuesCompassSettingTab extends PluginSettingTab {
	private plugin: ValuesCompassPlugin;

	constructor(app: App, plugin: ValuesCompassPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Файл хранения данных")
			.setDesc(
				"Путь к Markdown-файлу (.md) внутри хранилища. Синхронизируется через Obsidian Sync между всеми устройствами."
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_DATA_FILE_PATH)
					.setValue(this.plugin.settings.dataFilePath)
					.onChange(async (value) => {
						const cleaned = value.trim() || DEFAULT_DATA_FILE_PATH;
						this.plugin.settings.dataFilePath = cleaned;
						await this.plugin.saveSettings();
						this.plugin.store.setFilePath(cleaned);
						await this.plugin.store.load();
					})
			);

		new Setting(containerEl)
			.setName("Показывать скрытые сферы")
			.setDesc("Отображать скрытые жизненные сферы на вкладке «Карта».")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showHiddenDomains)
					.onChange(async (value) => {
						this.plugin.settings.showHiddenDomains = value;
						await this.plugin.saveSettings();
						this.plugin.refreshView();
					})
			);
	}
}