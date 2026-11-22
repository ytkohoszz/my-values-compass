import { App, Modal, Notice, setIcon } from "obsidian";
import { DEEP_CLARIFICATION_PROMPTS, FEAR_ITEMS } from "../defaults";
import { ValuesStore } from "../store";
import { ValueGoal } from "../types";

export type ReviewTabId = "fear" | "unpack" | "rehearsal" | "clarify";

export interface ReviewModalOptions {
	initialTab?: ReviewTabId;
	goal?: ValueGoal;
	domainId?: string;
}

export class ReviewModal extends Modal {
	private store: ValuesStore;
	private activeTab: ReviewTabId;
	private goal?: ValueGoal;
	private domainId: string;

	private selectedFearId: string = "fusion";
	private rehearsalDuration = 60;
	private rehearsalLeft = 60;
	private rehearsalRunning = false;
	private timerHandle: number | null = null;

	constructor(app: App, store: ValuesStore, options: ReviewModalOptions = {}) {
		super(app);
		this.store = store;
		this.activeTab = options.initialTab ?? "fear";
		this.goal = options.goal;
		const fallbackDomain =
			options.goal?.domainId ??
			options.domainId ??
			store.getFocusDomains()[0]?.id ??
			store.getDomains(false)[0]?.id ??
			"";
		this.domainId = fallbackDomain;
	}

	onOpen(): void {
		this.modalEl.addClass("vc-modal");
		this.render();
	}

	onClose(): void {
		this.stopTimer();
		this.contentEl.empty();
	}

	private stopTimer(): void {
		if (this.timerHandle !== null) {
			window.clearInterval(this.timerHandle);
			this.timerHandle = null;
		}
		this.rehearsalRunning = false;
	}

	private render(): void {
		this.stopTimer();
		this.contentEl.empty();

		const root = this.contentEl.createDiv({ cls: "vc-root vc-modal-root" });

		const head = root.createDiv({ cls: "vc-modal-head" });
		head.createEl("h2", { cls: "vc-modal-title", text: "Разбор" });

		// Контекст цели, если модал открыт из конкретной цели
		if (this.goal) {
			const domain = this.store.getDomainById(this.goal.domainId);
			const ctx = head.createDiv({ cls: "vc-subcard vc-review-ctx" });
			ctx.createSpan({ cls: "vc-tag-pill", text: domain?.name ?? "Сфера" });
			ctx.createSpan({ cls: "vc-review-ctx-title", text: this.goal.title });
		}

		// Сегментный переключатель режимов
		const seg = head.createDiv({ cls: "vc-segmented vc-modal-seg" });
		const tabs: Array<{ id: ReviewTabId; label: string }> = [
			{ id: "fear", label: "FEAR" },
			{ id: "unpack", label: "Распаковка" },
			{ id: "rehearsal", label: "Репетиция" },
			{ id: "clarify", label: "Уточнение" },
		];

		for (const t of tabs) {
			const btn = seg.createEl("button", {
				cls: `vc-btn vc-seg-item${this.activeTab === t.id ? " is-active" : ""}`,
				text: t.label,
				attr: { type: "button" },
			});
			btn.addEventListener("click", () => {
				if (this.activeTab !== t.id) {
					this.activeTab = t.id;
					this.render();
				}
			});
		}

		const scroll = root.createDiv({ cls: "vc-modal-scroll" });

		if (this.activeTab === "fear") {
			this.renderFearTab(scroll);
		} else if (this.activeTab === "unpack") {
			this.renderUnpackTab(scroll);
		} else if (this.activeTab === "rehearsal") {
			this.renderRehearsalTab(scroll);
		} else {
			this.renderClarifyTab(scroll);
		}
	}

