import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(import.meta.env.VITE_HUGGINGFACE_API_KEY);

/**
 * Универсальный ассистент: копирайтер, редактор, секретарь, помощник и др.
 * @param {string} userPrompt - Ваш запрос (например: "Сделай резюме текста", "Придумай письмо", "Составь план дня", "Проверь орфографию", "Объясни, почему так лучше").
 * @param {string} [role] - (опционально) Роль ассистента (например: "копирайтер", "редактор", "секретарь", "помощник").
 * @returns {Promise<string>} - Ответ AI.
 */
export const askAssistant = async (userPrompt, role = "помощник") => {
  const systemPrompt = `Ты — опытный ${role}. Пиши структурировано и в формате markdown.`;
  const chatCompletion = await client.chatCompletion({
    provider: "auto",
    model: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  });
  return chatCompletion.choices[0].message.content;
};

export const generatePlan = async (prompt) => {
  return askAssistant(prompt);
};

export const getCoachingAdvice = async (context) => {
  return askAssistant(context, "персональный коуч");
}; 