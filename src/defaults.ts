import {
	DeadGoalCheck,
	GoalHorizon,
	ValueDomain,
	ValuesCompassData,
	ValuesCompassSettings,
} from "./types";

export const VIEW_TYPE_VALUES_COMPASS = "values-compass-view";
export const LEGACY_JSON_DATA_PATH = "_system/values-compass.json";
export const DEFAULT_DATA_FILE_PATH = "_system/values-compass.md";

export const DEFAULT_SETTINGS: ValuesCompassSettings = {
	dataFilePath: DEFAULT_DATA_FILE_PATH,
	showHiddenDomains: false,
};

export interface HorizonMeta {
	id: GoalHorizon;
	label: string;
	shortLabel: string;
}

export const HORIZON_LIST: HorizonMeta[] = [
	{ id: "immediate", label: "Сейчас", shortLabel: "Сейчас" },
	{ id: "short", label: "Неделя", shortLabel: "Неделя" },
	{ id: "mid", label: "Месяц", shortLabel: "Месяц" },
	{ id: "long", label: "Годы", shortLabel: "Годы" },
];

export const DOMAIN_ICON_OPTIONS: string[] = [
	"compass",
	"palette",
	"activity",
	"graduation-cap",
	"users",
	"heart",
	"message-circle",
	"sparkles",
	"brain",
	"music",
	"briefcase",
	"book-open",
	"flame",
	"target",
	"sun",
	"shield",
	"trees",
	"globe",
];

export function createDefaultDomains(nowIso: string): ValueDomain[] {
	const raw: Array<{ id: string; name: string; icon: string }> = [
		{ id: "family", name: "Семья", icon: "users" },
		{ id: "romance", name: "Отношения", icon: "heart" },
		{ id: "friendship", name: "Дружба", icon: "message-circle" },
		{ id: "work", name: "Работа и карьера", icon: "briefcase" },
		{ id: "growth", name: "Обучение и развитие", icon: "graduation-cap" },
		{ id: "leisure", name: "Отдых и творчество", icon: "palette" },
		{ id: "spirituality", name: "Смысл и тишина", icon: "sparkles" },
		{ id: "community", name: "Сообщество", icon: "globe" },
		{ id: "environment", name: "Среда и природа", icon: "trees" },
		{ id: "health", name: "Здоровье и тело", icon: "activity" },
	];

	return raw.map((item, idx) => ({
		id: item.id,
		name: item.name,
		icon: item.icon,
		hidden: false,
		isFocus: idx === 0,
		compassSummary: "",
		qualities: [],
		importance: 7,
		alignment: 0,
		updatedAt: nowIso,
		questionnaireAnswers: {},
	}));
}

export function createInitialData(): ValuesCompassData {
	const nowIso = new Date().toISOString();
	return {
		version: 1,
		domains: createDefaultDomains(nowIso),
		goals: [],
		logs: [],
		savoring: [],
		snapshots: [],
	};
}

const DEAD_GOAL_PATTERNS: RegExp[] = [
	/^не\s+/i,
	/^перестать\s+/i,
	/^бросить\s+/i,
	/^прекратить\s+/i,
	/^избавиться\s+от/i,
	/^избегать\s+/i,
	/^отказаться\s+от/i,
	/^меньше\s+/i,
	/^завязать\s+с/i,
	/^don'?t\s+/i,
	/^do\s+not\s+/i,
	/^stop\s+/i,
	/^quit\s+/i,
	/^avoid\s+/i,
	/^never\s+/i,
	/^no\s+more\s+/i,
];

export function checkDeadPersonGoal(title: string): DeadGoalCheck {
	const trimmed = title.trim();
	if (!trimmed) {
		return { isDeadGoal: false, hint: "" };
	}

	const matched = DEAD_GOAL_PATTERNS.some((rx) => rx.test(trimmed));
	if (!matched) {
		return { isDeadGoal: false, hint: "" };
	}

	return {
		isDeadGoal: true,
		hint: "Похоже на «цель мертвеца» (избегание). Сформулируй через живое действие: что конкретно ты будешь делать вместо этого?",
	};
}