import React, { useState } from 'react';
import { generatePlan, getCoachingAdvice } from '../services/aiService';
import { marked } from 'marked';

const AICoach = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('plan'); // 'plan' или 'coach'
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = mode === 'plan' 
        ? await generatePlan(prompt)
        : await getCoachingAdvice(prompt);
      setResponse(result);
    } catch (error) {
      setError('Произошла ошибка при обращении к AI. Убедитесь, что у вас есть API ключ Hugging Face и он правильно настроен.');
    }
    setLoading(false);
  };

  return (
    <div className="ai-coach">
      <div className="mode-selector">
        <button 
          className={mode === 'plan' ? 'active' : ''} 
          onClick={() => setMode('plan')}
        >
          План на день
        </button>
        <button 
          className={mode === 'coach' ? 'active' : ''} 
          onClick={() => setMode('coach')}
        >
          Коучинг
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mode === 'plan' 
            ? "Опишите, какой план вы хотите составить (например: 'Мне нужно подготовиться к важной встрече и сделать несколько звонков')"
            : "Опишите ситуацию, по которой нужен совет"
          }
          rows={4}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Генерация...' : 'Получить ответ'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {response && (
        <div 
          className="response"
          dangerouslySetInnerHTML={{ __html: marked(response) }}
        />
      )}

      <style jsx>{`
        .ai-coach {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .mode-selector {
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
        }

        .mode-selector button {
          padding: 10px 20px;
          border: 1px solid #ccc;
          border-radius: 5px;
          background: white;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .mode-selector button:hover {
          background: #f0f0f0;
        }

        .mode-selector button.active {
          background: #007bff;
          color: white;
          border-color: #0056b3;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 5px;
          resize: vertical;
          min-height: 100px;
          font-family: inherit;
        }

        button[type="submit"] {
          padding: 10px 20px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        button[type="submit"]:hover {
          background: #218838;
        }

        button[type="submit"]:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .error-message {
          margin-top: 20px;
          padding: 10px;
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          border-radius: 5px;
        }

        .response {
          margin-top: 20px;
          padding: 20px;
          border: 1px solid #ccc;
          border-radius: 5px;
          background: #f8f9fa;
        }
      `}</style>
    </div>
  );
};

export default AICoach;