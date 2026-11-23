import { Notice, setIcon } from "obsidian";
import {
	checkDeadPersonGoal,
	DOMAIN_ICON_OPTIONS,
	HORIZON_LIST,
} from "../defaults";
import { GoalHorizon, ValueDomain, ValueGoal } from "../types";
import type { ValuesCompassView } from "../view";

function fmtScore(n: number): string {
	const rounded = Math.round(n * 10) / 10;
	return Number.isInteger(rounded)
		? String(rounded)
		: String(rounded).replace(".", ",");
}

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

	const gridCol = layout.createDiv({ cls: "vc-map-grid-col" });

	const gridHead = gridCol.createDiv({ cls: "vc-section-head vc-map-head" });
	gridHead.createEl("h2", { cls: "vc-section-title", text: "Карта сфер" });

	const headRight = gridHead.createDiv({ cls: "vc-map-head-right" });
	const focusCount = store.getFocusDomains().length;
	headRight.createSpan({
		cls: "vc-muted-meta",
		text: `В фокусе: ${focusCount}`,
	});

	const addDomainBtn = headRight.createEl("button", {
		cls: `vc-btn vc-btn-normal${view.uiState.isAddingDomain ? " is-active" : ""}`,
		attr: { type: "button" },
	});
	const addIco = addDomainBtn.createSpan({ cls: "vc-chip-icon" });
	setIcon(addIco, "plus");
	addDomainBtn.createSpan({ text: "Сфера" });
	addDomainBtn.addEventListener("click", () => {
		view.uiState.isAddingDomain = !view.uiState.isAddingDomain;
		view.render();
	});

	if (view.uiState.isAddingDomain) {
		renderAddDomainCard(gridCol, view);
	}

	const grid = gridCol.createDiv({ cls: "vc-domains-grid" });

	for (const domain of domains) {
		const isSelected = selectedDomain?.id === domain.id;
		const stats = store.getDomainAlignment(domain.id);
		const goalsCount = store
			.getGoalsByDomain(domain.id)
			.filter((g) => g.status === "active").length;
		const gap = Math.max(
			0,
			Math.round((domain.importance - stats.score) * 10) / 10
		);

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
			view.uiState.editingDomainId = null;
			view.uiState.confirmDeleteDomainId = null;
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
		}

		// Двойная полоска: Важность (фон) vs Реальность по действиям (заливка)
		const meterBlock = card.createDiv({
			cls: "vc-meter-block",
			attr: {
				title: `За 30 дн.: ${stats.activeDays} дн. · ${stats.totalLogs} действ.${
					stats.newSteps > 0 ? ` · новых: ${stats.newSteps}` : ""
				}`,
			},
		});
		const meterLabels = meterBlock.createDiv({ cls: "vc-meter-labels" });
		meterLabels.createSpan({
			cls: "vc-meter-nums",
			text: `${fmtScore(stats.score)} / ${domain.importance}`,
		});

		const rightMeta = meterLabels.createDiv({ cls: "vc-meter-right" });
		if (gap >= 3) {
			rightMeta.createSpan({
				cls: "vc-gap-pill is-high",
				text: `−${fmtScore(gap)}`,
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
		alignBar.style.width = `${Math.min(100, stats.score * 10)}%`;
	}

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
	const stats = store.getDomainAlignment(domain.id);
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

	const isEditing = view.uiState.editingDomainId === domain.id;
	const editBtn = headActions.createEl("button", {
		cls: `vc-btn vc-btn-icon${isEditing ? " is-active" : ""}`,
		attr: { type: "button", title: "Переименовать и выбрать иконку" },
	});
	setIcon(editBtn, "pencil");
	editBtn.addEventListener("click", () => {
		view.uiState.editingDomainId = isEditing ? null : domain.id;
		view.render();
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
		attr: { type: "button", title: "Закрыть" },
	});
	setIcon(closeBtn, "x");
	closeBtn.addEventListener("click", () => {
		view.uiState.selectedMapDomainId = null;
		view.uiState.editingDomainId = null;
		view.uiState.confirmDeleteDomainId = null;
		view.render();
	});

	const body = inspector.createDiv({ cls: "vc-inspector-body" });

	// Переименование и иконка
	if (isEditing) {
		const editBox = body.createDiv({ cls: "vc-subcard vc-edit-domain-box" });
		editBox.createDiv({ cls: "vc-detail-label", text: "Название и иконка" });

		const nameRow = editBox.createDiv({ cls: "vc-quick-form" });
		const nameInput = nameRow.createEl("input", {
			cls: "vc-input",
			attr: { type: "text", placeholder: "Название сферы" },
		});
		nameInput.value = domain.name;

		const saveNameBtn = nameRow.createEl("button", {
			cls: "vc-btn vc-btn-cta",
			text: "Готово",
			attr: { type: "button" },
		});

		const commitName = async () => {
			const next = nameInput.value.trim();
			if (next && next !== domain.name) {
				await store.updateDomain(domain.id, { name: next });
			}
			view.uiState.editingDomainId = null;
			view.render();
		};

		saveNameBtn.addEventListener("click", () => {
			void commitName();
		});
		nameInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void commitName();
			} else if (e.key === "Escape") {
				view.uiState.editingDomainId = null;
				view.render();
			}
		});

		const iconGrid = editBox.createDiv({ cls: "vc-icon-grid" });
		for (const iconName of DOMAIN_ICON_OPTIONS) {
			const iBtn = iconGrid.createEl("button", {
				cls: `vc-btn vc-btn-icon vc-icon-pick-btn${
					domain.icon === iconName ? " is-active" : ""
				}`,
				attr: { type: "button", title: iconName },
			});
			setIcon(iBtn, iconName);
			iBtn.addEventListener("click", () => {
				void store.updateDomain(domain.id, { icon: iconName });
			});
		}

		window.setTimeout(() => nameInput.focus(), 20);
	}

	// Секция 1: Компас + Качества
	const compassSec = body.createDiv({ cls: "vc-insp-section" });
	compassSec.createEl("h3", { cls: "vc-insp-sec-title", text: "Компас" });

	const summaryArea = compassSec.createEl("textarea", {
		cls: "vc-textarea",
		attr: {
			rows: "3",
			placeholder: "Каким я хочу быть в этой сфере?",
		},
	});
	summaryArea.value = domain.compassSummary;
	summaryArea.addEventListener("blur", () => {
		const next = summaryArea.value.trim();
		if (next !== domain.compassSummary) {
			void store.updateDomain(domain.id, { compassSummary: next });
		}
	});

	const qualWrap = compassSec.createDiv({ cls: "vc-qualities-editor" });
	if (domain.qualities.length > 0) {
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
	}

	const qualInput = qualWrap.createEl("input", {
		cls: "vc-input vc-inline-add-input",
		attr: { type: "text", placeholder: "+ Качество" },
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

	// Секция 2: Важность (ручная) + Реальность (авто по действиям за 30 дней)
	const ratingsSec = body.createDiv({ cls: "vc-insp-section" });
	const ratHead = ratingsSec.createDiv({ cls: "vc-insp-sec-head" });
	ratHead.createEl("h3", { cls: "vc-insp-sec-title", text: "Баланс" });

	const initialGap = Math.max(
		0,
		Math.round((domain.importance - stats.score) * 10) / 10
	);
	const gapLabel = ratHead.createSpan({
		cls: `vc-gap-pill${initialGap >= 3 ? " is-high" : ""}`,
		text: initialGap > 0 ? `Разрыв −${fmtScore(initialGap)}` : "В балансе",
	});

	const balanceCard = ratingsSec.createDiv({ cls: "vc-sliders-grid" });

	// Слайдер Важности
	const impRow = balanceCard.createDiv({ cls: "vc-slider-row" });
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

	// Автоматическая Реальность
	const objRow = balanceCard.createDiv({ cls: "vc-objective-box" });
	const objTop = objRow.createDiv({ cls: "vc-objective-top" });
	objTop.createSpan({ text: "Живу сейчас" });
	objTop.createSpan({
		cls: "vc-slider-val",
		text: `${fmtScore(stats.score)} / 10`,
	});

	const bar = objRow.createDiv({ cls: "vc-dual-bar" });
	const impBar = bar.createDiv({ cls: "vc-dual-bar-importance" });
	impBar.style.width = `${domain.importance * 10}%`;
	const alignBar = bar.createDiv({ cls: "vc-dual-bar-alignment" });
	alignBar.style.width = `${Math.min(100, stats.score * 10)}%`;

	const metaParts = [
		`30 дн.: ${stats.activeDays} дн.`,
		`${stats.totalLogs} действ.`,
	];
	if (stats.newSteps > 0) metaParts.push(`новых: ${stats.newSteps}`);
	objRow.createDiv({ cls: "vc-objective-meta", text: metaParts.join(" · ") });

	impRange.addEventListener("input", () => {
		const i = Number(impRange.value);
		impNum.setText(`${i} / 10`);
		impBar.style.width = `${i * 10}%`;
		const g = Math.max(0, Math.round((i - stats.score) * 10) / 10);
		gapLabel.setText(g > 0 ? `Разрыв −${fmtScore(g)}` : "В балансе");
		gapLabel.toggleClass("is-high", g >= 3);
	});
	impRange.addEventListener("change", () => {
		void store.updateDomain(domain.id, { importance: Number(impRange.value) });
	});

	// Секция 3: Цели
	const goalsSec = body.createDiv({ cls: "vc-insp-section" });
	const goalsHead = goalsSec.createDiv({ cls: "vc-insp-sec-head" });
	goalsHead.createEl("h3", { cls: "vc-insp-sec-title", text: "Цели" });

	const doneToggle = goalsHead.createEl("button", {
		cls: "vc-btn vc-btn-subtle",
		text: view.uiState.showDoneGoals ? "Скрыть выполненные" : "Выполненные",
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
		hTitleWrap.createSpan({ cls: `vc-horizon-dot vc-dot-${horizon.id}` });
		hTitleWrap.createSpan({ cls: "vc-horizon-title", text: horizon.label });

		const addBtn = hHead.createEl("button", {
			cls: "vc-btn vc-btn-icon",
			attr: { type: "button", title: `Добавить (${horizon.label})` },
		});
		setIcon(addBtn, "plus");
		addBtn.addEventListener("click", () => {
			view.uiState.addingGoalHorizon =
				view.uiState.addingGoalHorizon === horizon.id ? null : horizon.id;
			view.render();
		});

		if (view.uiState.addingGoalHorizon === horizon.id) {
			renderAddGoalForm(hBlock, domain.id, horizon.id, view);
		}

		const goals = store
			.getGoalsByDomain(domain.id, horizon.id)
			.filter((g) => view.uiState.showDoneGoals || g.status !== "done");

		if (goals.length > 0) {
			const gList = hBlock.createDiv({ cls: "vc-goals-stack" });
			for (const goal of goals) {
				renderGoalCard(gList, goal, view);
			}
		}
	}

	// Секция 4: Удаление сферы
	body.createEl("hr", { cls: "vc-hr" });
	const dangerSec = body.createDiv({ cls: "vc-danger-zone" });

	if (view.uiState.confirmDeleteDomainId !== domain.id) {
		const delTrigger = dangerSec.createEl("button", {
			cls: "vc-btn vc-btn-subtle vc-danger-text",
			text: "Удалить сферу",
			attr: { type: "button" },
		});
		delTrigger.addEventListener("click", () => {
			view.uiState.confirmDeleteDomainId = domain.id;
			view.render();
		});
	} else {
		const usage = store.getDomainUsage(domain.id);
		const detailsText =
			usage.goalsCount > 0 || usage.logsCount > 0
				? `Удалить «${domain.name}» вместе с целями (${usage.goalsCount}) и записями (${usage.logsCount})?`
				: `Удалить сферу «${domain.name}»?`;

		dangerSec.createDiv({ cls: "vc-confirm-text", text: detailsText });
		const confirmRow = dangerSec.createDiv({ cls: "vc-confirm-row" });

		const cancelDel = confirmRow.createEl("button", {
			cls: "vc-btn vc-btn-normal",
			text: "Отмена",
			attr: { type: "button" },
		});
		cancelDel.addEventListener("click", () => {
			view.uiState.confirmDeleteDomainId = null;
			view.render();
		});

		const confirmDel = confirmRow.createEl("button", {
			cls: "vc-btn vc-btn-danger",
			text: "Удалить",
			attr: { type: "button" },
		});
		confirmDel.addEventListener("click", async () => {
			const deletedName = domain.name;
			view.uiState.selectedMapDomainId = null;
			view.uiState.editingDomainId = null;
			view.uiState.confirmDeleteDomainId = null;
			if (view.uiState.analyticsDomainFilter === domain.id) {
				view.uiState.analyticsDomainFilter = "all";
			}
			await store.deleteDomain(domain.id);
			new Notice(`Сфера «${deletedName}» удалена`);
		});
	}
}

function renderAddDomainCard(
	parent: HTMLElement,
	view: ValuesCompassView
): void {
	const store = view.plugin.store;
	const card = parent.createDiv({ cls: "vc-island vc-add-domain-card" });
	card.createDiv({ cls: "vc-detail-label", text: "Новая сфера" });

	const nameInput = card.createEl("input", {
		cls: "vc-input",
		attr: { type: "text", placeholder: "Название сферы" },
	});

	const iconGrid = card.createDiv({ cls: "vc-icon-grid" });
	for (const iconName of DOMAIN_ICON_OPTIONS) {
		const iBtn = iconGrid.createEl("button", {
			cls: `vc-btn vc-btn-icon vc-icon-pick-btn${
				view.uiState.newDomainIcon === iconName ? " is-active" : ""
			}`,
			attr: { type: "button", title: iconName },
		});
		setIcon(iBtn, iconName);
		iBtn.addEventListener("click", () => {
			view.uiState.newDomainIcon = iconName;
			iconGrid
				.querySelectorAll(".vc-icon-pick-btn")
				.forEach((el) => el.removeClass("is-active"));
			iBtn.addClass("is-active");
		});
	}

	const actions = card.createDiv({ cls: "vc-form-actions" });
	const cancelBtn = actions.createEl("button", {
		cls: "vc-btn vc-btn-normal",
		text: "Отмена",
		attr: { type: "button" },
	});
	cancelBtn.addEventListener("click", () => {
		view.uiState.isAddingDomain = false;
		view.render();
	});

	const createBtn = actions.createEl("button", {
		cls: "vc-btn vc-btn-cta",
		text: "Создать",
		attr: { type: "button" },
	});

	const submit = async () => {
		const name = nameInput.value.trim();
		if (!name) return;
		const created = await store.addDomain({
			name,
			icon: view.uiState.newDomainIcon || "compass",
		});
		view.uiState.isAddingDomain = false;
		view.uiState.newDomainIcon = "compass";
		if (created) {
			view.uiState.selectedMapDomainId = created.id;
		}
		view.render();
	};

	createBtn.addEventListener("click", () => {
		void submit();
	});
	nameInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			void submit();
		} else if (e.key === "Escape") {
			view.uiState.isAddingDomain = false;
			view.render();
		}
	});

	window.setTimeout(() => nameInput.focus(), 20);
}

