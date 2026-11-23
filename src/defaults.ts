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

export interface FearItemMeta {
	id: "fusion" | "expectations" | "avoidance" | "remoteness";
	letter: string;
	title: string;
	shortDesc: string;
	actionTitle: string;
	counterMove: string;
}

export const FEAR_ITEMS: FearItemMeta[] = [
	{
		id: "fusion",
		letter: "F",
		title: "Слияние с мыслями",
		shortDesc: "«Не получится», «я не готов», «это глупо»",
		actionTitle: "Отцепиться от «Радио Катастроф»",
		counterMove:
			"Мысль — просто набор слов, а не приказ. Поблагодари разум за комментарий и выбери крошечный шаг, который сделаешь вместе с этой мыслью.",
	},
	{
		id: "expectations",
		letter: "E",
		title: "Завышенные ожидания",
		shortDesc: "Планка слишком высока, страшно даже начать",
		actionTitle: "Снизить порог входа до 5 минут",
		counterMove:
			"Разбей задачу до смешно простого Immediate-шага. Важно развернуть корабль к берегу прямо сейчас, а не доплыть за один вечер.",
	},
	{
		id: "avoidance",
		letter: "A",
		title: "Избегание дискомфорта",
		shortDesc: "Ожидание тревоги, скуки или неловкости",
		actionTitle: "Освободить место для чувства и действовать",
		counterMove:
			"Уверенность приходит после действий, а не до них. Проведи 60-секундную репетицию: представь сами действия, допуская наличие дискомфорта.",
	},
	{
		id: "remoteness",
		letter: "R",
		title: "Потеря связи с ценностью",
		shortDesc: "Цель ощущается как сухая обязанность",
		actionTitle: "Вернуть смысл и топливо",
		counterMove:
			"Спроси себя: «Ради какой ценности я это делаю?». Распакуй цель и найди действие, которое принесёт отклик уже сегодня.",
	},
];

export interface DeepClarificationPrompt {
	id: string;
	title: string;
	question: string;
}

export const DEEP_CLARIFICATION_PROMPTS: DeepClarificationPrompt[] = [
	{
		id: "full_approval",
		title: "Без оглядки на одобрение",
		question:
			"Если бы чудом все значимые для тебя люди автоматически одобряли любые твои решения — чем бы ты занялся и каким человеком старался бы быть?",
	},
	{
		id: "one_year",
		title: "Если остался один год",
		question:
			"Если бы ты знал, что впереди ровно один год жизни — как бы ты проявлял себя как личность и на что тратил время?",
	},
	{
		id: "eulogy",
		title: "Речь близких",
		question:
			"Что бы ты хотел услышать от близких о себе и о той роли, которую ты сыграл в их жизни?",
	},
	{
		id: "conflict",
		title: "Конфликт ценностей",
		question:
			"Какие две твои ценности сейчас тянут в разные стороны? Какой честный баланс или приоритет разумен именно на этом этапе жизни?",
	},
];

export function createInitialData(): ValuesCompassData {
	const nowIso = new Date().toISOString();
	return {
		version: 1,
		domains: createDefaultDomains(nowIso),
		goals: [],
		logs: [],
		savoring: [],
		snapshots: [],
		reflections: [],
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