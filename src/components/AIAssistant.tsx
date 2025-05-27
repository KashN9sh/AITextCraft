import { useState } from 'react';
import styled from '@emotion/styled';
import OpenAI from 'openai';

const AssistantContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 300px;
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const ChatContainer = styled.div`
  height: 200px;
  overflow-y: auto;
  margin-bottom: 16px;
  color: #fff;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #2d2d2d;
  color: #fff;
  margin-bottom: 8px;
`;

const Button = styled.button`
  width: 100%;
  padding: 8px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #005999;
  }
`;

interface AIAssistantProps {
  onSuggestion: (suggestion: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ onSuggestion }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, `Вы: ${input}`];
    setMessages(newMessages);
    setInput('');

    try {
      const openai = new OpenAI({
        apiKey: process.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: input }],
        model: "gpt-3.5-turbo",
      });

      const response = completion.choices[0]?.message?.content || 'Извините, произошла ошибка';
      setMessages([...newMessages, `AI: ${response}`]);
      onSuggestion(response);
    } catch (error) {
      console.error('Error:', error);
      setMessages([...newMessages, 'AI: Произошла ошибка при обработке запроса']);
    }
  };

  return (
    <AssistantContainer>
      <ChatContainer>
        {messages.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </ChatContainer>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Введите ваш запрос..."
        onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <Button onClick={handleSubmit}>Отправить</Button>
    </AssistantContainer>
  );
};