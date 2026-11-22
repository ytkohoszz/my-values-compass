import { MarkdownRenderChild, Notice, setIcon } from "obsidian";
import type ValuesCompassPlugin from "./main";
import { formatLocalDateKey } from "./store";

type WidgetMode = "today" | "focus" | "pulse";

function parseWidgetMode(source: string): WidgetMode {
	const raw = source.trim().toLowerCase();
	if (!raw) return "today";

	const match = raw.match(/(?:mode\s*:\s*)?(today|focus|pulse)/);
	const mode = match?.[1];
	if (mode === "focus" || mode === "pulse") return mode;
	return "today";
}

export class ValuesCompassWidget extends MarkdownRenderChild {
	private plugin: ValuesCompassPlugin;
	private mode: WidgetMode;
	private unsubscribe: (() => void) | null = null;
	private selectedDomainId = "";
	private isNewStep = false;

	constructor(
		containerEl: HTMLElement,
		plugin: ValuesCompassPlugin,
		source: string
	) {
		super(containerEl);
		this.plugin = plugin;
		this.mode = parseWidgetMode(source);
	}

	onload(): void {
		this.unsubscribe = this.plugin.store.subscribe(() => {
			this.render();
		});
		this.render();
	}

	onunload(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.containerEl.empty();
	}

	private ensureDomainId(): string {
		const visible = this.plugin.store.getDomains(false);
		if (visible.length === 0) return "";
		if (visible.some((d) => d.id === this.selectedDomainId)) {
			return this.selectedDomainId;
		}
		const fallback = this.plugin.store.getFocusDomains()[0] ?? visible[0];
		if (!fallback) return "";
		this.selectedDomainId = fallback.id;
		return this.selectedDomainId;
	}

	private render(): void {
		this.containerEl.empty();

		const root = this.containerEl.createDiv({ cls: "vc-root vc-widget" });
		const island = root.createDiv({ cls: "vc-island vc-widget-island" });

		// Общая компактная шапка виджета
		const head = island.createDiv({ cls: "vc-widget-head" });
		const titleGroup = head.createDiv({ cls: "vc-focus-title-group" });
		const ico = titleGroup.createSpan({ cls: "vc-domain-icon" });
		setIcon(ico, "compass");

		const titleMap: Record<WidgetMode, string> = {
			today: "Компас ценностей",
			focus: "Фокус ценностей",
			pulse: "Ритм ценностей",
		};
		titleGroup.createSpan({ cls: "vc-widget-title", text: titleMap[this.mode] });

		const rightGroup = head.createDiv({ cls: "vc-widget-head-right" });
		const todayCount = this.plugin.store.getLogsByDate(formatLocalDateKey()).length;
		rightGroup.createSpan({
			cls: "vc-count-badge",
			text: String(todayCount),
			attr: { title: "Действий сегодня" },
		});

		const openBtn = rightGroup.createEl("button", {
			cls: "vc-btn vc-btn-icon",
			attr: { type: "button", title: "Открыть Компас ценностей" },
		});
		setIcon(openBtn, "arrow-up-right");
		openBtn.addEventListener("click", () => {
			const targetTab = this.mode === "pulse" ? "analytics" : "today";
			void this.plugin.activateView(targetTab);
		});

		if (this.mode === "today") {
			this.renderTodayBody(island);
		} else if (this.mode === "focus") {
			this.renderFocusBody(island);
		} else {
			this.renderPulseBody(island);
		}
	}