function renderAddGoalForm(
	parent: HTMLElement,
	domainId: string,
	horizon: GoalHorizon,
	view: ValuesCompassView
): void {
	const store = view.plugin.store;
	const form = parent.createDiv({ cls: "vc-subcard vc-add-goal-form" });

	const titleInput = form.createEl("input", {
		cls: "vc-input",
		attr: { type: "text", placeholder: "Новая цель" },
	});

	const warningBox = form.createDiv({ cls: "vc-dead-goal-warn is-hidden" });

	const whenInput = form.createEl("input", {
		cls: "vc-input",
		attr: { type: "text", placeholder: "Когда и где (опционально)" },
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
		text: "Добавить",
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
			title: goal.status === "done" ? "Вернуть в активные" : "Выполнено",
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
		metaParts.push(`${doneCount}/${goal.steps.length}`);
	}
	if (metaParts.length > 0) {
		titleArea.createDiv({ cls: "vc-goal-meta", text: metaParts.join(" · ") });
	}

	const expandBtn = head.createEl("button", {
		cls: "vc-btn vc-btn-icon",
		attr: { type: "button", title: "План" },
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

	const details = card.createDiv({ cls: "vc-goal-details" });

	const whenInput = details.createEl("input", {
		cls: "vc-input vc-detail-input",
		attr: { type: "text", placeholder: "Когда и где" },
	});
	whenInput.value = goal.whenWhere;
	whenInput.addEventListener("blur", () => {
		const val = whenInput.value.trim();
		if (val !== goal.whenWhere) {
			void store.updateGoal(goal.id, { whenWhere: val });
		}
	});

	const whyInput = details.createEl("input", {
		cls: "vc-input vc-detail-input",
		attr: { type: "text", placeholder: "Ради какой ценности?" },
	});
	whyInput.value = goal.underlyingValue;
	whyInput.addEventListener("blur", () => {
		const val = whyInput.value.trim();
		if (val !== goal.underlyingValue) {
			void store.updateGoal(goal.id, { underlyingValue: val });
		}
	});

	const stepsSec = details.createDiv({ cls: "vc-detail-block" });
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
		attr: { type: "text", placeholder: "+ Шаг" },
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

	const resSec = details.createDiv({ cls: "vc-detail-block" });
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
		attr: { type: "text", placeholder: "+ Ресурс или навык" },
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

	const footer = details.createDiv({ cls: "vc-goal-footer" });
	const pauseBtn = footer.createEl("button", {
		cls: "vc-btn vc-btn-subtle",
		text: goal.status === "paused" ? "Возобновить" : "Пауза",
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
		text: "В сегодня",
		attr: { type: "button" },
	});
	logBtn.addEventListener("click", async () => {
		await store.addLog({
			domainId: goal.domainId,
			goalId: goal.id,
			text: goal.title,
			isNewStep: false,
		});
		new Notice("Записано в сегодня");
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