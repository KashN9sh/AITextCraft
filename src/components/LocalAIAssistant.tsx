import { useState, useEffect } from 'react';
import styled from '@emotion/styled';

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

const ModelSelect = styled.select`
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #333;
  border-radius: 4px;
`;

interface LocalAIAssistantProps {
  onSuggestion: (suggestion: string) => void;
}

export const LocalAIAssistant: React.FC<LocalAIAssistantProps> = ({ onSuggestion }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('llama2:latest');
  const [isLoading, setIsLoading] = useState(false);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models.map((model: any) => model.name));
        setIsServerRunning(true);
      } else {
        setIsServerRunning(false);
      }
    } catch (error) {
      setIsServerRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, `Вы: ${input}`];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      if (!isServerRunning) {
        throw new Error('Сервер Ollama не запущен. Пожалуйста, проверьте состояние сервера.');
      }

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: input,
          stream: false,
          system: "Ты - русскоязычный ассистент. Ты ДОЛЖЕН отвечать ТОЛЬКО на русском языке. Даже если пользователь пишет на английском, отвечай на русском. Используй правильную русскую грамматику и пунктуацию."
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при обращении к серверу Ollama');
      }

      const data = await response.json();
      const aiResponse = data.response || 'Извините, произошла ошибка';

      setMessages([...newMessages, `AI: ${aiResponse}`]);
      onSuggestion(aiResponse);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Произошла ошибка при обработке запроса';
      setMessages([...newMessages, `AI: ${errorMessage}`]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AssistantContainer>
      {!isServerRunning && (
        <div style={{ color: '#ff6b6b', marginBottom: '10px' }}>
          ⚠️ Сервер Ollama не запущен. Пожалуйста, проверьте состояние сервера.
        </div>
      )}
      <ModelSelect
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        disabled={!isServerRunning}
      >
        {availableModels.map(model => (
          <option key={model} value={model}>{model}</option>
        ))}
      </ModelSelect>
      <ChatContainer>
        {messages.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
        {isLoading && <div>AI думает...</div>}
      </ChatContainer>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Введите ваш запрос..."
        onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
        disabled={isLoading || !isServerRunning}
      />
      <Button onClick={handleSubmit} disabled={isLoading || !isServerRunning}>
        {isLoading ? 'Отправка...' : 'Отправить'}
      </Button>
    </AssistantContainer>
  );
};