	private renderTodayBody(container: HTMLElement): void {
		const store = this.plugin.store;
		const focusDomains = store.getFocusDomains();
		const selectedDomainId = this.ensureDomainId();
		const todayKey = formatLocalDateKey();

		if (focusDomains.length > 0) {
			const focusBar = container.createDiv({ cls: "vc-widget-focus-strip" });
			for (const d of focusDomains) {
				const item = focusBar.createDiv({ cls: "vc-subcard vc-widget-focus-item" });
				const top = item.createDiv({ cls: "vc-widget-focus-top" });
				top.createSpan({ cls: "vc-focus-dot" });
				top.createSpan({ cls: "vc-widget-focus-name", text: d.name });
				if (d.compassSummary) {
					item.createDiv({
						cls: "vc-widget-focus-summary",
						text: d.compassSummary,
					});
				}
			}
		}

		// Быстрый ввод
		const form = container.createDiv({ cls: "vc-quick-form" });
		const input = form.createEl("input", {
			cls: "vc-input",
			attr: { type: "text", placeholder: "Записать ценностное действие..." },
		});

		const newStepBtn = form.createEl("button", {
			cls: `vc-btn vc-chip vc-newstep-toggle${this.isNewStep ? " is-active" : ""}`,
			attr: { type: "button", title: "Новый шаг" },
		});
		const star = newStepBtn.createSpan({ cls: "vc-chip-icon" });
		setIcon(star, "sparkles");
		newStepBtn.addEventListener("click", () => {
			this.isNewStep = !this.isNewStep;
			newStepBtn.toggleClass("is-active", this.isNewStep);
		});

		const submitBtn = form.createEl("button", {
			cls: "vc-btn vc-btn-cta vc-quick-submit",
			attr: { type: "button", "aria-label": "Добавить действие" },
		});
		setIcon(submitBtn, "arrow-up");

		const submit = async () => {
			const text = input.value.trim();
			if (!text || !selectedDomainId) return;
			await store.addLog({
				domainId: this.selectedDomainId || selectedDomainId,
				text,
				isNewStep: this.isNewStep,
				date: todayKey,
			});
			this.isNewStep = false;
			new Notice("Действие записано");
		};

		submitBtn.addEventListener("click", () => {
			void submit();
		});
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void submit();
			}
		});

		// Компактные чипы сфер (сначала фокусные)
		const domains = [...store.getDomains(false)].sort((a, b) =>
			a.isFocus === b.isFocus ? 0 : a.isFocus ? -1 : 1
		);
		const chips = container.createDiv({ cls: "vc-chips-row vc-widget-chips" });
		for (const d of domains) {
			const chip = chips.createEl("button", {
				cls: `vc-btn vc-chip${d.id === selectedDomainId ? " is-active" : ""}`,
				attr: { type: "button" },
			});
			if (d.isFocus) chip.createSpan({ cls: "vc-focus-dot" });
			chip.createSpan({ text: d.name });
			chip.addEventListener("click", () => {
				this.selectedDomainId = d.id;
				chips.querySelectorAll(".vc-chip").forEach((el) => el.removeClass("is-active"));
				chip.addClass("is-active");
			});
		}

		// Мини-ритм 14 дней
		this.renderMiniStrip(container);
	}

	private renderFocusBody(container: HTMLElement): void {
		const store = this.plugin.store;
		const focusDomains = store.getFocusDomains();
		const todayKey = formatLocalDateKey();

		if (focusDomains.length === 0) {
			const empty = container.createDiv({ cls: "vc-empty-box" });
			empty.createDiv({
				cls: "vc-empty-text",
				text: "Фокус-сфера не выбрана. Открой «Карту» и отметь 1–2 сферы.",
			});
			return;
		}

		const stack = container.createDiv({ cls: "vc-focus-stack" });
		for (const domain of focusDomains) {
			const card = stack.createDiv({ cls: "vc-subcard vc-focus-card" });

			const top = card.createDiv({ cls: "vc-focus-title-group" });
			const ico = top.createSpan({ cls: "vc-domain-icon" });
			setIcon(ico, domain.icon);
			top.createSpan({ cls: "vc-focus-domain-name", text: domain.name });

			if (domain.compassSummary) {
				card.createDiv({ cls: "vc-compass-quote", text: domain.compassSummary });
			}

			if (domain.qualities.length > 0) {
				const qRow = card.createDiv({ cls: "vc-qualities-row" });
				for (const q of domain.qualities) {
					qRow.createSpan({ cls: "vc-tag-pill", text: q });
				}
			}

			const goals = store
				.getGoalsByDomain(domain.id)
				.filter(
					(g) =>
						g.status === "active" &&
						(g.horizon === "immediate" || g.horizon === "short")
				);

			if (goals.length > 0) {
				const goalsWrap = card.createDiv({ cls: "vc-today-goals" });
				for (const goal of goals) {
					const gRow = goalsWrap.createDiv({ cls: "vc-today-goal-item" });
					gRow.createDiv({ cls: "vc-today-goal-title", text: goal.title });

					if (goal.steps.length > 0) {
						const stepsEl = gRow.createDiv({ cls: "vc-steps-list" });
						for (const step of goal.steps) {
							const stepRow = stepsEl.createDiv({
								cls: `vc-step-row${step.done ? " is-done" : ""}`,
							});
							const cb = stepRow.createEl("input", {
								cls: "vc-checkbox",
								attr: { type: "checkbox" },
							});
							cb.checked = step.done;
							stepRow.createSpan({ cls: "vc-step-text", text: step.text });

							cb.addEventListener("change", async () => {
								const done = await store.toggleGoalStep(goal.id, step.id);
								if (done) {
									await store.addLog({
										domainId: domain.id,
										goalId: goal.id,
										text: step.text,
										isNewStep: false,
										date: todayKey,
									});
									new Notice("Шаг выполнен и записан в лог");
								}
							});
						}
					}
				}
			}
		}
	}

	private renderPulseBody(container: HTMLElement): void {
		const summary = this.plugin.store.getPeriodSummary(30);

		const kpi = container.createDiv({ cls: "vc-widget-kpi-row" });
		const metrics: Array<[string, string]> = [
			[String(summary.totalLogs), "За 30 дн."],
			[String(summary.newSteps), "Новых шагов"],
			[String(summary.activeDays), "Активных дней"],
		];
		for (const [val, lbl] of metrics) {
			const tile = kpi.createDiv({ cls: "vc-subcard vc-widget-kpi-tile" });
			tile.createDiv({ cls: "vc-widget-kpi-val", text: val });
			tile.createDiv({ cls: "vc-kpi-label", text: lbl });
		}

		this.renderMiniStrip(container);
	}

	private renderMiniStrip(container: HTMLElement): void {
		const cells = this.plugin.store.getHeatmap(3).slice(-14);
		const row = container.createDiv({ cls: "vc-widget-pulse-row" });
		row.createSpan({ cls: "vc-muted-meta", text: "14 дней" });

		const strip = row.createDiv({ cls: "vc-widget-pulse-cells" });
		for (const cell of cells) {
			const sq = strip.createDiv({
				cls: `vc-heat-cell vc-heat-lvl-${cell.level}`,
				attr: {
					title: `${cell.date}: ${cell.count} действ.${
						cell.newSteps > 0 ? ` (новых: ${cell.newSteps})` : ""
					}`,
				},
			});
			if (cell.newSteps > 0) sq.addClass("has-new-step");
		}
	}
}