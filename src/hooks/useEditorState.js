import { useState, useCallback } from 'react';
import indexService from '../services/indexService';

export const useEditorState = (editingRef) => {
  const [autoComplete, setAutoComplete] = useState({
    visible: false,
    suggestions: [],
    position: { x: 0, y: 0 },
    prefix: "",
    selectedIndex: null
  });

  const hideAutoComplete = useCallback(() => {
    setAutoComplete(prev => ({ 
      ...prev, 
      visible: false, 
      suggestions: [], 
      selectedIndex: null 
    }));
  }, []);

  const handleAutoCompleteSelect = useCallback((text) => {
    const { prefix, startPos } = autoComplete;
    
    if (editingRef?.current) {
      const textarea = editingRef.current;
      const cursorPosition = textarea.selectionEnd;
      
      const textBefore = textarea.value.substring(0, startPos);
      const textAfter = textarea.value.substring(cursorPosition);
      const newValue = textBefore + text + textAfter;
      
      setEditingContent(newValue);
      
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = startPos + text.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
    
    hideAutoComplete();
  }, [autoComplete, hideAutoComplete, editingRef]);

  const getCaretCoordinates = useCallback((textarea, position) => {
    const { offsetLeft, offsetTop } = textarea;
    const div = document.createElement('div');
    const style = getComputedStyle(textarea);
    
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'padding', 'border', 'boxSizing'].forEach(prop => {
      div.style[prop] = style[prop];
    });
    
    div.style.position = 'absolute';
    div.style.top = '0';
    div.style.left = '0';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.width = `${textarea.clientWidth}px`;
    
    const textBeforeCursor = textarea.value.substring(0, position);
    div.textContent = textBeforeCursor;
    
    const span = document.createElement('span');
    span.textContent = textarea.value.substring(position) || '.';
    div.appendChild(span);
    
    document.body.appendChild(div);
    const { offsetLeft: spanLeft, offsetTop: spanTop } = span;
    document.body.removeChild(div);
    
    return { left: spanLeft, top: spanTop };
  }, []);

  return {
    autoComplete,
    setAutoComplete,
    hideAutoComplete,
    handleAutoCompleteSelect,
    getCaretCoordinates
  };
}; 