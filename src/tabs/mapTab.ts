import { Notice, setIcon } from "obsidian";
import {
	checkDeadPersonGoal,
	DOMAIN_PROMPTS,
	HORIZON_LIST,
} from "../defaults";
import { GoalHorizon, ValueDomain, ValueGoal } from "../types";
import type { ValuesCompassView } from "../view";

export function renderMapTab(container: HTMLElement, view: ValuesCompassView): void {
	const store = view.plugin.store;
	const showHidden = view.plugin.settings.showHiddenDomains;
	const domains = store.getDomains(showHidden);

	const selectedDomain = view.uiState.selectedMapDomainId
		? store.getDomainById(view.uiState.selectedMapDomainId) ?? null
		: null;

	const layout = container.createDiv({
		cls: `vc-map-layout${selectedDomain ? " has-inspector" : ""}`,
	});

	// Левая колонка: сетка 10 сфер
	const gridCol = layout.createDiv({ cls: "vc-map-grid-col" });

	const gridHead = gridCol.createDiv({ cls: "vc-section-head vc-map-head" });
	gridHead.createEl("h2", { cls: "vc-section-title", text: "Карта жизненных сфер" });

	const focusCount = store.getFocusDomains().length;
	gridHead.createSpan({
		cls: "vc-muted-meta",
		text: `В фокусе: ${focusCount}`,
	});

	const grid = gridCol.createDiv({ cls: "vc-domains-grid" });

	for (const domain of domains) {
		const isSelected = selectedDomain?.id === domain.id;
		const goalsCount = store
			.getGoalsByDomain(domain.id)
			.filter((g) => g.status === "active").length;
		const gap = domain.importance - domain.alignment;

		const card = grid.createDiv({
			cls: [
				"vc-island",
				"vc-domain-card",
				domain.isFocus ? "is-focus" : "",
				isSelected ? "is-selected" : "",
				domain.hidden ? "is-hidden-domain" : "",
			]
				.filter(Boolean)
				.join(" "),
		});

		card.addEventListener("click", () => {
			view.uiState.selectedMapDomainId = isSelected ? null : domain.id;
			view.uiState.addingGoalHorizon = null;
			view.uiState.showPrompts = false;
			view.render();
		});

		const top = card.createDiv({ cls: "vc-domain-card-top" });
		const left = top.createDiv({ cls: "vc-domain-title-wrap" });
		const ico = left.createSpan({ cls: "vc-domain-icon" });
		setIcon(ico, domain.icon);
		left.createSpan({ cls: "vc-domain-name", text: domain.name });

		const badges = top.createDiv({ cls: "vc-domain-badges" });
		if (domain.isFocus) {
			badges.createSpan({ cls: "vc-focus-pill", text: "Фокус" });
		}
		if (domain.hidden) {
			badges.createSpan({ cls: "vc-tag-pill", text: "Скрыта" });
		}

		if (domain.compassSummary) {
			card.createDiv({
				cls: "vc-domain-summary-preview",
				text: domain.compassSummary,
			});
		} else {
			card.createDiv({
				cls: "vc-domain-summary-empty",
				text: "Сформулировать компас...",
			});
		}

		// Двойная полоска: Важность (фон) vs Реальность (заливка)
		const meterBlock = card.createDiv({ cls: "vc-meter-block" });
		const meterLabels = meterBlock.createDiv({ cls: "vc-meter-labels" });
		meterLabels.createSpan({
			cls: "vc-meter-nums",
			text: `Реальность ${domain.alignment} / Важность ${domain.importance}`,
		});

		const rightMeta = meterLabels.createDiv({ cls: "vc-meter-right" });
		if (gap >= 3) {
			rightMeta.createSpan({
				cls: "vc-gap-pill is-high",
				text: `−${gap}`,
				attr: { title: "Заметный разрыв между важностью и текущими действиями" },
			});
		}
		if (goalsCount > 0) {
			rightMeta.createSpan({
				cls: "vc-goals-count",
				text: `Целей: ${goalsCount}`,
			});
		}

		const track = meterBlock.createDiv({ cls: "vc-dual-bar" });
		const impBar = track.createDiv({ cls: "vc-dual-bar-importance" });
		impBar.style.width = `${domain.importance * 10}%`;
		const alignBar = track.createDiv({ cls: "vc-dual-bar-alignment" });
		alignBar.style.width = `${domain.alignment * 10}%`;
	}

	// Правая панель / Лист инспектора сферы
	if (selectedDomain) {
		renderDomainInspector(layout, selectedDomain, view);
	}
}

