export type CompassTabId = "today" | "map" | "analytics";

export type GoalHorizon = "immediate" | "short" | "mid" | "long";

export type GoalStatus = "active" | "done" | "paused";

export interface ActionStep {
	id: string;
	text: string;
	done: boolean;
}

export interface ValueGoal {
	id: string;
	domainId: string;
	horizon: GoalHorizon;
	title: string;
	whenWhere: string;
	underlyingValue: string;
	status: GoalStatus;
	steps: ActionStep[];
	resources: string[];
	createdAt: string;
	completedAt?: string;
}

export interface ValueDomain {
	id: string;
	name: string;
	icon: string;
	hidden: boolean;
	isFocus: boolean;
	compassSummary: string;
	qualities: string[];
	importance: number;
	alignment: number;
	updatedAt: string;
	questionnaireAnswers: Record<string, string>;
}

export interface ValueLogEntry {
	id: string;
	date: string; // YYYY-MM-DD (local time)
	domainId: string;
	goalId?: string;
	text: string;
	isNewStep: boolean;
	createdAt: string;
}

export interface SavoringEntry {
	id: string;
	date: string; // YYYY-MM-DD (local time)
	text: string;
	createdAt: string;
}

export interface AlignmentSnapshot {
	id: string;
	date: string; // YYYY-MM-DD
	scores: Record<string, { importance: number; alignment: number }>;
}

export interface ValuesCompassData {
	version: number;
	domains: ValueDomain[];
	goals: ValueGoal[];
	logs: ValueLogEntry[];
	savoring: SavoringEntry[];
	snapshots: AlignmentSnapshot[];
}

export interface ValuesCompassSettings {
	dataFilePath: string;
	showHiddenDomains: boolean;
}

export interface HeatmapCell {
	date: string;
	count: number;
	newSteps: number;
	level: 0 | 1 | 2 | 3 | 4;
}

export interface DomainAnalyticsRow {
	domain: ValueDomain;
	logCount: number;
	newStepCount: number;
	sharePct: number;
	gap: number;
	alignmentDelta: number | null;
}

export interface DeadGoalCheck {
	isDeadGoal: boolean;
	hint: string;
}