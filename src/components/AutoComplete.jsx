import { useState, useEffect, useRef } from 'react';

/**
 * Компонент для отображения вариантов автодополнения
 */
function AutoComplete({ 
  suggestions, 
  position, 
  visible, 
  onSelect, 
  onDismiss,
  selectedIndex = 0
}) {
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);
  const autoCompleteRef = useRef(null);

  // Обновляем текущий индекс при изменении выбранного индекса
  useEffect(() => {
    setCurrentIndex(selectedIndex);
  }, [selectedIndex]);
  
  // Обновляем текущий индекс при изменении списка подсказок
  useEffect(() => {
    if (suggestions.length > 0) {
      setCurrentIndex(0);
    }
  }, [suggestions]);

  // Обработчик нажатия клавиш для навигации по списку
  const handleKeyNavigation = (e) => {
    if (!visible || suggestions.length === 0) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setCurrentIndex((prev) => (prev + 1) % suggestions.length);
        return true;

      case 'ArrowUp':
        e.preventDefault();
        setCurrentIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return true;

      case 'Tab':
      case 'Enter':
        e.preventDefault();
        onSelect(suggestions[currentIndex].text);
        return true;

      case 'Escape':
        e.preventDefault();
        onDismiss();
        return true;

      default:
        return false;
    }
  };

  // Если нет подсказок или компонент не должен быть видимым, не рендерим
  if (!visible || suggestions.length === 0) {
    return null;
  }

  // Получаем стиль для позиционирования
  const style = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 9999,
    backgroundColor: 'var(--glass-bg)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 4px 16px var(--glass-shadow)',
    borderRadius: '8px',
    maxWidth: '300px',
    maxHeight: '200px',
    overflow: 'auto',
    padding: '4px 0',
    pointerEvents: 'auto',
  };

  return (
    <div 
      ref={autoCompleteRef} 
      style={style} 
      className="autocomplete-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <ul style={{ 
        listStyle: 'none', 
        margin: 0, 
        padding: 0,
        backgroundColor: 'var(--glass-bg)',
      }}>
        {suggestions.map((suggestion, index) => (
          <li
            key={index}
            className={`autocomplete-item ${index === currentIndex ? 'selected' : ''}`}
            onClick={() => onSelect(suggestion.text)}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              backgroundColor: index === currentIndex ? 'var(--primary-color)' : 'transparent',
              color: index === currentIndex ? 'white' : 'var(--text-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'background-color 0.2s ease, color 0.2s ease',
              '&:hover': {
                backgroundColor: 'var(--primary-color)',
                color: 'white',
              }
            }}
          >
            <span>{suggestion.text}</span>
            <span style={{ opacity: 0.6, fontSize: '0.8em' }}>
              {suggestion.type === 'tag' ? '#тег' : 
               suggestion.type === 'phrase' ? 'фраза' : 'слово'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Экспортируем компонент
export default AutoComplete; 