function renderDomainInspector(
	parent: HTMLElement,
	domain: ValueDomain,
	view: ValuesCompassView
): void {
	const store = view.plugin.store;
	const inspector = parent.createDiv({ cls: "vc-inspector" });

	// Шапка инспектора
	const head = inspector.createDiv({ cls: "vc-inspector-head" });
	const titleWrap = head.createDiv({ cls: "vc-inspector-title-wrap" });
	const ico = titleWrap.createSpan({ cls: "vc-domain-icon" });
	setIcon(ico, domain.icon);
	titleWrap.createEl("h2", { cls: "vc-inspector-title", text: domain.name });

	const headActions = head.createDiv({ cls: "vc-inspector-actions" });

	const focusBtn = headActions.createEl("button", {
		cls: `vc-btn vc-chip${domain.isFocus ? " is-active" : ""}`,
		text: domain.isFocus ? "В фокусе" : "В фокус",
		attr: { type: "button" },
	});
	focusBtn.addEventListener("click", () => {
		void store.toggleDomainFocus(domain.id);
	});

	const hideBtn = headActions.createEl("button", {
		cls: "vc-btn vc-btn-icon",
		attr: {
			type: "button",
			title: domain.hidden ? "Показать сферу" : "Скрыть сферу",
		},
	});
	setIcon(hideBtn, domain.hidden ? "eye" : "eye-off");
	hideBtn.addEventListener("click", async () => {
		const willHide = !domain.hidden;
		await store.updateDomain(domain.id, {
			hidden: willHide,
			isFocus: willHide ? false : domain.isFocus,
		});
		if (willHide && !view.plugin.settings.showHiddenDomains) {
			view.uiState.selectedMapDomainId = null;
			view.render();
		}
	});

	const closeBtn = headActions.createEl("button", {
		cls: "vc-btn vc-btn-icon",
		attr: { type: "button", title: "Закрыть инспектор" },
	});
	setIcon(closeBtn, "x");
	closeBtn.addEventListener("click", () => {
		view.uiState.selectedMapDomainId = null;
		view.render();
	});

	const body = inspector.createDiv({ cls: "vc-inspector-body" });

	// Секция 1: Компас сферы
	const compassSec = body.createDiv({ cls: "vc-insp-section" });
	const compHead = compassSec.createDiv({ cls: "vc-insp-sec-head" });
	compHead.createEl("h3", { cls: "vc-insp-sec-title", text: "Компас" });

	const prompts = DOMAIN_PROMPTS[domain.id] ?? [];
	if (prompts.length > 0) {
		const promptToggle = compHead.createEl("button", {
			cls: "vc-btn vc-btn-subtle",
			text: view.uiState.showPrompts ? "Скрыть вопросы" : "Вопросы из книги",
			attr: { type: "button" },
		});
		promptToggle.addEventListener("click", () => {
			view.uiState.showPrompts = !view.uiState.showPrompts;
			view.render();
		});
	}

	if (view.uiState.showPrompts && prompts.length > 0) {
		const promptsBox = compassSec.createDiv({ cls: "vc-prompts-box" });
		for (const p of prompts) {
			promptsBox.createDiv({ cls: "vc-prompt-line", text: `• ${p}` });
		}
	}

	const summaryArea = compassSec.createEl("textarea", {
		cls: "vc-textarea",
		attr: {
			rows: "3",
			placeholder:
				"Каким я хочу быть в этой сфере? Что зависит именно от моих действий?",
		},
	});
	summaryArea.value = domain.compassSummary;
	summaryArea.addEventListener("blur", () => {
		const next = summaryArea.value.trim();
		if (next !== domain.compassSummary) {
			void store.updateDomain(domain.id, { compassSummary: next });
		}
	});

	// Качества (чипы)
	const qualWrap = compassSec.createDiv({ cls: "vc-qualities-editor" });
	const qualRow = qualWrap.createDiv({ cls: "vc-qualities-row" });

	for (const quality of domain.qualities) {
		const pill = qualRow.createSpan({ cls: "vc-tag-pill vc-removable-pill" });
		pill.createSpan({ text: quality });
		const rm = pill.createEl("button", {
			cls: "vc-btn vc-pill-remove",
			attr: { type: "button", "aria-label": `Удалить качество ${quality}` },
		});
		setIcon(rm, "x");
		rm.addEventListener("click", () => {
			const next = domain.qualities.filter((q) => q !== quality);
			void store.updateDomain(domain.id, { qualities: next });
		});
	}

	const qualInput = qualWrap.createEl("input", {
		cls: "vc-input vc-inline-add-input",
		attr: {
			type: "text",
			placeholder: "+ Качество (например: открытость, спокойствие) — Enter",
		},
	});
	qualInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const val = qualInput.value.trim();
			if (!val) return;
			if (!domain.qualities.includes(val)) {
				void store.updateDomain(domain.id, {
					qualities: [...domain.qualities, val],
				});
			} else {
				qualInput.value = "";
			}
		}
	});

	// Секция 2: Шкалы (Важность vs Реальность)
	const ratingsSec = body.createDiv({ cls: "vc-insp-section" });
	const ratHead = ratingsSec.createDiv({ cls: "vc-insp-sec-head" });
	ratHead.createEl("h3", { cls: "vc-insp-sec-title", text: "Оценка сферы" });
	const gapVal = domain.importance - domain.alignment;
	const gapLabel = ratHead.createSpan({
		cls: `vc-gap-pill${gapVal >= 3 ? " is-high" : ""}`,
		text: gapVal > 0 ? `Разрыв: −${gapVal}` : "В балансе",
	});

	const slidersGrid = ratingsSec.createDiv({ cls: "vc-sliders-grid" });

	const impRow = slidersGrid.createDiv({ cls: "vc-slider-row" });
	const impHead = impRow.createDiv({ cls: "vc-slider-head" });
	impHead.createSpan({ text: "Важность" });
	const impNum = impHead.createSpan({
		cls: "vc-slider-val",
		text: `${domain.importance} / 10`,
	});
	const impRange = impRow.createEl("input", {
		cls: "vc-range",
		attr: { type: "range", min: "1", max: "10", step: "1" },
	});
	impRange.value = String(domain.importance);

	const alignRow = slidersGrid.createDiv({ cls: "vc-slider-row" });
	const alignHead = alignRow.createDiv({ cls: "vc-slider-head" });
	alignHead.createSpan({ text: "Живу этим сейчас" });
	const alignNum = alignHead.createSpan({
		cls: "vc-slider-val",
		text: `${domain.alignment} / 10`,
	});
	const alignRange = alignRow.createEl("input", {
		cls: "vc-range",
		attr: { type: "range", min: "1", max: "10", step: "1" },
	});
	alignRange.value = String(domain.alignment);

	const updateGapPreview = () => {
		const i = Number(impRange.value);
		const a = Number(alignRange.value);
		impNum.setText(`${i} / 10`);
		alignNum.setText(`${a} / 10`);
		const g = i - a;
		gapLabel.setText(g > 0 ? `Разрыв: −${g}` : "В балансе");
		gapLabel.toggleClass("is-high", g >= 3);
	};

	impRange.addEventListener("input", updateGapPreview);
	alignRange.addEventListener("input", updateGapPreview);
	impRange.addEventListener("change", () => {
		void store.updateDomain(domain.id, { importance: Number(impRange.value) });
	});
	alignRange.addEventListener("change", () => {
		void store.updateDomain(domain.id, { alignment: Number(alignRange.value) });
	});

	// Секция 3: Лестница целей (4 горизонта)
	const goalsSec = body.createDiv({ cls: "vc-insp-section" });
	const goalsHead = goalsSec.createDiv({ cls: "vc-insp-sec-head" });
	goalsHead.createEl("h3", { cls: "vc-insp-sec-title", text: "Лестница целей" });

	const doneToggle = goalsHead.createEl("button", {
		cls: "vc-btn vc-btn-subtle",
		text: view.uiState.showDoneGoals ? "Скрыть завершённые" : "Показать завершённые",
		attr: { type: "button" },
	});
	doneToggle.addEventListener("click", () => {
		view.uiState.showDoneGoals = !view.uiState.showDoneGoals;
		view.render();
	});

	const ladder = goalsSec.createDiv({ cls: "vc-ladder" });

	for (const horizon of HORIZON_LIST) {
		const hBlock = ladder.createDiv({ cls: "vc-horizon-block" });
		const hHead = hBlock.createDiv({ cls: "vc-horizon-head" });

		const hTitleWrap = hHead.createDiv({ cls: "vc-horizon-title-wrap" });
		hTitleWrap.createSpan({
			cls: `vc-horizon-dot vc-dot-${horizon.id}`,
		});
		hTitleWrap.createSpan({ cls: "vc-horizon-title", text: horizon.label });

		const addBtn = hHead.createEl("button", {
			cls: "vc-btn vc-btn-icon",
			attr: { type: "button", title: `Добавить цель (${horizon.label})` },
		});
		setIcon(addBtn, "plus");
		addBtn.addEventListener("click", () => {
			view.uiState.addingGoalHorizon =
				view.uiState.addingGoalHorizon === horizon.id ? null : horizon.id;
			view.render();
		});

		// Инлайн-форма создания цели + детектор «цели мертвеца»
		if (view.uiState.addingGoalHorizon === horizon.id) {
			renderAddGoalForm(hBlock, domain.id, horizon.id, horizon.hint, view);
		}

		const goals = store
			.getGoalsByDomain(domain.id, horizon.id)
			.filter((g) => view.uiState.showDoneGoals || g.status !== "done");

		if (goals.length === 0 && view.uiState.addingGoalHorizon !== horizon.id) {
			hBlock.createDiv({
				cls: "vc-horizon-empty",
				text: horizon.hint,
			});
		} else {
			const gList = hBlock.createDiv({ cls: "vc-goals-stack" });
			for (const goal of goals) {
				renderGoalCard(gList, goal, view);
			}
		}
	}
}

