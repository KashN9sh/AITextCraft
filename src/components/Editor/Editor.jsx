import { useState, useRef, useCallback } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import EditorToolbar from './EditorToolbar';
import EditorBlock from './EditorBlock';
import { useEditorState } from '../../hooks/useEditorState';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { splitMarkdownBlocks } from '../../utils/markdownUtils';
import TableEditor from '../TableEditor';
import InlineTableEditor from '../InlineTableEditor';
import AutoComplete from '../AutoComplete';

const Editor = ({ 
  content, 
  onContentChange, 
  onSave,
  onToggleExplorer,
  onTogglePreview,
  onHomeClick
}) => {
  const [editingBlockIdx, setEditingBlockIdx] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [newBlockContent, setNewBlockContent] = useState("");
  const [isTableEditorOpen, setIsTableEditorOpen] = useState(false);
  const [currentTableData, setCurrentTableData] = useState(null);
  const editingRef = useRef(null);

  const {
    autoComplete,
    setAutoComplete,
    handleAutoCompleteSelect,
    hideAutoComplete,
    getCaretCoordinates
  } = useEditorState(editingRef);

  const handleBlockClick = useCallback((idx, block) => {
    setEditingBlockIdx(idx);
    setEditingContent(block);
    setTimeout(() => {
      if (editingRef.current) {
        editingRef.current.focus();
        editingRef.current.setSelectionRange(block.length, block.length);
      }
    }, 0);
  }, []);

  const handleBlockEdit = useCallback(async (e) => {
    const newContent = e.target.value;
    setEditingContent(newContent);
    
    // Логика автодополнения
    const textarea = e.target;
    const cursorPosition = textarea.selectionEnd;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    
    // Находим текущее слово или тег перед курсором
    let currentWord = '';
    let startPos = cursorPosition;
    
    const tagMatch = textBeforeCursor.match(/(?:^|\s)([#@][a-zа-яё0-9_-]*)$/i);
    if (tagMatch) {
      currentWord = tagMatch[1];
      startPos = textBeforeCursor.lastIndexOf(currentWord);
    } else {
      const wordMatch = textBeforeCursor.match(/([a-zа-яё0-9_-]+)$/i);
      if (wordMatch) {
        currentWord = wordMatch[1];
        startPos = textBeforeCursor.lastIndexOf(currentWord);
      }
    }
    
    if (currentWord && currentWord.length >= 2) {
      // Получаем подсказки для текущего слова
      const suggestions = await indexService.findCompletions(currentWord);
      
      if (suggestions.length > 0) {
        const { left, top } = getCaretCoordinates(textarea, cursorPosition);
        
        setAutoComplete({
          visible: true,
          suggestions,
          position: { x: left, y: top + 20 },
          prefix: currentWord,
          startPos,
          selectedIndex: 0
        });
      } else {
        hideAutoComplete();
      }
    } else {
      hideAutoComplete();
    }
  }, [setAutoComplete, hideAutoComplete, getCaretCoordinates]);

  const handleBlockBlur = useCallback(() => {
    if (editingBlockIdx === null) return;
    
    hideAutoComplete();
    
    const blocks = splitMarkdownBlocks(content);
    blocks[editingBlockIdx] = editingContent;
    onContentChange(blocks.join('\n\n'));
    setEditingBlockIdx(null);
    setEditingContent("");
  }, [editingBlockIdx, editingContent, content, onContentChange, hideAutoComplete]);

  const handleKeyDown = useKeyboardShortcuts({
    onEnter: (e) => {
      if (e.shiftKey) {
        e.preventDefault();
        handleBlockBlur();
      }
    },
    onEscape: () => {
      handleBlockBlur();
    }
  });

  const handleCheckboxClick = useCallback((checkboxIndex) => {
    const blocks = splitMarkdownBlocks(content);
    const block = blocks[editingBlockIdx];
    const lines = block.split('\n');
    
    if (checkboxIndex !== -1) {
      const line = lines[checkboxIndex];
      const isChecked = line.includes('[x]');
      lines[checkboxIndex] = line.replace(
        /\[([ x])\]/,
        isChecked ? '[ ]' : '[x]'
      );
      blocks[editingBlockIdx] = lines.join('\n');
      onContentChange(blocks.join('\n\n'));
    }
  }, [content, editingBlockIdx, onContentChange]);

  const handleTableButtonClick = useCallback(() => {
    setIsTableEditorOpen(true);
    setCurrentTableData(null);
  }, []);

  const handleTableSave = useCallback((markdownTable) => {
    if (editingBlockIdx !== null) {
      const blocks = splitMarkdownBlocks(content);
      blocks[editingBlockIdx] = markdownTable;
      onContentChange(blocks.join('\n\n'));
      setEditingContent(markdownTable);
    } else {
      onContentChange(content + (content ? '\n\n' : '') + markdownTable);
      setNewBlockContent('');
    }
    setIsTableEditorOpen(false);
  }, [content, editingBlockIdx, onContentChange]);

  const handleTableCancel = useCallback(() => {
    setIsTableEditorOpen(false);
  }, []);

  const handleInsertText = useCallback((prefix, suffix = '') => {
    if (editingBlockIdx !== null && editingRef.current) {
      const textarea = editingRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const selected = text.substring(start, end);
      const after = text.substring(end);
      
      const newValue = before + prefix + selected + suffix + after;
      setEditingContent(newValue);
      
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + prefix.length + selected.length + suffix.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  }, [editingBlockIdx]);

  const renderMarkdown = () => {
    const blocks = splitMarkdownBlocks(content);
    return [
      ...blocks.map((block, idx) => {
        const isTable = block.trim().startsWith('|') && block.includes('\n|') && block.includes('---');
        if (isTable) {
          return (
            <InlineTableEditor
              key={idx}
              markdown={block}
              onChange={newMarkdown => {
                const updatedBlocks = [...blocks];
                updatedBlocks[idx] = newMarkdown;
                onContentChange(updatedBlocks.join('\n\n'));
              }}
            />
          );
        }
        return (
          <EditorBlock
            key={idx}
            block={block}
            isEditing={editingBlockIdx === idx}
            onEdit={handleBlockEdit}
            onBlur={handleBlockBlur}
            onKeyDown={handleKeyDown}
            editingRef={editingRef}
            editingContent={editingContent}
            onClick={() => handleBlockClick(idx, block)}
            onCheckboxClick={handleCheckboxClick}
          />
        );
      }),
      <div key="new-block" className="new-block-container">
        <input
          type="text"
          placeholder="Введите '/' для команд или начните печатать..."
          value={newBlockContent}
          onChange={(e) => setNewBlockContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlockBlur}
          className="new-block-input"
        />
      </div>
    ];
  };

  return (
    <div className="editor-container">
      <EditorToolbar 
        onSave={onSave}
        onToggleExplorer={onToggleExplorer}
        onTogglePreview={onTogglePreview}
        onHomeClick={onHomeClick}
        onInsertText={handleInsertText}
        onTableButtonClick={handleTableButtonClick}
      />
      <div className="preview markdown-body">
        {renderMarkdown()}
      </div>
      {autoComplete.visible && (
        <AutoComplete
          suggestions={autoComplete.suggestions}
          position={autoComplete.position}
          onSelect={handleAutoCompleteSelect}
          selectedIndex={autoComplete.selectedIndex}
        />
      )}
      {isTableEditorOpen && (
        <TableEditor
          initialData={currentTableData}
          onSave={handleTableSave}
          onCancel={handleTableCancel}
        />
      )}
    </div>
  );
};

export default Editor; 