import React from 'react';
import './AutoComplete.css';

/**
 * Компонент для отображения вариантов автодополнения
 */
const AutoComplete = ({ 
  suggestions, 
  position, 
  visible, 
  onSelect, 
  onDismiss,
  selectedIndex = 0
}) => {
  if (!visible || !suggestions.length) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'template':
        return '📝';
      case 'tag':
        return '#';
      case 'word':
        return '🔤';
      case 'phrase':
        return '📚';
      default:
        return '•';
    }
  };

  return (
    <div 
      className="auto-complete-container"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000
      }}
    >
      <div 
        className="auto-complete"
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          pointerEvents: 'auto'
        }}
      >
        <div className="auto-complete-list">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`auto-complete-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(suggestion.text)}
              onMouseEnter={() => onSelect(suggestion.text)}
            >
              <span className="auto-complete-icon">{getIcon(suggestion.type)}</span>
              <span className="auto-complete-text">{suggestion.text}</span>
              {suggestion.type === 'template' && (
                <span className="auto-complete-hint">шаблон</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Экспортируем компонент
export default AutoComplete; 