import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "highlight.js/lib/languages/javascript";
import "highlight.js/lib/languages/python";
import "highlight.js/lib/languages/java";
import "highlight.js/lib/languages/cpp";
import "highlight.js/lib/languages/csharp";
import "highlight.js/lib/languages/php";
import "highlight.js/lib/languages/ruby";
import "highlight.js/lib/languages/go";
import "highlight.js/lib/languages/rust";
import "highlight.js/lib/languages/swift";
import "highlight.js/lib/languages/kotlin";
import "highlight.js/lib/languages/typescript";
import "highlight.js/lib/languages/css";
import "highlight.js/lib/languages/xml";
import "highlight.js/lib/languages/json";
import "highlight.js/lib/languages/yaml";
import "highlight.js/lib/languages/markdown";
import "highlight.js/lib/languages/bash";
import "highlight.js/lib/languages/sql";
import "./App.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faSave, faFolderOpen, faEye, faEdit, faHome, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import FileExplorer from "./components/FileExplorer";
import WelcomeScreen from "./components/WelcomeScreen";
import { listen } from '@tauri-apps/api/event';
import { useSpring, animated } from 'react-spring';
import AutoComplete from "./components/AutoComplete";
import indexService from "./services/indexService";
import TableEditor from "./components/TableEditor";
import InlineTableEditor from './components/InlineTableEditor';
import Editor from "./components/Editor/Editor";

// Настраиваем marked для использования highlight.js и поддержки чекбоксов
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error('Error highlighting code:', err);
        return code;
      }
    }
    try {
      return hljs.highlightAuto(code).value;
    } catch (err) {
      console.error('Error auto-highlighting code:', err);
      return code;
    }
  },
  gfm: true,
  breaks: true,
  headerIds: true,
  mangle: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: true,
  xhtml: false
});

// Добавляем поддержку чекбоксов
const renderer = new marked.Renderer();
renderer.checkbox = function(checked) {
  console.log('Rendering checkbox, checked:', checked); // Отладочная информация
  const isChecked = typeof checked === 'object' ? checked.checked : Boolean(checked);
  return `<input type="checkbox" ${isChecked ? 'checked' : ''} disabled />`;
};
marked.use({ renderer });

