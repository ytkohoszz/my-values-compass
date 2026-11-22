import {
	DeadGoalCheck,
	GoalHorizon,
	ValueDomain,
	ValuesCompassData,
	ValuesCompassSettings,
} from "./types";

export const VIEW_TYPE_VALUES_COMPASS = "values-compass-view";

export const DEFAULT_SETTINGS: ValuesCompassSettings = {
	dataFilePath: "_system/values-compass.json",
	showHiddenDomains: false,
};

export interface HorizonMeta {
	id: GoalHorizon;
	label: string;
	shortLabel: string;
	hint: string;
}

export const HORIZON_LIST: HorizonMeta[] = [
	{
		id: "immediate",
		label: "Сейчас",
		shortLabel: "Сегодня",
		hint: "Самый маленький и простой шаг, который можно сделать сегодня",
	},
	{
		id: "short",
		label: "Ближайшие недели",
		shortLabel: "Недели",
		hint: "Конкретные действия на ближайшие дни и недели",
	},
	{
		id: "mid",
		label: "Месяцы",
		shortLabel: "Месяцы",
		hint: "Ощутимые вызовы на горизонте 1–6 месяцев",
	},
	{
		id: "long",
		label: "Годы",
		shortLabel: "Годы",
		hint: "Крупные вехи и направление на 1–5 лет",
	},
];

export const DOMAIN_PROMPTS: Record<string, string[]> = {
	family: [
		"Каким сыном, братом или родственником я хочу быть?",
		"Какие личные качества я хочу привносить в эти отношения?",
		"Какие регулярные совместные действия для меня важны?",
	],
	romance: [
		"Каким партнёром я хочу быть в близких отношениях?",
		"Как бы я относился к партнёру, действуя из лучшей версии себя?",
		"Какие отношения и общие ритуалы я хочу выстраивать?",
	],
	friendship: [
		"Что для меня значит быть хорошим другом?",
		"Какие качества я хочу проявлять в дружбе?",
		"Чем мне хочется регулярно заниматься с друзьями?",
	],
	work: [
		"Каким специалистом я хочу быть на работе?",
		"Какие качества я хочу привносить в рабочий процесс и общение с коллегами?",
		"Что сделает мою текущую работу более осмысленной?",
	],
	growth: [
		"Что я ценю в обучении и развитии навыков?",
		"Каким учеником/исследователем я хочу быть?",
		"Какие новые знания и умения по-настоящему тянут меня вперёд?",
	],
	leisure: [
		"Как я хочу отдыхать, восстанавливаться и получать удовольствие?",
		"В чём и как мне хочется проявлять творчество?",
		"Какие новые или забытые занятия я хочу вернуть в жизнь?",
	],
	spirituality: [
		"Что даёт мне ощущение глубины, тишины и опоры?",
		"Какие регулярные практики помогают мне возвращаться в настоящий момент?",
	],
	community: [
		"Какой вклад я хочу вносить в окружающее сообщество?",
		"Какие инициативы, группы или дела я хочу поддерживать?",
	],
	environment: [
		"Как я хочу заботиться о пространстве вокруг себя — дома, на работе и на природе?",
		"В каких местах и на какой природе я хочу бывать чаще?",
	],
	health: [
		"Как я хочу заботиться о своём теле?",
		"Какую физическую форму и самочувствие я хочу выстраивать?",
		"Как я хочу относиться ко сну, питанию и нагрузкам?",
	],
};

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
		alignment: 5,
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