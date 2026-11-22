import { App, normalizePath } from "obsidian";
import { createInitialData } from "./defaults";
import {
	ActionStep,
	DomainAnalyticsRow,
	GoalHorizon,
	GoalStatus,
	HeatmapCell,
	SavoringEntry,
	ValueDomain,
	ValueGoal,
	ValueLogEntry,
	ValuesCompassData,
} from "./types";

type StoreListener = () => void;

export function formatLocalDateKey(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function createId(prefix: string): string {
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export class ValuesStore {
	private app: App;
	private filePath: string;
	private data: ValuesCompassData;
	private listeners: Set<StoreListener> = new Set();
	private saveQueue: Promise<void> = Promise.resolve();

	constructor(app: App, filePath: string) {
		this.app = app;
		this.filePath = normalizePath(filePath);
		this.data = createInitialData();
	}

	public setFilePath(filePath: string): void {
		this.filePath = normalizePath(filePath);
	}

	public subscribe(listener: StoreListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	public getData(): ValuesCompassData {
		return this.data;
	}

	public async load(): Promise<void> {
		const adapter = this.app.vault.adapter;
		try {
			const exists = await adapter.exists(this.filePath);
			if (!exists) {
				this.data = createInitialData();
				await this.persist();
				this.notify();
				return;
			}
			const raw = await adapter.read(this.filePath);
			const parsed = JSON.parse(raw) as Partial<ValuesCompassData>;
			const base = createInitialData();

			this.data = {
				version: parsed.version ?? 1,
				domains:
					Array.isArray(parsed.domains) && parsed.domains.length > 0
						? parsed.domains
						: base.domains,
				goals: Array.isArray(parsed.goals) ? parsed.goals : [],
				logs: Array.isArray(parsed.logs) ? parsed.logs : [],
				savoring: Array.isArray(parsed.savoring) ? parsed.savoring : [],
				snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
			};
			this.notify();
		} catch (err) {
			console.error("[Values Compass] Failed to load data:", err);
			this.data = createInitialData();
			this.notify();
		}
	}

	private async ensureParentFolders(path: string): Promise<void> {
		const parts = path.split("/");
		parts.pop();
		if (parts.length === 0) return;

		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const exists = await this.app.vault.adapter.exists(current);
			if (!exists) {
				await this.app.vault.adapter.mkdir(current);
			}
		}
	}

	private persist(): Promise<void> {
		const snapshotJson = JSON.stringify(this.data, null, 2);
		this.saveQueue = this.saveQueue
			.then(async () => {
				await this.ensureParentFolders(this.filePath);
				await this.app.vault.adapter.write(this.filePath, snapshotJson);
			})
			.catch((err) => {
				console.error("[Values Compass] Failed to save data:", err);
			});
		return this.saveQueue;
	}

	// --- Domains ---

	public getDomains(includeHidden = false): ValueDomain[] {
		return includeHidden
			? this.data.domains
			: this.data.domains.filter((d) => !d.hidden);
	}

	public getFocusDomains(): ValueDomain[] {
		return this.data.domains.filter((d) => !d.hidden && d.isFocus);
	}

	public getDomainById(id: string): ValueDomain | undefined {
		return this.data.domains.find((d) => d.id === id);
	}

	public async updateDomain(
		domainId: string,
		patch: Partial<Omit<ValueDomain, "id">>
	): Promise<void> {
		const domain = this.getDomainById(domainId);
		if (!domain) return;

		Object.assign(domain, patch, { updatedAt: new Date().toISOString() });
		this.notify();
		await this.persist();
	}

	public async toggleDomainFocus(domainId: string): Promise<void> {
		const domain = this.getDomainById(domainId);
		if (!domain) return;
		domain.isFocus = !domain.isFocus;
		domain.updatedAt = new Date().toISOString();
		this.notify();
		await this.persist();
	}

	// --- Goals ---

	public getGoalsByDomain(domainId: string, horizon?: GoalHorizon): ValueGoal[] {
		return this.data.goals.filter(
			(g) => g.domainId === domainId && (!horizon || g.horizon === horizon)
		);
	}

	public getFocusActionableGoals(): ValueGoal[] {
		const focusIds = new Set(this.getFocusDomains().map((d) => d.id));
		return this.data.goals.filter(
			(g) =>
				focusIds.has(g.domainId) &&
				g.status === "active" &&
				(g.horizon === "immediate" || g.horizon === "short")
		);
	}

	public async addGoal(input: {
		domainId: string;
		horizon: GoalHorizon;
		title: string;
		whenWhere?: string;
		underlyingValue?: string;
	}): Promise<ValueGoal> {
		const goal: ValueGoal = {
			id: createId("goal"),
			domainId: input.domainId,
			horizon: input.horizon,
			title: input.title.trim(),
			whenWhere: (input.whenWhere ?? "").trim(),
			underlyingValue: (input.underlyingValue ?? "").trim(),
			status: "active",
			steps: [],
			resources: [],
			createdAt: new Date().toISOString(),
		};
		this.data.goals.unshift(goal);
		this.notify();
		await this.persist();
		return goal;
	}

	public async updateGoal(
		goalId: string,
		patch: Partial<Omit<ValueGoal, "id" | "domainId">>
	): Promise<void> {
		const goal = this.data.goals.find((g) => g.id === goalId);
		if (!goal) return;

		Object.assign(goal, patch);
		if (patch.status === "done" && !goal.completedAt) {
			goal.completedAt = new Date().toISOString();
		} else if (patch.status && patch.status !== "done") {
			goal.completedAt = undefined;
		}
		this.notify();
		await this.persist();
	}

	public async setGoalStatus(goalId: string, status: GoalStatus): Promise<void> {
		await this.updateGoal(goalId, { status });
	}

	public async deleteGoal(goalId: string): Promise<void> {
		this.data.goals = this.data.goals.filter((g) => g.id !== goalId);
		this.notify();
		await this.persist();
	}

	public async addGoalStep(goalId: string, text: string): Promise<void> {
		const goal = this.data.goals.find((g) => g.id === goalId);
		const trimmed = text.trim();
		if (!goal || !trimmed) return;

		const step: ActionStep = {
			id: createId("step"),
			text: trimmed,
			done: false,
		};
		goal.steps.push(step);
		this.notify();
		await this.persist();
	}

	public async toggleGoalStep(goalId: string, stepId: string): Promise<boolean> {
		const goal = this.data.goals.find((g) => g.id === goalId);
		if (!goal) return false;
		const step = goal.steps.find((s) => s.id === stepId);
		if (!step) return false;

		step.done = !step.done;
		this.notify();
		await this.persist();
		return step.done;
	}

	public async deleteGoalStep(goalId: string, stepId: string): Promise<void> {
		const goal = this.data.goals.find((g) => g.id === goalId);
		if (!goal) return;
		goal.steps = goal.steps.filter((s) => s.id !== stepId);
		this.notify();
		await this.persist();
	}

	// --- Daily Logs ---

	public getLogsByDate(dateKey: string): ValueLogEntry[] {
		return this.data.logs.filter((l) => l.date === dateKey);
	}

	public getAllLogs(): ValueLogEntry[] {
		return this.data.logs;
	}

	public async addLog(input: {
		domainId: string;
		text: string;
		isNewStep: boolean;
		goalId?: string;
		date?: string;
	}): Promise<ValueLogEntry | null> {
		const trimmed = input.text.trim();
		if (!trimmed) return null;

		const entry: ValueLogEntry = {
			id: createId("log"),
			date: input.date ?? formatLocalDateKey(),
			domainId: input.domainId,
			goalId: input.goalId,
			text: trimmed,
			isNewStep: input.isNewStep,
			createdAt: new Date().toISOString(),
		};
		this.data.logs.unshift(entry);
		this.notify();
		await this.persist();
		return entry;
	}

	public async deleteLog(logId: string): Promise<void> {
		this.data.logs = this.data.logs.filter((l) => l.id !== logId);
		this.notify();
		await this.persist();
	}

	// --- Savoring (Chapter 29) ---

	public getSavoringByDate(dateKey: string): SavoringEntry | undefined {
		return this.data.savoring.find((s) => s.date === dateKey);
	}

	public async saveSavoring(text: string, dateKey = formatLocalDateKey()): Promise<void> {
		const trimmed = text.trim();
		const existingIdx = this.data.savoring.findIndex((s) => s.date === dateKey);

		if (!trimmed) {
			if (existingIdx !== -1) {
				this.data.savoring.splice(existingIdx, 1);
				this.notify();
				await this.persist();
			}
			return;
		}

		const existingEntry =
			existingIdx !== -1 ? this.data.savoring[existingIdx] : undefined;
		if (existingEntry) {
			existingEntry.text = trimmed;
		} else {
			this.data.savoring.unshift({
				id: createId("sav"),
				date: dateKey,
				text: trimmed,
				createdAt: new Date().toISOString(),
			});
		}

		this.notify();
		await this.persist();
	}

	// --- Snapshots & Analytics ---

	public async takeSnapshot(): Promise<void> {
		const today = formatLocalDateKey();
		const scores: Record<string, { importance: number; alignment: number }> = {};
		for (const d of this.data.domains) {
			if (!d.hidden) {
				scores[d.id] = {
					importance: d.importance,
					alignment: d.alignment,
				};
			}
		}

		const existing = this.data.snapshots.find((s) => s.date === today);
		if (existing) {
			existing.scores = scores;
		} else {
			this.data.snapshots.push({
				id: createId("snap"),
				date: today,
				scores,
			});
			this.data.snapshots.sort((a, b) => a.date.localeCompare(b.date));
		}

		this.notify();
		await this.persist();
	}

	public getHeatmap(weeks = 52): HeatmapCell[] {
		const countMap = new Map<string, { count: number; newSteps: number }>();
		for (const log of this.data.logs) {
			const prev = countMap.get(log.date) ?? { count: 0, newSteps: 0 };
			prev.count += 1;
			if (log.isNewStep) prev.newSteps += 1;
			countMap.set(log.date, prev);
		}

		const cells: HeatmapCell[] = [];
		const today = new Date();
		today.setHours(12, 0, 0, 0);

		const dow = (today.getDay() + 6) % 7; // Пн = 0 ... Вс = 6
		const totalDays = (weeks - 1) * 7 + dow + 1;

		for (let i = totalDays - 1; i >= 0; i--) {
			const dt = new Date(today);
			dt.setDate(today.getDate() - i);
			const key = formatLocalDateKey(dt);
			const stat = countMap.get(key) ?? { count: 0, newSteps: 0 };
			let level: 0 | 1 | 2 | 3 | 4 = 0;
			if (stat.count === 0) level = 0;
			else if (stat.count === 1) level = 1;
			else if (stat.count === 2) level = 2;
			else if (stat.count <= 4) level = 3;
			else level = 4;

			cells.push({
				date: key,
				count: stat.count,
				newSteps: stat.newSteps,
				level,
			});
		}

		return cells;
	}

	public getPeriodSummary(days = 30): {
		totalLogs: number;
		newSteps: number;
		activeDays: number;
		touchedDomains: number;
	} {
		const cutoff = new Date();
		cutoff.setHours(12, 0, 0, 0);
		cutoff.setDate(cutoff.getDate() - (days - 1));
		const cutoffKey = formatLocalDateKey(cutoff);

		const recent = this.data.logs.filter((l) => l.date >= cutoffKey);
		const daySet = new Set<string>();
		const domainSet = new Set<string>();
		let newSteps = 0;

		for (const log of recent) {
			daySet.add(log.date);
			domainSet.add(log.domainId);
			if (log.isNewStep) newSteps += 1;
		}

		return {
			totalLogs: recent.length,
			newSteps,
			activeDays: daySet.size,
			touchedDomains: domainSet.size,
		};
	}

	public getDomainAnalytics(days = 30): DomainAnalyticsRow[] {
		const cutoff = new Date();
		cutoff.setHours(12, 0, 0, 0);
		cutoff.setDate(cutoff.getDate() - (days - 1));
		const cutoffKey = formatLocalDateKey(cutoff);

		const recent = this.data.logs.filter((l) => l.date >= cutoffKey);
		const total = recent.length;

		const byDomain = new Map<string, { count: number; newSteps: number }>();
		for (const log of recent) {
			const prev = byDomain.get(log.domainId) ?? { count: 0, newSteps: 0 };
			prev.count += 1;
			if (log.isNewStep) prev.newSteps += 1;
			byDomain.set(log.domainId, prev);
		}

		const prevSnapshot =
			this.data.snapshots.length >= 2
				? this.data.snapshots[this.data.snapshots.length - 2]
				: this.data.snapshots[0];

		const visible = this.getDomains(false);
		return visible
			.map((domain) => {
				const st = byDomain.get(domain.id) ?? { count: 0, newSteps: 0 };
				const sharePct = total > 0 ? Math.round((st.count / total) * 100) : 0;
				const gap = domain.importance - domain.alignment;

				let alignmentDelta: number | null = null;
				const prevScore = prevSnapshot?.scores[domain.id];
				if (prevScore) {
					alignmentDelta = domain.alignment - prevScore.alignment;
				}

				return {
					domain,
					logCount: st.count,
					newStepCount: st.newSteps,
					sharePct,
					gap,
					alignmentDelta,
				};
			})
			.sort((a, b) => b.domain.importance - a.domain.importance || b.gap - a.gap);
	}
}