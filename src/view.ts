import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { VIEW_TYPE_VALUES_COMPASS } from "./defaults";
import type ValuesCompassPlugin from "./main";
import { ReviewModal } from "./modals/reviewModal";
import { renderAnalyticsTab } from "./tabs/analyticsTab";
import { renderMapTab } from "./tabs/mapTab";
import { CompassTabId, GoalHorizon } from "./types";

export interface CompassUIState {
	activeTab: CompassTabId;
	selectedMapDomainId: string | null;
	isAddingDomain: boolean;
	newDomainIcon: string;
	editingDomainId: string | null;
	confirmDeleteDomainId: string | null;
	expandedGoalIds: Set<string>;
	addingGoalHorizon: GoalHorizon | null;
	showDoneGoals: boolean;
	analyticsDomainFilter: string; // "all" | domainId
	analyticsOnlyNewSteps: boolean;
}

export class ValuesCompassView extends ItemView {
	public plugin: ValuesCompassPlugin;
	public uiState: CompassUIState;
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ValuesCompassPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.uiState = {
			activeTab: "map",
			selectedMapDomainId: null,
			isAddingDomain: false,
			newDomainIcon: "compass",
			editingDomainId: null,
			confirmDeleteDomainId: null,
			expandedGoalIds: new Set<string>(),
			addingGoalHorizon: null,
			showDoneGoals: false,
			analyticsDomainFilter: "all",
			analyticsOnlyNewSteps: false,
		};
	}

	getViewType(): string {
		return VIEW_TYPE_VALUES_COMPASS;
	}

	getDisplayText(): string {
		return "Компас ценностей";
	}

	getIcon(): string {
		return "compass";
	}

	async onOpen(): Promise<void> {
		this.unsubscribe = this.plugin.store.subscribe(() => {
			this.render();
		});
		this.render();
	}

	async onClose(): Promise<void> {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.contentEl.empty();
	}

	public switchTab(tab: CompassTabId, domainId?: string): void {
		this.uiState.activeTab = tab;
		if (domainId) {
			this.uiState.selectedMapDomainId = domainId;
		}
		this.render();
	}

	public render(): void {
		const scrollContainer = this.contentEl.querySelector<HTMLElement>(".vc-scroll");
		const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

		this.contentEl.empty();
		this.contentEl.addClass("vc-view-content");

		const root = this.contentEl.createDiv({ cls: "vc-root" });

		// Верхний док-навигатор (Карта + Динамика + кнопка Разбор)
		const topbar = root.createDiv({ cls: "vc-topbar" });
		const segmented = topbar.createDiv({
			cls: "vc-segmented",
			attr: { role: "tablist" },
		});

		const tabs: Array<{ id: CompassTabId; label: string; icon: string }> = [
			{ id: "map", label: "Карта", icon: "compass" },
			{ id: "analytics", label: "Динамика", icon: "bar-chart-2" },
		];

		for (const t of tabs) {
			const btn = segmented.createEl("button", {
				cls: `vc-btn vc-seg-item${this.uiState.activeTab === t.id ? " is-active" : ""}`,
				attr: {
					type: "button",
					role: "tab",
					"aria-selected": String(this.uiState.activeTab === t.id),
				},
			});
			const ico = btn.createSpan({ cls: "vc-seg-icon" });
			setIcon(ico, t.icon);
			btn.createSpan({ cls: "vc-seg-label", text: t.label });

			btn.addEventListener("click", () => {
				if (this.uiState.activeTab !== t.id) {
					this.uiState.activeTab = t.id;
					this.render();
				}
			});
		}

		const reviewBtn = topbar.createEl("button", {
			cls: "vc-btn vc-btn-icon vc-topbar-review",
			attr: { type: "button", title: "Разбор (FEAR, распаковка, репетиция)" },
		});
		setIcon(reviewBtn, "life-buoy");
		reviewBtn.addEventListener("click", () => {
			new ReviewModal(this.app, this.plugin.store, {
				initialTab: "fear",
				domainId: this.uiState.selectedMapDomainId ?? undefined,
			}).open();
		});

		// Основная прокручиваемая область
		const scroll = root.createDiv({ cls: "vc-scroll" });
		const body = scroll.createDiv({ cls: "vc-body" });

		if (this.uiState.activeTab === "map") {
			renderMapTab(body, this);
		} else {
			renderAnalyticsTab(body, this);
		}

		if (prevScrollTop > 0) {
			scroll.scrollTop = prevScrollTop;
		}
	}
}