function renderAddGoalForm(
	parent: HTMLElement,
	domainId: string,
	horizon: GoalHorizon,
	placeholder: string,
	view: ValuesCompassView
): void {
	const store = view.plugin.store;
	const form = parent.createDiv({ cls: "vc-subcard vc-add-goal-form" });

	const titleInput = form.createEl("input", {
		cls: "vc-input",
		attr: { type: "text", placeholder },
	});

	const warningBox = form.createDiv({ cls: "vc-dead-goal-warn is-hidden" });

	const whenInput = form.createEl("input", {
		cls: "vc-input",
		attr: {
			type: "text",
			placeholder: "Когда и где? (опционально, например: после работы в парке)",
		},
	});

	titleInput.addEventListener("input", () => {
		const check = checkDeadPersonGoal(titleInput.value);
		warningBox.toggleClass("is-hidden", !check.isDeadGoal);
		warningBox.setText(check.hint);
	});

	const actions = form.createDiv({ cls: "vc-form-actions" });
	const cancelBtn = actions.createEl("button", {
		cls: "vc-btn vc-btn-normal",
		text: "Отмена",
		attr: { type: "button" },
	});
	cancelBtn.addEventListener("click", () => {
		view.uiState.addingGoalHorizon = null;
		view.render();
	});

	const saveBtn = actions.createEl("button", {
		cls: "vc-btn vc-btn-cta",
		text: "Добавить цель",
		attr: { type: "button" },
	});

	const submit = async () => {
		const title = titleInput.value.trim();
		if (!title) return;
		const created = await store.addGoal({
			domainId,
			horizon,
			title,
			whenWhere: whenInput.value.trim(),
		});
		view.uiState.addingGoalHorizon = null;
		view.uiState.expandedGoalIds.add(created.id);
		view.render();
	};

	saveBtn.addEventListener("click", () => {
		void submit();
	});
	titleInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			void submit();
		}
	});

	window.setTimeout(() => titleInput.focus(), 20);
}

