import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(import.meta.env.VITE_HUGGINGFACE_API_KEY);

export const getAIChatCompletion = async (messages) => {
  const chatCompletion = await client.chatCompletion({
    provider: "auto", // Можно заменить на другого провайдера
    model: "deepseek-ai/DeepSeek-R1-0528", // Можно заменить на другую модель
    messages,
  });
  return chatCompletion.choices[0].message.content;
};

export const generatePlan = async (prompt) => {
  return getAIChatCompletion([
    {
      role: "user",
      content: `Ты — персональный коуч. Составь план на день в формате markdown на основе следующего запроса: ${prompt}`,
    },
  ]);
};

export const getCoachingAdvice = async (context) => {
  return getAIChatCompletion([
    {
      role: "user",
      content: `Ты — персональный коуч. Дай совет в формате markdown на основе следующего контекста: ${context}`,
    },
  ]);
}; 