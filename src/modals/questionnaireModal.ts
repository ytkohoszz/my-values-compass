import { App, Modal, Notice } from "obsidian";
import { getDomainPrompts } from "../defaults";
import { ValuesStore } from "../store";
import { ValueDomain } from "../types";

export class QuestionnaireModal extends Modal {
	private store: ValuesStore;
	private domain: ValueDomain;
	private draftAnswers: Record<string, string>;
	private draftSummary: string;

	constructor(app: App, store: ValuesStore, domain: ValueDomain) {
		super(app);
		this.store = store;
		this.domain = domain;
		this.draftAnswers = { ...domain.questionnaireAnswers };
		this.draftSummary = domain.compassSummary;
	}

	onOpen(): void {
		this.modalEl.addClass("vc-modal");
		this.contentEl.empty();

		const root = this.contentEl.createDiv({ cls: "vc-root vc-modal-root" });

		const head = root.createDiv({ cls: "vc-modal-head" });
		head.createEl("h2", {
			cls: "vc-modal-title",
			text: `Опросник: ${this.domain.name}`,
		});
		head.createDiv({
			cls: "vc-modal-subtitle",
			text: "Фокусируйся только на том, что в твоей зоне контроля: каким ты хочешь быть и что привносить.",
		});

		const scroll = root.createDiv({ cls: "vc-modal-scroll" });
		const prompts = getDomainPrompts(this.domain.id);

		prompts.forEach((question, idx) => {
			const key = `q_${idx}`;
			const block = scroll.createDiv({ cls: "vc-q-block" });
			block.createDiv({ cls: "vc-q-label", text: `${idx + 1}. ${question}` });

			const area = block.createEl("textarea", {
				cls: "vc-textarea",
				attr: { rows: "2", placeholder: "Твой ответ..." },
			});
			area.value = this.draftAnswers[key] ?? "";
			area.addEventListener("input", () => {
				this.draftAnswers[key] = area.value;
			});
		});

		scroll.createEl("hr", { cls: "vc-hr" });

		const summaryBlock = scroll.createDiv({ cls: "vc-q-block" });
		const sumHead = summaryBlock.createDiv({ cls: "vc-insp-sec-head" });
		sumHead.createDiv({ cls: "vc-q-label", text: "Итоговый компас сферы" });

		const summaryArea = summaryBlock.createEl("textarea", {
			cls: "vc-textarea",
			attr: {
				rows: "3",
				placeholder: "Краткое резюме в 1–2 предложениях для карточки фокуса...",
			},
		});
		summaryArea.value = this.draftSummary;
		summaryArea.addEventListener("input", () => {
			this.draftSummary = summaryArea.value;
		});

		const synthesizeBtn = sumHead.createEl("button", {
			cls: "vc-btn vc-btn-subtle",
			text: "Собрать из ответов",
			attr: { type: "button" },
		});
		synthesizeBtn.addEventListener("click", () => {
			const parts = prompts
				.map((_, idx) => (this.draftAnswers[`q_${idx}`] ?? "").trim())
				.filter(Boolean);
			if (parts.length === 0) {
				new Notice("Сначала заполни хотя бы один ответ");
				return;
			}
			this.draftSummary = parts.join(" ");
			summaryArea.value = this.draftSummary;
		});

		const footer = root.createDiv({ cls: "vc-modal-footer" });
		const cancelBtn = footer.createEl("button", {
			cls: "vc-btn vc-btn-normal",
			text: "Отмена",
			attr: { type: "button" },
		});
		cancelBtn.addEventListener("click", () => this.close());

		const saveBtn = footer.createEl("button", {
			cls: "vc-btn vc-btn-cta",
			text: "Сохранить",
			attr: { type: "button" },
		});
		saveBtn.addEventListener("click", async () => {
			const cleaned: Record<string, string> = {};
			for (const [k, v] of Object.entries(this.draftAnswers)) {
				const trimmed = v.trim();
				if (trimmed) cleaned[k] = trimmed;
			}
			await this.store.updateDomain(this.domain.id, {
				questionnaireAnswers: cleaned,
				compassSummary: this.draftSummary.trim(),
			});
			new Notice("Ответы и компас сферы сохранены");
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}