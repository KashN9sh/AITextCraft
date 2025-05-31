import React, { useState } from 'react';
import { askAssistant } from '../services/aiService';
import { marked } from 'marked';

const ROLES = [
  { value: 'помощник', label: 'Умный помощник' },
  { value: 'копирайтер', label: 'Копирайтер' },
  { value: 'редактор', label: 'Редактор' },
  { value: 'секретарь', label: 'Секретарь' },
  { value: 'аналитик', label: 'Аналитик' },
  { value: 'персональный коуч', label: 'Коуч' },
  { value: 'учитель', label: 'Учитель' },
  { value: 'маркетолог', label: 'Маркетолог' },
  { value: 'программист', label: 'Программист' },
];

const AICoach = () => {
  const [prompt, setPrompt] = useState('');
  const [role, setRole] = useState(ROLES[0].value);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse('');
    try {
      const result = await askAssistant(prompt, role);
      setResponse(result);
    } catch (error) {
      setError('Произошла ошибка при обращении к AI. Проверьте API ключ и интернет.');
    }
    setLoading(false);
  };

  return (
    <div className="ai-coach">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <select value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Введите ваш запрос (например: 'Сделай резюме текста', 'Придумай письмо', 'Проверь текст', 'Объясни решение')"
            style={{ flex: 1, padding: 10, borderRadius: 5, border: '1px solid #ccc' }}
          />
          <button type="submit" disabled={loading || !prompt.trim()} style={{ minWidth: 120 }}>
            {loading ? 'Генерация...' : 'Получить ответ'}
          </button>
        </div>
      </form>
      {error && (
        <div className="error-message">{error}</div>
      )}
      {response && (
        <div className="response" dangerouslySetInnerHTML={{ __html: marked(response) }} />
      )}
    </div>
  );
};

export default AICoach;