function renderGoalCard(
	parent: HTMLElement,
	goal: ValueGoal,
	view: ValuesCompassView
): void {
	const store = view.plugin.store;
	const isExpanded = view.uiState.expandedGoalIds.has(goal.id);

	const card = parent.createDiv({
		cls: `vc-subcard vc-goal-card${goal.status === "done" ? " is-done" : ""}${
			goal.status === "paused" ? " is-paused" : ""
		}`,
	});

	const head = card.createDiv({ cls: "vc-goal-card-head" });

	const statusBtn = head.createEl("button", {
		cls: `vc-btn vc-goal-check${goal.status === "done" ? " is-checked" : ""}`,
		attr: {
			type: "button",
			title: goal.status === "done" ? "Вернуть в активные" : "Отметить выполненной",
		},
	});
	setIcon(statusBtn, goal.status === "done" ? "check" : "circle");
	statusBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		void store.setGoalStatus(goal.id, goal.status === "done" ? "active" : "done");
	});

	const titleArea = head.createDiv({ cls: "vc-goal-card-title-wrap" });
	titleArea.createDiv({ cls: "vc-goal-card-title", text: goal.title });

	const metaParts: string[] = [];
	if (goal.whenWhere) metaParts.push(goal.whenWhere);
	if (goal.steps.length > 0) {
		const doneCount = goal.steps.filter((s) => s.done).length;
		metaParts.push(`Шаги: ${doneCount}/${goal.steps.length}`);
	}
	if (metaParts.length > 0) {
		titleArea.createDiv({ cls: "vc-goal-meta", text: metaParts.join(" · ") });
	}

	const expandBtn = head.createEl("button", {
		cls: "vc-btn vc-btn-icon",
		attr: { type: "button", title: "Раскрыть план действий" },
	});
	setIcon(expandBtn, isExpanded ? "chevron-up" : "chevron-down");

	const toggleExpand = () => {
		if (isExpanded) {
			view.uiState.expandedGoalIds.delete(goal.id);
		} else {
			view.uiState.expandedGoalIds.add(goal.id);
		}
		view.render();
	};
	titleArea.addEventListener("click", toggleExpand);
	expandBtn.addEventListener("click", toggleExpand);

	if (!isExpanded) return;

	// Раскрытый план действий (Action Plan)
	const details = card.createDiv({ cls: "vc-goal-details" });

	// Когда и где
	const whenInput = details.createEl("input", {
		cls: "vc-input vc-detail-input",
		attr: { type: "text", placeholder: "Когда и где буду делать..." },
	});
	whenInput.value = goal.whenWhere;
	whenInput.addEventListener("blur", () => {
		const val = whenInput.value.trim();
		if (val !== goal.whenWhere) {
			void store.updateGoal(goal.id, { whenWhere: val });
		}
	});

	// Ради какой ценности (Глава 28)
	const whyInput = details.createEl("input", {
		cls: "vc-input vc-detail-input",
		attr: {
			type: "text",
			placeholder: "Какую ценность обслуживает эта цель? (Зачем она мне?)",
		},
	});
	whyInput.value = goal.underlyingValue;
	whyInput.addEventListener("blur", () => {
		const val = whyInput.value.trim();
		if (val !== goal.underlyingValue) {
			void store.updateGoal(goal.id, { underlyingValue: val });
		}
	});

	// Шаги плана
	const stepsSec = details.createDiv({ cls: "vc-detail-block" });
	stepsSec.createDiv({ cls: "vc-detail-label", text: "Шаги плана" });

	if (goal.steps.length > 0) {
		const sList = stepsSec.createDiv({ cls: "vc-steps-list" });
		for (const step of goal.steps) {
			const sRow = sList.createDiv({
				cls: `vc-step-row${step.done ? " is-done" : ""}`,
			});
			const cb = sRow.createEl("input", {
				cls: "vc-checkbox",
				attr: { type: "checkbox" },
			});
			cb.checked = step.done;
			cb.addEventListener("change", () => {
				void store.toggleGoalStep(goal.id, step.id);
			});

			sRow.createSpan({ cls: "vc-step-text", text: step.text });

			const delStep = sRow.createEl("button", {
				cls: "vc-btn vc-btn-icon vc-step-del",
				attr: { type: "button", title: "Удалить шаг" },
			});
			setIcon(delStep, "x");
			delStep.addEventListener("click", () => {
				void store.deleteGoalStep(goal.id, step.id);
			});
		}
	}

	const addStepInput = stepsSec.createEl("input", {
		cls: "vc-input vc-inline-add-input",
		attr: { type: "text", placeholder: "+ Добавить шаг плана — Enter" },
	});
	addStepInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const txt = addStepInput.value.trim();
			if (txt) {
				void store.addGoalStep(goal.id, txt);
			}
		}
	});

	// Нужные ресурсы и навыки
	const resSec = details.createDiv({ cls: "vc-detail-block" });
	resSec.createDiv({ cls: "vc-detail-label", text: "Ресурсы и навыки" });

	if (goal.resources.length > 0) {
		const rRow = resSec.createDiv({ cls: "vc-qualities-row" });
		for (const res of goal.resources) {
			const pill = rRow.createSpan({ cls: "vc-tag-pill vc-removable-pill" });
			pill.createSpan({ text: res });
			const rm = pill.createEl("button", {
				cls: "vc-btn vc-pill-remove",
				attr: { type: "button", "aria-label": `Удалить ресурс ${res}` },
			});
			setIcon(rm, "x");
			rm.addEventListener("click", () => {
				const next = goal.resources.filter((r) => r !== res);
				void store.updateGoal(goal.id, { resources: next });
			});
		}
	}

	const addResInput = resSec.createEl("input", {
		cls: "vc-input vc-inline-add-input",
		attr: { type: "text", placeholder: "+ Нужный ресурс или навык — Enter" },
	});
	addResInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const val = addResInput.value.trim();
			if (val && !goal.resources.includes(val)) {
				void store.updateGoal(goal.id, {
					resources: [...goal.resources, val],
				});
			}
		}
	});

	// Нижняя панель управления целью
	const footer = details.createDiv({ cls: "vc-goal-footer" });
	const pauseBtn = footer.createEl("button", {
		cls: "vc-btn vc-btn-subtle",
		text: goal.status === "paused" ? "Возобновить" : "На паузу",
		attr: { type: "button" },
	});
	pauseBtn.addEventListener("click", () => {
		void store.setGoalStatus(
			goal.id,
			goal.status === "paused" ? "active" : "paused"
		);
	});

	const logBtn = footer.createEl("button", {
		cls: "vc-btn vc-btn-subtle",
		text: "Записать в сегодня",
		attr: { type: "button" },
	});
	logBtn.addEventListener("click", async () => {
		await store.addLog({
			domainId: goal.domainId,
			goalId: goal.id,
			text: goal.title,
			isNewStep: false,
		});
		new Notice("Записано в сегодняшний лог");
	});

	const delBtn = footer.createEl("button", {
		cls: "vc-btn vc-btn-subtle vc-danger-text",
		text: "Удалить",
		attr: { type: "button" },
	});
	delBtn.addEventListener("click", () => {
		view.uiState.expandedGoalIds.delete(goal.id);
		void store.deleteGoal(goal.id);
	});
}