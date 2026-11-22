import { Notice, setIcon } from "obsidian";
import { HORIZON_LIST } from "../defaults";
import { formatLocalDateKey } from "../store";
import type { ValuesCompassView } from "../view";

export function renderTodayTab(container: HTMLElement, view: ValuesCompassView): void {
	const store = view.plugin.store;
	const todayKey = formatLocalDateKey();
	const visibleDomains = store.getDomains(false);
	const focusDomains = store.getFocusDomains();
	const selectedDomainId = view.ensureSelectedLogDomain();

	// 1. Остров быстрого ввода действия
	const logIsland = container.createDiv({ cls: "vc-island vc-quick-island" });

	const headerRow = logIsland.createDiv({ cls: "vc-section-head" });
	headerRow.createEl("h2", { cls: "vc-section-title", text: "Действие по ценностям" });
	headerRow.createSpan({ cls: "vc-date-badge", text: formatHumanDate(todayKey) });

	const formRow = logIsland.createDiv({ cls: "vc-quick-form" });
	const input = formRow.createEl("input", {
		cls: "vc-input vc-quick-input",
		attr: {
			type: "text",
			placeholder: "Что я сделал сегодня в согласии со своими ценностями?",
		},
	});

	const newStepBtn = formRow.createEl("button", {
		cls: `vc-btn vc-chip vc-newstep-toggle${view.uiState.isNewStep ? " is-active" : ""}`,
		attr: {
			type: "button",
			title: "Отметить, если попробовал что-то новое",
		},
	});
	const starSpan = newStepBtn.createSpan({ cls: "vc-chip-icon" });
	setIcon(starSpan, "sparkles");
	newStepBtn.createSpan({ text: "Новый шаг" });

	newStepBtn.addEventListener("click", () => {
		view.uiState.isNewStep = !view.uiState.isNewStep;
		newStepBtn.toggleClass("is-active", view.uiState.isNewStep);
	});

	const submitBtn = formRow.createEl("button", {
		cls: "vc-btn vc-btn-cta vc-quick-submit",
		attr: { type: "button", "aria-label": "Добавить действие" },
	});
	setIcon(submitBtn, "arrow-up");

	const submitAction = async () => {
		const text = input.value.trim();
		if (!text || !selectedDomainId) return;
		await store.addLog({
			domainId: view.uiState.selectedLogDomainId || selectedDomainId,
			text,
			isNewStep: view.uiState.isNewStep,
			date: todayKey,
		});
		view.uiState.isNewStep = false;
	};

	submitBtn.addEventListener("click", () => {
		void submitAction();
	});

	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void submitAction();
		}
	});

	// Ряд выбора сферы (сначала Active Focus)
	const sortedDomains = [...visibleDomains].sort((a, b) => {
		if (a.isFocus !== b.isFocus) return a.isFocus ? -1 : 1;
		return 0;
	});

	const chipsWrap = logIsland.createDiv({ cls: "vc-chips-row" });
	for (const domain of sortedDomains) {
		const chip = chipsWrap.createEl("button", {
			cls: `vc-btn vc-chip${domain.id === selectedDomainId ? " is-active" : ""}`,
			attr: { type: "button" },
		});
		if (domain.isFocus) {
			chip.createSpan({ cls: "vc-focus-dot", attr: { title: "Активный фокус" } });
		}
		chip.createSpan({ text: domain.name });
		chip.addEventListener("click", () => {
			view.uiState.selectedLogDomainId = domain.id;
			chipsWrap.querySelectorAll(".vc-chip").forEach((el) => el.removeClass("is-active"));
			chip.addClass("is-active");
		});
	}

	// 2. Остров «Фокус сейчас»
	const focusIsland = container.createDiv({ cls: "vc-island" });
	const focusHead = focusIsland.createDiv({ cls: "vc-section-head" });
	focusHead.createEl("h2", { cls: "vc-section-title", text: "Фокус сейчас" });

	const openMapBtn = focusHead.createEl("button", {
		cls: "vc-btn vc-btn-subtle",
		text: "Настроить карту",
		attr: { type: "button" },
	});
	openMapBtn.addEventListener("click", () => {
		view.switchTab("map");
	});

	if (focusDomains.length === 0) {
		const empty = focusIsland.createDiv({ cls: "vc-empty-box" });
		empty.createDiv({
			cls: "vc-empty-text",
			text: "Выбери 1–2 сферы на «Карте» для активного фокуса. В ACT лучше двигаться по одной сфере за раз, чтобы не распыляться.",
		});
	} else {
		const focusList = focusIsland.createDiv({ cls: "vc-focus-stack" });

		for (const domain of focusDomains) {
			const card = focusList.createDiv({ cls: "vc-subcard vc-focus-card" });

			const cardTop = card.createDiv({ cls: "vc-focus-card-head" });
			const titleGroup = cardTop.createDiv({ cls: "vc-focus-title-group" });
			const ico = titleGroup.createSpan({ cls: "vc-domain-icon" });
			setIcon(ico, domain.icon);
			titleGroup.createSpan({ cls: "vc-focus-domain-name", text: domain.name });

			const inspectBtn = cardTop.createEl("button", {
				cls: "vc-btn vc-btn-icon",
				attr: { type: "button", title: "Открыть сферу на Карте" },
			});
			setIcon(inspectBtn, "arrow-up-right");
			inspectBtn.addEventListener("click", () => {
				view.uiState.selectedMapDomainId = domain.id;
				view.switchTab("map");
			});

			if (domain.compassSummary) {
				card.createDiv({ cls: "vc-compass-quote", text: domain.compassSummary });
			} else {
				card.createDiv({
					cls: "vc-muted-hint",
					text: "Компас сферы пока пуст — открой сферу на Карте, чтобы сформулировать направление.",
				});
			}

			if (domain.qualities.length > 0) {
				const qRow = card.createDiv({ cls: "vc-qualities-row" });
				for (const q of domain.qualities) {
					qRow.createSpan({ cls: "vc-tag-pill", text: q });
				}
			}

			// Ближайшие цели (immediate + short)
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
					const gHead = gRow.createDiv({ cls: "vc-today-goal-head" });

					const hMeta = HORIZON_LIST.find((h) => h.id === goal.horizon);
					gHead.createSpan({
						cls: `vc-horizon-tag vc-horizon-${goal.horizon}`,
						text: hMeta?.shortLabel ?? goal.horizon,
					});
					gHead.createSpan({ cls: "vc-today-goal-title", text: goal.title });

					const quickLogGoalBtn = gHead.createEl("button", {
						cls: "vc-btn vc-btn-icon vc-goal-log-btn",
						attr: { type: "button", title: "Записать шаг по цели в сегодняшний лог" },
					});
					setIcon(quickLogGoalBtn, "plus");
					quickLogGoalBtn.addEventListener("click", async () => {
						await store.addLog({
							domainId: domain.id,
							goalId: goal.id,
							text: goal.title,
							isNewStep: false,
							date: todayKey,
						});
						new Notice("Действие записано в лог за сегодня");
					});

					if (goal.whenWhere) {
						gRow.createDiv({ cls: "vc-goal-meta", text: goal.whenWhere });
					}

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
								const isNowDone = await store.toggleGoalStep(goal.id, step.id);
								if (isNowDone) {
									await store.addLog({
										domainId: domain.id,
										goalId: goal.id,
										text: step.text,
										isNewStep: false,
										date: todayKey,
									});
									new Notice("Шаг выполнен и добавлен в лог за сегодня");
								}
							});
						}
					}
				}
			}
		}
	}

	// 3. Остров «За сегодня» + Момент присутствия
	const todayIsland = container.createDiv({ cls: "vc-island" });
	const todayLogs = store.getLogsByDate(todayKey);

	const todayHead = todayIsland.createDiv({ cls: "vc-section-head" });
	todayHead.createEl("h2", { cls: "vc-section-title", text: "За сегодня" });
	todayHead.createSpan({
		cls: "vc-count-badge",
		text: String(todayLogs.length),
	});

	if (todayLogs.length === 0) {
		const empty = todayIsland.createDiv({ cls: "vc-empty-box" });
		empty.createDiv({
			cls: "vc-empty-text",
			text: "Пока пусто. Даже один небольшой осознанный поступок уже меняет направление дня.",
		});
	} else {
		const list = todayIsland.createDiv({ cls: "vc-log-list" });
		for (const entry of todayLogs) {
			const domain = store.getDomainById(entry.domainId);
			const row = list.createDiv({ cls: "vc-subcard vc-log-row" });

			const main = row.createDiv({ cls: "vc-log-main" });
			const meta = main.createDiv({ cls: "vc-log-meta" });
			meta.createSpan({
				cls: "vc-tag-pill",
				text: domain?.name ?? "Сфера",
			});
			if (entry.isNewStep) {
				meta.createSpan({ cls: "vc-newstep-badge", text: "Новый шаг" });
			}
			main.createDiv({ cls: "vc-log-text", text: entry.text });

			const delBtn = row.createEl("button", {
				cls: "vc-btn vc-btn-icon vc-row-action",
				attr: { type: "button", title: "Удалить запись" },
			});
			setIcon(delBtn, "trash-2");
			delBtn.addEventListener("click", () => {
				void store.deleteLog(entry.id);
			});
		}
	}

	// Разделитель и Момент присутствия (Savoring — Глава 29)
	todayIsland.createEl("hr", { cls: "vc-hr" });

	const savWrap = todayIsland.createDiv({ cls: "vc-savoring-wrap" });
	const savHead = savWrap.createDiv({ cls: "vc-savoring-head" });
	const savIco = savHead.createSpan({ cls: "vc-savoring-icon" });
	setIcon(savIco, "eye");
	savHead.createSpan({ cls: "vc-savoring-label", text: "Момент присутствия" });

	const currentSavoring = store.getSavoringByDate(todayKey);
	const savInput = savWrap.createEl("input", {
		cls: "vc-input vc-savoring-input",
		attr: {
			type: "text",
			placeholder: "Что сегодня удалось по-настоящему заметить, прожить или оценить?",
		},
	});
	savInput.value = currentSavoring?.text ?? "";

	const commitSavoring = () => {
		const val = savInput.value.trim();
		if (val !== (currentSavoring?.text ?? "")) {
			void store.saveSavoring(val, todayKey);
		}
	};

	savInput.addEventListener("blur", commitSavoring);
	savInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			savInput.blur();
		}
	});
}

function formatHumanDate(dateKey: string): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
	return dt.toLocaleDateString("ru-RU", {
		day: "numeric",
		month: "long",
		weekday: "short",
	});
}