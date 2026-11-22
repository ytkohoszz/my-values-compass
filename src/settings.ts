import { App, PluginSettingTab, Setting } from "obsidian";
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
				"Путь к JSON-файлу внутри хранилища. Синхронизируется между устройствами."
			)
			.addText((text) =>
				text
					.setPlaceholder("_system/values-compass.json")
					.setValue(this.plugin.settings.dataFilePath)
					.onChange(async (value) => {
						const cleaned = value.trim() || "_system/values-compass.json";
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