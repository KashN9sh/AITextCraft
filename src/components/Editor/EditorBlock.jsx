import { useEffect } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';

const EditorBlock = ({
  block,
  isEditing,
  onEdit,
  onBlur,
  onKeyDown,
  editingRef,
  editingContent,
  onClick,
  onCheckboxClick
}) => {
  useEffect(() => {
    if (isEditing && editingRef.current) {
      editingRef.current.style.height = '';
      editingRef.current.style.height = 'auto';
      editingRef.current.style.height = editingRef.current.scrollHeight + 'px';
    }
  }, [isEditing, editingRef, editingContent]);

  useEffect(() => {
    try {
      hljs.highlightAll();
    } catch (err) {
      console.error('Error highlighting code:', err);
    }
  }, [isEditing, editingContent]);

  const handleCheckboxClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onCheckboxClick) {
      const checkboxIndex = Array.from(e.target.closest('.markdown-block').querySelectorAll('.checkbox-item')).indexOf(e.target.closest('.checkbox-item'));
      onCheckboxClick(checkboxIndex);
    }
  };

  if (isEditing) {
    return (
      <div className="editing-block-container">
        <textarea
          ref={editingRef}
          value={editingContent}
          onChange={onEdit}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className="editing-block"
          placeholder="Начните ввод или вставьте содержимое..."
          onFocus={e => {
            e.target.style.height = '';
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
        />
        <div className="editing-controls">
          <button 
            className="done-button"
            onClick={onBlur}
            title="Готово (Shift + Enter)"
          >
            Готово
          </button>
          <span className="editing-hint">Shift + Enter для сохранения</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="markdown-block"
      onClick={onClick}
      style={{ cursor: 'text' }}
      data-markdown={block}
      dangerouslySetInnerHTML={{ __html: renderMarkdownWithCheckboxes(block) }}
      onMouseDown={(e) => {
        if (e.target.type === 'checkbox') {
          handleCheckboxClick(e);
        }
      }}
    />
  );
};

const renderMarkdownWithCheckboxes = (text) => {
  const withCheckboxes = text.split('\n').map(line => {
    if (line.trim().startsWith('- [')) {
      return line.replace(
        /- \[([ x])\](.*)/,
        (match, checked, content) => {
          const isChecked = checked === 'x';
          return `<div class="checkbox-item"><input type="checkbox" ${isChecked ? 'checked' : ''} />${content}</div>`;
        }
      );
    }
    return line;
  }).join('\n');
  
  return marked(withCheckboxes);
};

export default EditorBlock; 