	private renderFearTab(container: HTMLElement): void {
		container.createDiv({
			cls: "vc-modal-subtitle",
			text: "Выбери барьер, который сейчас тормозит движение (Глава 30):",
		});

		const grid = container.createDiv({ cls: "vc-fear-grid" });
		for (const item of FEAR_ITEMS) {
			const card = grid.createDiv({
				cls: `vc-subcard vc-fear-card${
					this.selectedFearId === item.id ? " is-active" : ""
				}`,
			});
			const top = card.createDiv({ cls: "vc-fear-card-top" });
			top.createSpan({ cls: "vc-fear-letter", text: item.letter });
			top.createSpan({ cls: "vc-fear-name", text: item.title });
			card.createDiv({ cls: "vc-fear-short", text: item.shortDesc });

			card.addEventListener("click", () => {
				this.selectedFearId = item.id;
				this.render();
			});
		}

		const active =
			FEAR_ITEMS.find((i) => i.id === this.selectedFearId) ?? FEAR_ITEMS[0];
		if (!active) return;

		const detail = container.createDiv({ cls: "vc-island vc-fear-detail" });
		detail.createDiv({ cls: "vc-insp-sec-title", text: active.actionTitle });
		detail.createDiv({ cls: "vc-empty-text", text: active.counterMove });

		if (active.id === "avoidance") {
			const goBtn = detail.createEl("button", {
				cls: "vc-btn vc-btn-cta",
				text: "Перейти к 60-сек репетиции",
				attr: { type: "button" },
			});
			goBtn.addEventListener("click", () => {
				this.activeTab = "rehearsal";
				this.render();
			});
		} else if (active.id === "remoteness") {
			const goBtn = detail.createEl("button", {
				cls: "vc-btn vc-btn-cta",
				text: "Распаковать цель до ценности",
				attr: { type: "button" },
			});
			goBtn.addEventListener("click", () => {
				this.activeTab = "unpack";
				this.render();
			});
		} else {
			// Fusion / Expectations -> быстрое создание микро-шага прямо здесь
			const microRow = detail.createDiv({ cls: "vc-quick-form" });
			const microInput = microRow.createEl("input", {
				cls: "vc-input",
				attr: {
					type: "text",
					placeholder:
						active.id === "expectations"
							? "Упрощённый шаг на 5 минут прямо на сегодня..."
							: "Маленькое действие, которое сделаю, взяв эту мысль с собой...",
				},
			});
			const addBtn = microRow.createEl("button", {
				cls: "vc-btn vc-btn-cta",
				text: this.goal ? "В план цели" : "Цель на сегодня",
				attr: { type: "button" },
			});

			const saveMicro = async () => {
				const txt = microInput.value.trim();
				if (!txt) return;
				if (this.goal) {
					await this.store.addGoalStep(this.goal.id, txt);
					new Notice("Микро-шаг добавлен в план цели");
				} else if (this.domainId) {
					await this.store.addGoal({
						domainId: this.domainId,
						horizon: "immediate",
						title: txt,
					});
					new Notice("Микро-цель на сегодня добавлена");
				}
				this.close();
			};

			addBtn.addEventListener("click", () => {
				void saveMicro();
			});
			microInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void saveMicro();
				}
			});
		}
	}

	private renderUnpackTab(container: HTMLElement): void {
		container.createDiv({
			cls: "vc-modal-subtitle",
			text: "Распаковка цели в ценность (Глава 28): чтобы жить наполнением уже сейчас, а не ждать далёкого результата.",
		});

		const domains = this.store.getDomains(false);
		let selectedDomainId = this.domainId;

		if (!this.goal && domains.length > 0) {
			const chips = container.createDiv({ cls: "vc-chips-row" });
			for (const d of domains) {
				const chip = chips.createEl("button", {
					cls: `vc-btn vc-chip${d.id === selectedDomainId ? " is-active" : ""}`,
					text: d.name,
					attr: { type: "button" },
				});
				chip.addEventListener("click", () => {
					selectedDomainId = d.id;
					this.domainId = d.id;
					chips.querySelectorAll(".vc-chip").forEach((el) => el.removeClass("is-active"));
					chip.addClass("is-active");
				});
			}
		}

		const f1 = container.createDiv({ cls: "vc-q-block" });
		f1.createDiv({ cls: "vc-q-label", text: "1. Какой цели хочется достичь?" });
		const goalInput = f1.createEl("input", {
			cls: "vc-input",
			attr: { type: "text", placeholder: "Например: заработать X, защитить проект, купить жильё" },
		});
		goalInput.value = this.goal?.title ?? "";

		const f2 = container.createDiv({ cls: "vc-q-block" });
		f2.createDiv({
			cls: "vc-q-label",
			text: "2. Что эта цель позволит мне делать по-настоящему значимого?",
		});
		const enableInput = f2.createEl("textarea", {
			cls: "vc-textarea",
			attr: {
				rows: "2",
				placeholder: "Если я уже достиг этого, что ценного появляется в моей жизни?",
			},
		});

		const f3 = container.createDiv({ cls: "vc-q-block" });
		f3.createDiv({
			cls: "vc-q-label",
			text: "3. Какая корневая ценность стоит за этим?",
		});
		const valInput = f3.createEl("input", {
			cls: "vc-input",
			attr: {
				type: "text",
				placeholder: "Например: забота о близких, искренность, исследование нового, свобода",
			},
		});
		valInput.value = this.goal?.underlyingValue ?? "";

		const f4 = container.createDiv({ cls: "vc-q-block" });
		f4.createDiv({
			cls: "vc-q-label",
			text: "4. Какой маленький шаг в сторону этой ценности доступен уже сегодня?",
		});
		const stepInput = f4.createEl("input", {
			cls: "vc-input",
			attr: {
				type: "text",
				placeholder: "Конкретное действие без ожидания далёкой цели...",
			},
		});

		const footer = container.createDiv({ cls: "vc-modal-footer" });
		const saveBtn = footer.createEl("button", {
			cls: "vc-btn vc-btn-cta",
			text: "Сохранить и создать шаг на сегодня",
			attr: { type: "button" },
		});

		saveBtn.addEventListener("click", async () => {
			const coreVal = valInput.value.trim() || enableInput.value.trim();
			const todayStep = stepInput.value.trim();

			if (this.goal && coreVal) {
				await this.store.updateGoal(this.goal.id, {
					underlyingValue: coreVal,
				});
			}

			if (todayStep && selectedDomainId) {
				await this.store.addGoal({
					domainId: selectedDomainId,
					horizon: "immediate",
					title: todayStep,
					underlyingValue: coreVal,
				});
			}

			if (!coreVal && !todayStep) {
				new Notice("Заполни хотя бы корневую ценность или шаг на сегодня");
				return;
			}

			new Notice("Ценность зафиксирована");
			this.close();
		});
	}

	private renderRehearsalTab(container: HTMLElement): void {
		const box = container.createDiv({ cls: "vc-island vc-rehearsal-box" });

		box.createDiv({
			cls: "vc-rehearsal-guide",
			text: "Закрой глаза и представь свои конкретные действия и слова — не чувство уверенности или спокойствия. Оставь место для дискомфорта и продолжай действовать в выбранном направлении.",
		});

		const durRow = box.createDiv({ cls: "vc-chips-row vc-center-row" });
		for (const sec of [45, 60, 90]) {
			const chip = durRow.createEl("button", {
				cls: `vc-btn vc-chip${this.rehearsalDuration === sec ? " is-active" : ""}`,
				text: `${sec} сек`,
				attr: { type: "button" },
			});
			chip.addEventListener("click", () => {
				this.rehearsalDuration = sec;
				this.rehearsalLeft = sec;
				this.render();
			});
		}

		const display = box.createDiv({
			cls: "vc-timer-display",
			text: formatTimer(this.rehearsalLeft),
		});

		const barTrack = box.createDiv({ cls: "vc-share-track vc-timer-track" });
		const barFill = barTrack.createDiv({ cls: "vc-share-fill" });
		const updateVisuals = () => {
			display.setText(formatTimer(this.rehearsalLeft));
			const pct =
				this.rehearsalDuration > 0
					? ((this.rehearsalDuration - this.rehearsalLeft) /
							this.rehearsalDuration) *
					  100
					: 0;
			barFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
		};
		updateVisuals();

		const controls = box.createDiv({ cls: "vc-timer-controls" });
		const toggleBtn = controls.createEl("button", {
			cls: "vc-btn vc-btn-cta",
			text: "Начать репетицию",
			attr: { type: "button" },
		});

		const resetBtn = controls.createEl("button", {
			cls: "vc-btn vc-btn-icon",
			attr: { type: "button", title: "Сбросить таймер" },
		});
		setIcon(resetBtn, "rotate-ccw");

		toggleBtn.addEventListener("click", () => {
			if (this.rehearsalRunning) {
				this.stopTimer();
				toggleBtn.setText("Продолжить");
				return;
			}

			if (this.rehearsalLeft <= 0) {
				this.rehearsalLeft = this.rehearsalDuration;
				updateVisuals();
			}

			this.rehearsalRunning = true;
			toggleBtn.setText("Пауза");

			this.timerHandle = window.setInterval(() => {
				this.rehearsalLeft -= 1;
				updateVisuals();
				if (this.rehearsalLeft <= 0) {
					this.stopTimer();
					toggleBtn.setText("Повторить");
					new Notice("Репетиция завершена — пора сделать первый шаг");
				}
			}, 1000);
		});

		resetBtn.addEventListener("click", () => {
			this.stopTimer();
			this.rehearsalLeft = this.rehearsalDuration;
			toggleBtn.setText("Начать репетицию");
			updateVisuals();
		});
	}

	private renderClarifyTab(container: HTMLElement): void {
		container.createDiv({
			cls: "vc-modal-subtitle",
			text: "Вопросы из Главы 26 для снятия сомнений и конфликтов. Ответы сохраняются автоматически.",
		});

		const stack = container.createDiv({ cls: "vc-clarify-stack" });

		for (const item of DEEP_CLARIFICATION_PROMPTS) {
			const card = stack.createDiv({ cls: "vc-subcard vc-clarify-card" });
			const top = card.createDiv({ cls: "vc-insp-sec-head" });
			top.createDiv({ cls: "vc-insp-sec-title", text: item.title });
			const savedBadge = top.createSpan({ cls: "vc-muted-meta", text: "" });

			card.createDiv({ cls: "vc-prompt-line", text: item.question });

			const existing = this.store.getReflection(item.id);
			const area = card.createEl("textarea", {
				cls: "vc-textarea",
				attr: { rows: "3", placeholder: "Записать мысль..." },
			});
			area.value = existing?.text ?? "";

			area.addEventListener("blur", async () => {
				const next = area.value.trim();
				const prev = this.store.getReflection(item.id)?.text ?? "";
				if (next !== prev) {
					await this.store.saveReflection(item.id, item.title, next);
					savedBadge.setText(next ? "Сохранено" : "");
				}
			});
		}
	}
}

function formatTimer(seconds: number): string {
	const safe = Math.max(0, seconds);
	const m = Math.floor(safe / 60);
	const s = safe % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}