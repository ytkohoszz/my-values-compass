import { Notice, setIcon } from "obsidian";
import type { ValuesCompassView } from "../view";

export function renderAnalyticsTab(
	container: HTMLElement,
	view: ValuesCompassView
): void {
	const store = view.plugin.store;
	const summary = store.getPeriodSummary(30);
	const heatmap = store.getHeatmap(52);
	const domainRows = store.getDomainAnalytics(30);
	const allLogs = store.getAllLogs();
	const snapshots = store.getData().snapshots;

	// 1. Остров «Ритм за 90 дней» + ключевые метрики
	const rhythmIsland = container.createDiv({ cls: "vc-island" });
	const rHead = rhythmIsland.createDiv({ cls: "vc-section-head" });
	rHead.createEl("h2", { cls: "vc-section-title", text: "Ритм действий" });

	const snapBtn = rHead.createEl("button", {
		cls: "vc-btn vc-btn-normal",
		text: "Снимок оценок",
		attr: {
			type: "button",
			title: "Сохранить текущие оценки сфер, чтобы отслеживать динамику со временем",
		},
	});
	snapBtn.addEventListener("click", async () => {
		await store.takeSnapshot();
		new Notice("Снимок оценок сфер сохранён");
	});

	const kpiGrid = rhythmIsland.createDiv({ cls: "vc-kpi-grid" });
	renderKpiTile(kpiGrid, String(summary.totalLogs), "Действий за 30 дн.");
	renderKpiTile(kpiGrid, String(summary.newSteps), "Новых шагов");
	renderKpiTile(kpiGrid, String(summary.activeDays), "Активных дней");
	renderKpiTile(kpiGrid, String(summary.touchedDomains), "Затронуто сфер");

	const heatOuter = rhythmIsland.createDiv({ cls: "vc-heatmap-outer" });

	const dayLabels = heatOuter.createDiv({ cls: "vc-heatmap-days" });
	const weekLabels = ["Пн", "", "Ср", "", "Пт", "", "Вс"];
	for (const lbl of weekLabels) {
		dayLabels.createSpan({ cls: "vc-heatmap-day-label", text: lbl });
	}

	const heatWrap = heatOuter.createDiv({ cls: "vc-heatmap-wrap" });
	const heatGrid = heatWrap.createDiv({ cls: "vc-heatmap-grid" });

	for (const cell of heatmap) {
		const sq = heatGrid.createDiv({
			cls: `vc-heat-cell vc-heat-lvl-${cell.level}`,
			attr: {
				title: `${cell.date}: ${cell.count} действ.${
					cell.newSteps > 0 ? ` (новых: ${cell.newSteps})` : ""
				}`,
			},
		});
		if (cell.newSteps > 0) {
			sq.addClass("has-new-step");
		}
	}

	window.requestAnimationFrame(() => {
		heatWrap.scrollLeft = heatWrap.scrollWidth;
	});

	const heatLegend = rhythmIsland.createDiv({ cls: "vc-heatmap-legend" });
	heatLegend.createSpan({ cls: "vc-muted-meta", text: "Последние 52 недели" });
	const scale = heatLegend.createDiv({ cls: "vc-legend-scale" });
	scale.createSpan({ cls: "vc-muted-meta", text: "Меньше" });
	for (let lvl = 0; lvl <= 4; lvl++) {
		scale.createSpan({ cls: `vc-heat-cell vc-heat-lvl-${lvl}` });
	}
	scale.createSpan({ cls: "vc-muted-meta", text: "Больше" });

	// 2. Остров «Слова vs. Действия» (Velocity Table)
	const balanceIsland = container.createDiv({ cls: "vc-island" });
	const bHead = balanceIsland.createDiv({ cls: "vc-section-head" });
	bHead.createEl("h2", { cls: "vc-section-title", text: "Слова и действия (30 дней)" });
	const lastSnap = snapshots[snapshots.length - 1];
	if (lastSnap) {
		bHead.createSpan({
			cls: "vc-muted-meta",
			text: `Снимков: ${snapshots.length} (посл. ${lastSnap.date})`,
		});
	}

	const tableWrap = balanceIsland.createDiv({ cls: "vc-table-wrap" });
	const table = tableWrap.createEl("table", { cls: "vc-table" });

	const thead = table.createEl("thead");
	const hr = thead.createEl("tr");
	hr.createEl("th", { text: "Сфера" });
	hr.createEl("th", { cls: "is-num", text: "Важн." });
	hr.createEl("th", { cls: "is-num", text: "Реал." });
	hr.createEl("th", { cls: "is-num", text: "Разрыв" });
	hr.createEl("th", { cls: "is-num", text: "Шаги" });
	hr.createEl("th", { text: "Доля действий" });
	hr.createEl("th", { cls: "is-num", text: "Динамика" });

	const tbody = table.createEl("tbody");
	for (const row of domainRows) {
		const tr = tbody.createEl("tr");

		const nameTd = tr.createEl("td", { cls: "vc-td-domain" });
		if (row.domain.isFocus) {
			nameTd.createSpan({ cls: "vc-focus-dot" });
		}
		nameTd.createSpan({ text: row.domain.name });

		tr.createEl("td", { cls: "is-num", text: String(row.domain.importance) });
		tr.createEl("td", { cls: "is-num", text: String(row.domain.alignment) });

		const gapTd = tr.createEl("td", { cls: "is-num" });
		if (row.gap > 0) {
			gapTd.createSpan({
				cls: row.gap >= 3 ? "vc-val-warn" : "vc-val-muted",
				text: `−${row.gap}`,
			});
		} else {
			gapTd.createSpan({ cls: "vc-val-ok", text: "0" });
		}

		tr.createEl("td", {
			cls: "is-num",
			text:
				row.newStepCount > 0
					? `${row.logCount} (+${row.newStepCount})`
					: String(row.logCount),
		});

		const shareTd = tr.createEl("td", { cls: "vc-td-share" });
		const shareFlex = shareTd.createDiv({ cls: "vc-share-flex" });
		const barTrack = shareFlex.createDiv({ cls: "vc-share-track" });
		const barFill = barTrack.createDiv({ cls: "vc-share-fill" });
		barFill.style.width = `${row.sharePct}%`;
		shareFlex.createSpan({ cls: "vc-share-num", text: `${row.sharePct}%` });

		const deltaTd = tr.createEl("td", { cls: "is-num" });
		if (row.alignmentDelta === null || row.alignmentDelta === 0) {
			deltaTd.createSpan({ cls: "vc-val-muted", text: "—" });
		} else if (row.alignmentDelta > 0) {
			deltaTd.createSpan({
				cls: "vc-val-ok",
				text: `+${row.alignmentDelta}`,
			});
		} else {
			deltaTd.createSpan({
				cls: "vc-val-warn",
				text: String(row.alignmentDelta),
			});
		}
	}

	// 3. Остров «Лента шагов»
	const timelineIsland = container.createDiv({ cls: "vc-island" });
	const tHead = timelineIsland.createDiv({ cls: "vc-section-head" });
	tHead.createEl("h2", { cls: "vc-section-title", text: "Лента действий" });

	const newOnlyBtn = tHead.createEl("button", {
		cls: `vc-btn vc-chip${view.uiState.analyticsOnlyNewSteps ? " is-active" : ""}`,
		text: "Только новые шаги",
		attr: { type: "button" },
	});
	newOnlyBtn.addEventListener("click", () => {
		view.uiState.analyticsOnlyNewSteps = !view.uiState.analyticsOnlyNewSteps;
		view.render();
	});

	// Фильтр по сферам
	const filterRow = timelineIsland.createDiv({ cls: "vc-chips-row" });
	const allChip = filterRow.createEl("button", {
		cls: `vc-btn vc-chip${
			view.uiState.analyticsDomainFilter === "all" ? " is-active" : ""
		}`,
		text: "Все сферы",
		attr: { type: "button" },
	});
	allChip.addEventListener("click", () => {
		view.uiState.analyticsDomainFilter = "all";
		view.render();
	});

	for (const d of store.getDomains(false)) {
		const chip = filterRow.createEl("button", {
			cls: `vc-btn vc-chip${
				view.uiState.analyticsDomainFilter === d.id ? " is-active" : ""
			}`,
			text: d.name,
			attr: { type: "button" },
		});
		chip.addEventListener("click", () => {
			view.uiState.analyticsDomainFilter = d.id;
			view.render();
		});
	}

	const filtered = allLogs
		.filter((l) => {
			if (
				view.uiState.analyticsDomainFilter !== "all" &&
				l.domainId !== view.uiState.analyticsDomainFilter
			) {
				return false;
			}
			if (view.uiState.analyticsOnlyNewSteps && !l.isNewStep) {
				return false;
			}
			return true;
		})
		.slice(0, 60);

	if (filtered.length === 0) {
		const empty = timelineIsland.createDiv({ cls: "vc-empty-box" });
		empty.createDiv({
			cls: "vc-empty-text",
			text: "Записей по выбранному фильтру пока нет.",
		});
		return;
	}

	// Группировка по датам
	const grouped = new Map<string, typeof filtered>();
	for (const item of filtered) {
		const arr = grouped.get(item.date) ?? [];
		arr.push(item);
		grouped.set(item.date, arr);
	}

	const timelineList = timelineIsland.createDiv({ cls: "vc-timeline-list" });
	for (const [dateKey, entries] of grouped.entries()) {
		const dayGroup = timelineList.createDiv({ cls: "vc-timeline-day" });
		dayGroup.createDiv({ cls: "vc-timeline-date", text: dateKey });

		const entriesWrap = dayGroup.createDiv({ cls: "vc-timeline-entries" });
		for (const entry of entries) {
			const domain = store.getDomainById(entry.domainId);
			const row = entriesWrap.createDiv({ cls: "vc-subcard vc-log-row" });

			const main = row.createDiv({ cls: "vc-log-main" });
			const meta = main.createDiv({ cls: "vc-log-meta" });
			meta.createSpan({ cls: "vc-tag-pill", text: domain?.name ?? "Сфера" });
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
}

function renderKpiTile(parent: HTMLElement, value: string, label: string): void {
	const tile = parent.createDiv({ cls: "vc-subcard vc-kpi-tile" });
	tile.createDiv({ cls: "vc-kpi-value", text: value });
	tile.createDiv({ cls: "vc-kpi-label", text: label });
}