// Добавляем функцию дебаунсинга
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function App() {
  const [documents, setDocuments] = useState({}); // Хранит все документы: { filePath: { pages: [], currentPageId: number } }
  const [currentDocument, setCurrentDocument] = useState(null); // Текущий открытый документ
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("untitled.md");
  const [isPreview, setIsPreview] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [currentDirectory, setCurrentDirectory] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isTableEditorOpen, setIsTableEditorOpen] = useState(false);
  const [tableEditorPosition, setTableEditorPosition] = useState(null);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, pageId: null });
  const [renamingPageId, setRenamingPageId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameMenu, setRenameMenu] = useState({ show: false, x: 0, y: 0, pageId: null });
  const textareaRef = useRef(null);
  const [clipboard, setClipboard] = useState("");
  const [editingBlockIdx, setEditingBlockIdx] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const editingRef = useRef(null);
  const [newBlockContent, setNewBlockContent] = useState("");
  
  // Состояние для автодополнения
  const [autoComplete, setAutoComplete] = useState({
    visible: false,
    suggestions: [],
    position: { x: 0, y: 0 },
    prefix: "",
    selectedIndex: null
  });

  // Добавляем состояние для хранения данных текущей таблицы
  const [currentTableData, setCurrentTableData] = useState(null);

  // Добавляем состояние для панели форматирования текста
  const [textToolbar, setTextToolbar] = useState({
    visible: false,
    position: { x: 0, y: 0 }
  });

  // Получаем текущие страницы и ID текущей страницы
  const currentPages = currentDocument ? documents[currentDocument]?.pages || [] : [];
  const currentPageId = currentDocument ? documents[currentDocument]?.currentPageId || 1 : 1;

  // Эффект для автоматического изменения высоты текстового поля
  useEffect(() => {
    const adjustTextareaHeight = (textarea) => {
      if (!textarea) return;
      textarea.style.height = '';
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    };

    if (editingRef.current) {
      adjustTextareaHeight(editingRef.current);
    }
  }, [editingContent]);

  useEffect(() => {
    try {
      hljs.highlightAll();
    } catch (err) {
      console.error('Error highlighting code:', err);
    }
  }, [editingBlockIdx, editingContent, content]);

  const handleSave = useCallback(async () => {
    if (!currentDocument) return;

    try {
      const documentData = {
        pages: currentPages
      };

      await invoke("save_file", {
        content: JSON.stringify(documentData, null, 2),
        fileName: currentDocument
      });
      alert("Файл успешно сохранен!");
    } catch (error) {
      alert("Ошибка при сохранении файла: " + error);
    }
  }, [currentDocument, currentPages]);

  const handleFileSelect = async (fileItem) => {
    // Если есть текущий документ, сохраняем его перед переключением
    if (currentDocument) {
      try {
        const currentDocData = {
          pages: currentPages
        };
        await invoke("save_file", {
          content: JSON.stringify(currentDocData, null, 2),
          fileName: currentDocument
        });
      } catch (error) {
        console.error("Ошибка при сохранении текущего документа:", error);
      }
    }

    setFileName(fileItem.path);
    
    try {
      const loadedContent = await invoke("load_file", { fileName: fileItem.path });
      
      // Парсим JSON из содержимого файла
      try {
        const documentData = JSON.parse(loadedContent);
        if (documentData.pages && Array.isArray(documentData.pages)) {
          // Обновляем документы
          setDocuments(prev => ({
            ...prev,
            [fileItem.path]: {
              pages: documentData.pages,
              currentPageId: documentData.pages[0]?.id || 1
            }
          }));
          setCurrentDocument(fileItem.path);
          setContent(documentData.pages[0]?.content || "");
        } else {
          // Если это старый формат (просто markdown), конвертируем в новый
          const newPages = [{ id: 1, title: "Страница 1", content: loadedContent }];
          setDocuments(prev => ({
            ...prev,
            [fileItem.path]: {
              pages: newPages,
              currentPageId: 1
            }
          }));
          setCurrentDocument(fileItem.path);
          setContent(loadedContent);
        }
      } catch (e) {
        // Если не удалось распарсить JSON, считаем что это старый формат
        const newPages = [{ id: 1, title: "Страница 1", content: loadedContent }];
        setDocuments(prev => ({
          ...prev,
          [fileItem.path]: {
            pages: newPages,
            currentPageId: 1
          }
        }));
        setCurrentDocument(fileItem.path);
        setContent(loadedContent);
      }
    } catch (error) {
      console.error("Ошибка при загрузке файла:", error);
      alert("Ошибка при загрузке файла: " + error);
    }
  };

  const handleDirectorySelect = (directory) => {
    setCurrentDirectory(directory);
    setShowWelcome(false);
  };

  const handleHomeClick = () => {
    setShowWelcome(true);
  };

  // Разбиваем markdown на блоки (параграфы и блоки кода)
  const splitMarkdownBlocks = (text) => {
    const lines = text.split('\n');
    const blocks = [];
    let current = [];
    let inCode = false;

    for (let line of lines) {
      if (line.startsWith('```')) {
        inCode = !inCode;
        current.push(line);
        if (!inCode) {
          blocks.push(current.join('\n'));
          current = [];
        }
        continue;
      }
      if (inCode) {
        current.push(line);
        continue;
      }
      if (line.trim() === '') {
        if (current.length) {
          blocks.push(current.join('\n'));
          current = [];
        }
      } else {
        current.push(line);
      }
    }
    if (current.length) blocks.push(current.join('\n'));
    return blocks;
  };

  // Клик по блоку для редактирования
  const handleBlockClick = (idx, block) => {
    console.log('Block clicked:', idx, block);
    setEditingBlockIdx(idx);
    setEditingContent(block);
    setTimeout(() => {
      if (editingRef.current) {
        editingRef.current.focus();
        editingRef.current.setSelectionRange(block.length, block.length);
      }
    }, 0);
  };

  // Модифицированный обработчик изменения текста блока
  const handleBlockEdit = async (e) => {
    const textarea = e.target;
    setEditingContent(textarea.value);
    
    // Автоматическое изменение высоты
    textarea.style.height = '';
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    
    // Логика автодополнения
    const cursorPosition = textarea.selectionEnd;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    
    // Находим текущее слово или тег перед курсором
    let currentWord = '';
    let startPos = cursorPosition;
    
    // Ищем теги, начинающиеся с @ или #
    const tagMatch = textBeforeCursor.match(/(?:^|\s)([#@][a-zа-яё0-9_-]*)$/i);
    if (tagMatch) {
      currentWord = tagMatch[1];
      startPos = textBeforeCursor.lastIndexOf(currentWord);
    } else {
      // Ищем обычные слова
      const wordMatch = textBeforeCursor.match(/([a-zа-яё0-9_-]+)$/i);
      if (wordMatch) {
        currentWord = wordMatch[1];
        startPos = textBeforeCursor.lastIndexOf(currentWord);
      }
    }
    
    if (currentWord && currentWord.length >= 2) {
      console.log('Поиск автодополнений для:', currentWord); // Отладочный вывод
      // Получаем подсказки для текущего слова
      const suggestions = await indexService.findCompletions(currentWord);
      
      if (suggestions.length > 0) {
        // Расчитываем позицию для отображения автодополнения
        const textareaRect = textarea.getBoundingClientRect();
        const { left, top } = getCaretCoordinates(textarea, cursorPosition);
        
        // Учитываем скролл страницы и позицию textarea
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        console.log('Позиция для автодополнения:', {
          textareaRect,
          caretCoords: { left, top },
          scroll: { scrollLeft, scrollTop },
          finalPosition: {
            x: textareaRect.left + left + scrollLeft,
            y: textareaRect.top + top + scrollTop + 20
          }
        }); // Отладочный вывод
        
        setAutoComplete({
          visible: true,
          suggestions,
          position: { 
            x: textareaRect.left + left + scrollLeft,
            y: textareaRect.top + top + scrollTop + 20
          },
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
  };
  
  // Функция для скрытия автодополнения
  const hideAutoComplete = () => {
    setAutoComplete(prev => ({ ...prev, visible: false, suggestions: [], selectedIndex: null }));
  };
  
  // Получение координат каретки в textarea
  const getCaretCoordinates = (textarea, position) => {
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
    
    console.log('Координаты каретки:', { left: spanLeft, top: spanTop }); // Отладочный вывод
    console.log('Размеры textarea:', { 
      clientWidth: textarea.clientWidth,
      clientHeight: textarea.clientHeight,
      offsetLeft,
      offsetTop
    }); // Отладочный вывод
    
    return { left: spanLeft, top: spanTop };
  };
  
  // Обработчик выбора варианта автодополнения
  const handleAutoCompleteSelect = (text) => {
    const { prefix, startPos } = autoComplete;
    
    // Если редактируем существующий блок
    if (editingBlockIdx !== null && editingRef.current) {
      const textarea = editingRef.current;
      const cursorPosition = textarea.selectionEnd;
      
      // Заменяем текущее слово на выбранное
      const textBefore = textarea.value.substring(0, startPos);
      const textAfter = textarea.value.substring(cursorPosition);
      const newValue = textBefore + text + textAfter;
      
      setEditingContent(newValue);
      
      // Устанавливаем курсор после вставленного текста
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = startPos + text.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } 
    // Если редактируем новый блок
    else {
      const textareaElement = document.querySelector('textarea[placeholder="Новый блок..."]');
      if (textareaElement) {
        const cursorPosition = textareaElement.selectionEnd;
        
        // Заменяем текущее слово на выбранное
        const textBefore = textareaElement.value.substring(0, startPos);
        const textAfter = textareaElement.value.substring(cursorPosition);
        const newValue = textBefore + text + textAfter;
        
        setNewBlockContent(newValue);
        
        // Устанавливаем курсор после вставленного текста
        setTimeout(() => {
          textareaElement.focus();
          const newCursorPos = startPos + text.length;
          textareaElement.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    }
    
    hideAutoComplete();
  };
  
  // Модифицированный обработчик нажатия клавиш для поддержки автодополнения
  const handleBlockKeyDown = (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleBlockBlur();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      handleBlockBlur();
      return;
    }

    // Обработка навигации по автокомплиту
    if (autoComplete.visible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutoComplete(prev => ({
          ...prev,
          selectedIndex: prev.selectedIndex === null ? 0 : 
            (prev.selectedIndex + 1) % prev.suggestions.length
        }));
        return;
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutoComplete(prev => ({
          ...prev,
          selectedIndex: prev.selectedIndex === null ? prev.suggestions.length - 1 :
            (prev.selectedIndex - 1 + prev.suggestions.length) % prev.suggestions.length
        }));
        return;
      }

      // Обработка Enter для автодополнения
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (autoComplete.selectedIndex !== null && autoComplete.suggestions[autoComplete.selectedIndex]) {
          handleAutoCompleteSelect(autoComplete.suggestions[autoComplete.selectedIndex].text);
        }
        return;
      }
    }

    // Обработка обычного Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + '\n' + value.substring(end);
      setEditingContent(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      }, 0);
      return;
    }

    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // --- Авто-закрытие парных символов ---
    const pairs = {
      '*': '*',
      '`': '`',
      '[': ']',
      '(': ')',
      '"': '"',
      '{': '}',
      '<': '>'
    };
    
    if (
      Object.keys(pairs).includes(e.key) &&
      !e.ctrlKey && !e.metaKey && !e.altKey && start === end
    ) {
      e.preventDefault();
      const before = value.substring(0, start);
      const after = value.substring(end);
      const newValue = before + e.key + pairs[e.key] + after;
      if (editingBlockIdx !== null) {
        setEditingContent(newValue);
      } else {
        setNewBlockContent(newValue);
      }
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      }, 0);
      return;
    }

    // --- Автоматическое форматирование заголовков ---
    if (e.key === ' ' && value.substring(start - 1, start) === '#') {
      const before = value.substring(0, start - 1);
      const after = value.substring(end);
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1];
      
      if (currentLine.match(/^#+$/)) {
        e.preventDefault();
        const level = currentLine.length;
        const newValue = before + ' ' + after;
        if (editingBlockIdx !== null) {
          setEditingContent(newValue);
        } else {
          setNewBlockContent(newValue);
        }
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start, start);
        }, 0);
        return;
      }
    }

    // --- Умные ссылки ---
    if (e.key === 'Enter' && start === end) {
      const before = value.substring(0, start);
      const after = value.substring(end);
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1];
      
      if (currentLine.match(/^(https?:\/\/[^\s]+)$/)) {
        e.preventDefault();
        const url = currentLine;
        const newValue = before.replace(url, '') + `[${url}](${url})` + after;
        if (editingBlockIdx !== null) {
          setEditingContent(newValue);
        } else {
          setNewBlockContent(newValue);
        }
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + url.length + 4, start + url.length + 4);
        }, 0);
        return;
      }
    }

    // --- Автоматическое форматирование таблиц ---
    if (e.key === '|') {
      const before = value.substring(0, start);
      const after = value.substring(end);
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1];
      
      if (!currentLine.includes('|')) {
        e.preventDefault();
        const newValue = before + '| | |\n| --- | --- |\n| | |' + after;
        if (editingBlockIdx !== null) {
          setEditingContent(newValue);
        } else {
          setNewBlockContent(newValue);
        }
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
        return;
      }
    }

    // --- Умные списки задач ---
    if (e.key === '[' && value.substring(start - 2, start) === '- ') {
      e.preventDefault();
      const newValue = value.substring(0, start) + '[ ]' + value.substring(end);
      if (editingBlockIdx !== null) {
        setEditingContent(newValue);
      } else {
        setNewBlockContent(newValue);
      }
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 3, start + 3);
      }, 0);
      return;
    }

    // --- Автоматическое продолжение списков ---
    if (e.key === "Enter") {
      const before = value.substring(0, start);
      const after = value.substring(start);
      const lines = before.split("\n");
      const prevLine = lines[lines.length - 1];
      const match = prevLine.match(/^(\s*)([-*+] |\d+\. )/);
      
      if (match) {
        e.preventDefault();
        const indent = match[1] || "";
        const marker = match[2] || "";
        
        if (prevLine.trim() === marker.trim()) {
          const newValue = before.replace(/\n?$/, "") + "\n" + after;
          if (editingBlockIdx !== null) {
            setEditingContent(newValue);
          } else {
            setNewBlockContent(newValue);
          }
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start - marker.length, start - marker.length);
          }, 0);
        } else {
          const newValue = before + "\n" + indent + marker + after;
          if (editingBlockIdx !== null) {
            setEditingContent(newValue);
          } else {
            setNewBlockContent(newValue);
          }
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + 1 + indent.length + marker.length, start + 1 + indent.length + marker.length);
          }, 0);
        }
        return;
      }
    }
  };

  // Обработчик потери фокуса должен скрывать автодополнение
  const handleBlockBlur = () => {
    if (editingBlockIdx === null) return;
    
    // Скрываем автодополнение
    hideAutoComplete();
    
    const blocks = splitMarkdownBlocks(content);
    blocks[editingBlockIdx] = editingContent;
    setContent(blocks.join('\n\n'));
    setEditingBlockIdx(null); // Сбрасываем индекс редактируемого блока
    setEditingContent(""); // Очищаем содержимое редактируемого блока
  };

  // Анимация для контейнера редактора
  const editorAnimation = useSpring({
    from: { 
      opacity: 0,
      transform: 'translateY(100%)'
    },
    to: { 
      opacity: showWelcome ? 0 : 1,
      transform: showWelcome ? 'translateY(100%)' : 'translateY(0%)'
    },
    config: {
      tension: 400,
      friction: 30,
      mass: 1
    }
  });

  // Анимация для приветственного экрана
  const welcomeAnimation = useSpring({
    from: { 
      opacity: 1,
      transform: 'translateY(0%)'
    },
    to: { 
      opacity: showWelcome ? 1 : 0,
      transform: showWelcome ? 'translateY(0%)' : 'translateY(-100%)'
    },
    config: {
      tension: 400,
      friction: 30,
      mass: 1
    }
  });

  // Анимация для файлового проводника
  const explorerAnimation = useSpring({
    from: { 
      opacity: 0,
      transform: 'translateX(-100%)',
      width: 0
    },
    to: { 
      opacity: isExplorerOpen ? 1 : 0,
      transform: isExplorerOpen ? 'translateX(0%)' : 'translateX(-100%)',
      width: isExplorerOpen ? 300 : 0
    },
    config: {
      tension: 180,
      friction: 20,
      mass: 1,
      clamp: true
    }
  });

  const handleAddPage = () => {
    if (!currentDocument) return;

    const newPageId = Math.max(...currentPages.map(p => p.id), 0) + 1;
    const newPage = {
      id: newPageId,
      title: `Страница ${newPageId}`,
      content: ""
    };

    setDocuments(prev => ({
      ...prev,
      [currentDocument]: {
        ...prev[currentDocument],
        pages: [...prev[currentDocument].pages, newPage],
        currentPageId: newPageId
      }
    }));
    setContent("");
  };

  const handleRemovePage = (pageId) => {
    if (!currentDocument || currentPages.length <= 1) {
      alert("Нельзя удалить последнюю страницу!");
      return;
    }
    
    const newPages = currentPages.filter(p => p.id !== pageId);
    
    setDocuments(prev => ({
      ...prev,
      [currentDocument]: {
        ...prev[currentDocument],
        pages: newPages,
        currentPageId: pageId === currentPageId ? newPages[0].id : currentPageId
      }
    }));
    
    // Если удаляем текущую страницу, переключаемся на предыдущую
    if (pageId === currentPageId) {
      const currentIndex = currentPages.findIndex(p => p.id === pageId);
      const newCurrentPage = newPages[Math.max(0, currentIndex - 1)];
      setContent(newCurrentPage.content);
    }

    // Сохраняем изменения в файл
    const updatedDocument = {
      pages: newPages
    };

    invoke("save_file", {
      content: JSON.stringify(updatedDocument, null, 2),
      fileName: currentDocument
    }).catch(error => {
      console.error("Ошибка при сохранении файла после удаления страницы:", error);
      alert("Ошибка при сохранении изменений: " + error);
    });
  };

  const handlePageChange = (pageId) => {
    if (!currentDocument) return;

    // Сохраняем содержимое текущей страницы
    const updatedPages = currentPages.map(page => 
      page.id === currentPageId 
        ? { ...page, content } 
        : page
    );

    setDocuments(prev => ({
      ...prev,
      [currentDocument]: {
        ...prev[currentDocument],
        pages: updatedPages,
        currentPageId: pageId
      }
    }));

    // Переключаемся на новую страницу
    const newPage = updatedPages.find(p => p.id === pageId);
    setContent(newPage.content);
  };

  const handleContextMenu = (e, pageId) => {
    e.preventDefault();
    const menuWidth = 200; // ширина меню (px)
    const menuHeight = 44; // высота одного пункта (px)
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuWidth > window.innerWidth) {
      x = x - menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      y = y - menuHeight;
    }
    setContextMenu({
      show: true,
      x,
      y,
      pageId
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, pageId: null });
  };

  const handleRenamePage = (pageId, title, event) => {
    if (!currentDocument) return;

    let x = event?.clientX || 100;
    let y = event?.clientY || 100;
    const menuWidth = 200;
    const menuHeight = 40;
    if (x + menuWidth > window.innerWidth) x = x - menuWidth;
    if (y + menuHeight > window.innerHeight) y = y - menuHeight;
    setRenameMenu({ show: true, x, y, pageId });
    setRenamingPageId(pageId);
    setRenameValue(title);
    setContextMenu({ show: false, x: 0, y: 0, pageId: null });
  };

  const handleRenameInputChange = (e) => setRenameValue(e.target.value);

  const handleRenameInputBlur = () => {
    if (!currentDocument || renamingPageId === null) return;

    const updatedPages = currentPages.map(page =>
      page.id === renamingPageId ? { ...page, title: renameValue.trim() || page.title } : page
    );

    setDocuments(prev => ({
      ...prev,
      [currentDocument]: {
        ...prev[currentDocument],
        pages: updatedPages
      }
    }));

    setRenamingPageId(null);
    setRenameMenu({ show: false, x: 0, y: 0, pageId: null });
    handleSave();
  };

  const handleRenameInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameInputBlur();
    } else if (e.key === 'Escape') {
      setRenamingPageId(null);
    }
  };

  // Функция для вставки текста в позицию курсора
  const insertAtCursor = (prefix, suffix = '') => {
    // Получаем все блоки
    const blocks = splitMarkdownBlocks(content);
    
    // Находим текущий блок, который редактируется
    const currentBlock = blocks[editingBlockIdx];
    console.log('Current editing block index:', editingBlockIdx);
    console.log('Current block content:', currentBlock);
    
    if (editingBlockIdx !== null && editingRef.current) {
      const textarea = editingRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const selected = text.substring(start, end);
      const after = text.substring(end);
      
      const newValue = before + prefix + selected + suffix + after;
      
      // Обновляем контент текущего блока
      const updatedBlocks = [...blocks];
      updatedBlocks[editingBlockIdx] = newValue;
      const newContent = updatedBlocks.join('\n\n');
      
      // Обновляем состояние
      setEditingContent(newValue);
      setContent(newContent);
      
      // Устанавливаем курсор после вставленного текста
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + prefix.length + selected.length + suffix.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      // Если мы не в режиме редактирования, добавляем в конец текущего контента
      const newContent = content + (content ? '\n\n' : '') + prefix + suffix;
      setContent(newContent);
      
      // Создаем новый блок для редактирования
      const newBlockIdx = blocks.length;
      setEditingBlockIdx(newBlockIdx);
      setEditingContent(prefix + suffix);
      
      // Устанавливаем фокус на новый блок
      setTimeout(() => {
        if (editingRef.current) {
          editingRef.current.focus();
          editingRef.current.setSelectionRange(prefix.length, prefix.length);
        }
      }, 0);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleCloseContextMenu);
    return () => {
      document.removeEventListener('click', handleCloseContextMenu);
    };
  }, []);

  // Добавление нового блока
  const handleNewBlockChange = async (e) => {
    setNewBlockContent(e.target.value);
    
    // Логика автодополнения - аналогично handleBlockEdit
    const textarea = e.target;
    const cursorPosition = textarea.selectionEnd;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    
    // Находим текущее слово или тег перед курсором
    let currentWord = '';
    let startPos = cursorPosition;
    
    // Ищем теги, начинающиеся с @ или #
    const tagMatch = textBeforeCursor.match(/(?:^|\s)([#@][a-zа-яё0-9_-]*)$/i);
    if (tagMatch) {
      currentWord = tagMatch[1];
      startPos = textBeforeCursor.lastIndexOf(currentWord);
    } else {
      // Ищем обычные слова
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
        // Расчитываем позицию для отображения автодополнения
        const textareaRect = textarea.getBoundingClientRect();
        const { left, top } = getCaretCoordinates(textarea, cursorPosition);
        
        setAutoComplete({
          visible: true,
          suggestions,
          position: { 
            x: left,
            y: top + 20
          },
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
  };

  const handleNewBlockKeyDown = (e) => {
    console.log('handleNewBlockKeyDown:', { value: newBlockContent, key: e.key });
    // Обработка Enter для автодополнения
    if (e.key === 'Enter' && !e.shiftKey && autoComplete.visible) {
      e.preventDefault();
      if (autoComplete.selectedIndex !== null && autoComplete.suggestions[autoComplete.selectedIndex]) {
        handleAutoCompleteSelect(autoComplete.suggestions[autoComplete.selectedIndex].text);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const value = newBlockContent.trim();
      if (!value) return;
      let blockToInsert = value;
      if (value === '/таблица' || value === '/table') {
        blockToInsert =
          '| Заголовок 1 | Заголовок 2 |\n' +
          '| --- | --- |\n' +
          '|  |  |\n' +
          '|  |  |';
      }
      const blocks = splitMarkdownBlocks(content);
      blocks.push(blockToInsert);
      const newContent = blocks.join('\n\n');
      setContent(newContent);
      setNewBlockContent("");
      // Не переводим в режим редактирования — просто оставляем поле для нового блока
      console.log('Блок добавлен:', blockToInsert);
      return;
    }
  };

  const handleNewBlockBlur = () => {
    // Скрываем автодополнение
    hideAutoComplete();
    
    if (newBlockContent.trim() !== "") {
      const blocks = splitMarkdownBlocks(content);
      blocks.push(newBlockContent);
      const newContent = blocks.join('\n\n');
      setContent(newContent);
      setNewBlockContent("");
      
      // Сразу переключаемся на новый блок для редактирования
      const newBlockIndex = blocks.length - 1;
      setEditingBlockIdx(newBlockIndex);
      setEditingContent(newBlockContent);
    }
  };

  // Обработчик клика по чекбоксу
  const handleCheckboxClick = (e, blockIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    const blocks = splitMarkdownBlocks(content);
    const block = blocks[blockIndex];
    const lines = block.split('\n');
    
    // Находим индекс строки, где произошел клик
    const checkboxIndex = Array.from(e.target.closest('.markdown-block').querySelectorAll('.checkbox-item')).indexOf(e.target.closest('.checkbox-item'));
    
    if (checkboxIndex !== -1) {
      const line = lines[checkboxIndex];
      const isChecked = line.includes('[x]');
      lines[checkboxIndex] = line.replace(
        /\[([ x])\]/,
        isChecked ? '[ ]' : '[x]'
      );
      blocks[blockIndex] = lines.join('\n');
      setContent(blocks.join('\n\n'));
    }
  };

  // Функция для преобразования markdown в HTML с кастомными чекбоксами
  const renderMarkdownWithCheckboxes = (text) => {
    // Сначала заменяем чекбоксы на HTML
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
    
    // Затем обрабатываем остальной markdown
    return marked(withCheckboxes);
  };

  // Эффект для индексации содержимого при загрузке страниц
  useEffect(() => {
    if (currentPages.length > 0) {
      indexService.indexAllPages(currentPages).catch(error => {
        console.error('Error indexing pages:', error);
      });
    }
  }, [currentPages]);

  // Функция для парсинга Markdown таблицы в массив данных
  const parseMarkdownTable = (markdownTable) => {
    const lines = markdownTable.trim().split('\n');
    if (lines.length < 3) return null; // Минимум 3 строки: заголовок, разделитель и данные

    // Убираем разделитель (вторую строку)
    const dataLines = lines.filter((_, i) => i !== 1);
    
    // Парсим каждую строку
    return dataLines.map(line => {
      // Убираем начальный и конечный | и разбиваем по |
      return line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(cell => cell.trim());
    });
  };

  // Обработчик клика по таблице
  const handleTableClick = (e) => {
    const tableElement = e.target.closest('table');
    if (!tableElement) return;

    // Получаем Markdown представление таблицы
    const rows = Array.from(tableElement.rows);
    const markdownTable = rows.map(row => {
      const cells = Array.from(row.cells);
      return '| ' + cells.map(cell => cell.textContent.trim()).join(' | ') + ' |';
    }).join('\n');

    // Добавляем разделитель после заголовка
    const headerSeparator = '| ' + Array(rows[0].cells.length).fill('---').join(' | ') + ' |';
    const fullMarkdownTable = markdownTable.split('\n').slice(0, 1).join('\n') + '\n' + headerSeparator + '\n' + markdownTable.split('\n').slice(1).join('\n');

    // Находим индекс блока с таблицей
    const blocks = splitMarkdownBlocks(content);
    const blockIndex = blocks.findIndex(block => block.includes(fullMarkdownTable));
    
    if (blockIndex !== -1) {
      setEditingBlockIdx(blockIndex);
      setEditingContent(fullMarkdownTable);
      // Парсим таблицу и открываем редактор с данными
      const tableData = parseMarkdownTable(fullMarkdownTable);
      if (tableData) {
        setCurrentTableData(tableData);
      }
    }
  };

  // Добавляем функцию для открытия редактора таблиц
  const handleTableButtonClick = () => {
    setIsTableEditorOpen(true);
    setTableEditorPosition({
      x: window.innerWidth / 2 - 400,
      y: window.innerHeight / 2 - 300
    });
    setCurrentTableData(null); // Сбрасываем данные таблицы для создания новой
  };

  // Добавляем функцию для сохранения таблицы
  const handleTableSave = (markdownTable) => {
    if (editingBlockIdx !== null) {
      // Если редактируем существующий блок
      const blocks = splitMarkdownBlocks(content);
      blocks[editingBlockIdx] = markdownTable;
      const newContent = blocks.join('\n\n');
      setContent(newContent);
      setEditingContent(markdownTable);
    } else {
      // Если создаем новый блок
      const newContent = content + (content ? '\n\n' : '') + markdownTable;
      setContent(newContent);
      setNewBlockContent(''); // Сбрасываем содержимое нового блока
    }
    setIsTableEditorOpen(false);
  };

  // Добавляем функцию для отмены редактирования таблицы
  const handleTableCancel = () => {
    setIsTableEditorOpen(false);
  };

  // Добавляем функцию для форматирования выделенного текста
  const formatSelectedText = (format) => {
    if (editingRef.current) {
      const textarea = editingRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.substring(start, end);
      
      if (selectedText) {
        let formattedText = '';
        
        switch (format) {
          case 'bold':
            formattedText = `**${selectedText}**`;
            break;
          case 'italic':
            formattedText = `*${selectedText}*`;
            break;
          case 'code':
            formattedText = `\`${selectedText}\``;
            break;
          case 'link':
            formattedText = `[${selectedText}](url)`;
            break;
          case 'heading':
            formattedText = `## ${selectedText}`;
            break;
          default:
            formattedText = selectedText;
        }
        
        const newValue = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
        setEditingContent(newValue);
        
        // Перемещаем курсор после вставленного текста
        setTimeout(() => {
          textarea.focus();
          
          // Для ссылок устанавливаем курсор на позицию URL
          if (format === 'link') {
            const urlPosition = start + selectedText.length + 3;
            textarea.setSelectionRange(urlPosition, urlPosition + 3);
          } else {
            textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
          }
        }, 0);
        
        // Скрываем панель форматирования
        setTextToolbar({ visible: false, position: { x: 0, y: 0 } });
      }
    }
  };

  // Модифицируем renderMarkdown для добавления обработчика клика по таблице
  const renderMarkdown = () => {
    const blocks = splitMarkdownBlocks(content);
    return [
      ...blocks.map((block, idx) => {
        // Проверяем, является ли блок таблицей markdown
        const isTable = block.trim().startsWith('|') && block.includes('\n|') && block.includes('---');
        if (isTable) {
          return (
            <InlineTableEditor
              key={idx}
              markdown={block}
              onChange={newMarkdown => {
                const updatedBlocks = [...blocks];
                updatedBlocks[idx] = newMarkdown;
                setContent(updatedBlocks.join('\n\n'));
              }}
            />
          );
        }
        // Обычный markdown-блок: если редактируется — textarea, иначе — div
        if (editingBlockIdx === idx) {
          return (
            <div key={idx} style={{ position: 'relative' }} className="editing-block-container">
              <textarea
                ref={editingRef}
                value={editingContent}
                onChange={handleBlockEdit}
                onBlur={handleBlockBlur}
                onKeyDown={handleBlockKeyDown}
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
                  onClick={handleBlockBlur}
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
            key={idx}
            className="markdown-block"
            onClick={() => handleBlockClick(idx, block)}
            style={{ cursor: 'text' }}
            data-markdown={block}
            dangerouslySetInnerHTML={{ __html: renderMarkdownWithCheckboxes(block) }}
            onMouseDown={(e) => {
              if (e.target.type === 'checkbox') {
                handleCheckboxClick(e, idx);
              }
            }}
          />
        );
      }),
      // Пустой блок для создания нового
      <div key="new-block" className="new-block-container">
        <input
          type="text"
          placeholder="Введите '/' для команд или начните печатать..."
          value={newBlockContent}
          onChange={handleNewBlockChange}
          onKeyDown={handleNewBlockKeyDown}
          onBlur={handleNewBlockBlur}
          className="new-block-input"
        />
      </div>
    ];
  };

  // Модифицируем кнопку таблицы в quick-insert-bar
  const quickInsertButtons = [
    { onClick: () => insertAtCursor("**", "**"), title: "Жирный (Ctrl/Cmd + B)", content: <b>B</b> },
    { onClick: () => insertAtCursor("*", "*"), title: "Курсив (Ctrl/Cmd + I)", content: <i>I</i> },
    { onClick: () => insertAtCursor("# "), title: "Заголовок (Ctrl/Cmd + Shift + H)", content: "H1" },
    { onClick: () => insertAtCursor("- "), title: "Список (Ctrl/Cmd + Shift + L)", content: "•" },
    { onClick: () => insertAtCursor("[текст](url)"), title: "Ссылка (Ctrl/Cmd + K)", content: <FontAwesomeIcon icon={faLink} /> },
    { onClick: () => insertAtCursor("`", "`"), title: "Код (Ctrl/Cmd + Shift + C)", content: <>&lt;/&gt;</> },
    { onClick: () => insertAtCursor("> "), title: "Цитата (Ctrl/Cmd + Shift + Q)", content: "❝" },
    { onClick: handleTableButtonClick, title: "Таблица (Ctrl/Cmd + Shift + T)", content: "⊞" },
    { onClick: () => insertAtCursor("- [ ] "), title: "Чекбокс (Ctrl/Cmd + Shift + B)", content: "☐" }
  ];

  // Если активен приветственный экран
  if (showWelcome) {
    return (
      <main className="app-container">
        <animated.div className="welcome-container" style={welcomeAnimation}>
          <WelcomeScreen onSelectDirectory={handleDirectorySelect} />
        </animated.div>
      </main>
    );
  }

  // Если выбрана директория, показываем редактор и проводник
  return (
    <main className="app-container">
      <animated.div className="main-content" style={editorAnimation}>
        {/* Файловый проводник */}
        <animated.div className="file-explorer-container" style={explorerAnimation}>
          <FileExplorer 
            onFileSelect={handleFileSelect} 
            directoryPath={currentDirectory?.path}
            currentFile={{ path: fileName }}
          />
        </animated.div>
        
        {/* Контейнер редактора и вкладок */}
        <div className="editor-with-tabs">
          <div className="editor-container">
            {/* Панель быстрых вставок */}
            <div className="quick-insert-bar">
              <div className="quick-insert-left">
                <button
                  onClick={handleHomeClick}
                  className="toolbar-button"
                  title="На главный экран"
                >
                  <FontAwesomeIcon icon={faHome} />
                </button>
                <button
                  onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                  className="toolbar-button"
                  title={isExplorerOpen ? "Скрыть проводник" : "Показать проводник"}
                >
                  <FontAwesomeIcon icon={faFolderOpen} />
                </button>
              </div>
              <div className="quick-insert-center">
                {quickInsertButtons.map((button, index) => (
                  <button
                    key={index}
                    onClick={button.onClick}
                    title={button.title}
                  >
                    {button.content}
                  </button>
                ))}
              </div>
            </div>
            {/* Только интерактивные markdown-блоки или AI-коуч */}
            <div className="preview markdown-body">
              {renderMarkdown()}
            </div>
          </div>
          {/* Вкладки страниц справа, под редактором */}
          <div className="page-tabs-under-editor">
            <div className="page-tabs">
              {currentPages.map(page => (
                <div 
                  key={page.id}
                  className={`page-tab ${page.id === currentPageId ? 'active' : ''}`}
                  onClick={() => handlePageChange(page.id)}
                  onContextMenu={(e) => handleContextMenu(e, page.id)}
                  title={page.title}
                  style={{ position: 'relative' }}
                >
                  <span>{page.title}</span>
                </div>
              ))}
              <button 
                className="add-page-button" 
                onClick={handleAddPage}
                title="Добавить страницу"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
          </div>
        </div>
      </animated.div>

      {/* Контекстное меню для закладок */}
      {contextMenu.show && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000
          }}
        >
          <div
            className="context-menu-item"
            onClick={(e) => {
              handleRenamePage(contextMenu.pageId, currentPages.find(p => p.id === contextMenu.pageId)?.title || "", e);
            }}
          >
            Переименовать
          </div>
          <div
            className="context-menu-item"
            onClick={() => {
              handleRemovePage(contextMenu.pageId);
              handleCloseContextMenu();
            }}
          >
            Удалить
          </div>
        </div>
      )}

      {renameMenu.show && renamingPageId && (
        <div
          style={{
            position: 'fixed',
            top: renameMenu.y,
            left: renameMenu.x,
            zIndex: 2000,
            background: '#fff',
            border: '1px solid var(--primary-dark)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px ' + (getComputedStyle(document.documentElement).getPropertyValue('--shadow-color') || 'rgba(255,199,120,0.15)'),
            padding: '6px 12px',
            minWidth: '160px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <input
            className="rename-page-input"
            value={renameValue}
            autoFocus
            onChange={handleRenameInputChange}
            onBlur={handleRenameInputBlur}
            onKeyDown={handleRenameInputKeyDown}
            style={{
              width: '100%',
              fontSize: '1em',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-color)',
            }}
            placeholder="Новое имя страницы"
          />
        </div>
      )}

      {/* Добавляем компонент автодополнения */}
      <AutoComplete
        visible={autoComplete.visible}
        suggestions={autoComplete.suggestions}
        position={autoComplete.position}
        selectedIndex={autoComplete.selectedIndex}
        onSelect={handleAutoCompleteSelect}
        onDismiss={hideAutoComplete}
      />

      {editingBlockIdx !== null && currentTableData && (
        <TableEditor
          initialData={currentTableData}
          onSave={(markdown) => {
            setEditingContent(markdown);
            setCurrentTableData(null);
          }}
          onCancel={() => {
            setCurrentTableData(null);
          }}
        />
      )}
    </main>
  );
}

export default App;