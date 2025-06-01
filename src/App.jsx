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
import AICoach from "./components/AICoach";
import AutoComplete from "./components/AutoComplete";
import indexService from "./services/indexService";

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
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("untitled.md");
  const [isPreview, setIsPreview] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [currentDirectory, setCurrentDirectory] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [pages, setPages] = useState([{ id: 1, title: "Страница 1", content: "" }]);
  const [currentPageId, setCurrentPageId] = useState(1);
  const textareaRef = useRef(null);
  const [clipboard, setClipboard] = useState("");
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, pageId: null });
  const [renamingPageId, setRenamingPageId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameMenu, setRenameMenu] = useState({ show: false, x: 0, y: 0, pageId: null });
  const [editingBlockIdx, setEditingBlockIdx] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const editingRef = useRef(null);
  const [newBlockContent, setNewBlockContent] = useState("");
  const [showAICoach, setShowAICoach] = useState(false);
  
  // Состояние для автодополнения
  const [autoComplete, setAutoComplete] = useState({
    visible: false,
    suggestions: [],
    position: { x: 0, y: 0 },
    prefix: "",
    selectedIndex: null
  });

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

  const handleSave = useCallback(async (customPages) => {
    try {
      const updatedPages = (customPages ?? pages).map(page =>
        page.id === currentPageId
          ? { ...page, content }
          : page
      );
      setPages(updatedPages);

      const documentData = {
        pages: updatedPages
      };

      await invoke("save_file", {
        content: JSON.stringify(documentData, null, 2),
        fileName
      });
      alert("Файл успешно сохранен!");
    } catch (error) {
      alert("Ошибка при сохранении файла: " + error);
    }
  }, [content, fileName, pages, currentPageId]);

  // Создаем дебаунсированную версию handleSave
  const debouncedSave = useCallback(
    debounce((customPages) => {
      handleSave(customPages);
    }, 1000),
    [handleSave]
  );

  // Эффект для автосохранения при изменении контента
  useEffect(() => {
    if (content && !showWelcome) {
      debouncedSave();
    }
  }, [content, debouncedSave, showWelcome]);

  // Добавляем обработчики событий меню
  useEffect(() => {
    // Обработчик события сохранения из меню
    const unlistenSave = listen('menu-save', () => {
      handleSave();
    });

    // Обработчик события загрузки из меню
    const unlistenLoad = listen('menu-load', () => {
      handleLoad();
    });

    // Обработчик события предпросмотра из меню
    const unlistenPreview = listen('menu-preview', () => {
      setIsPreview(!isPreview);
    });

    // Очистка обработчиков при размонтировании компонента
    return () => {
      unlistenSave.then(unlisten => unlisten());
      unlistenLoad.then(unlisten => unlisten());
      unlistenPreview.then(unlisten => unlisten());
    };
  }, [handleSave, isPreview]); // Добавляем handleSave и isPreview в зависимости

  const handleLoad = async () => {
    try {
      const loadedContent = await invoke("load_file", { fileName });
      setContent(loadedContent);
    } catch (error) {
      alert("Ошибка при загрузке файла: " + error);
    }
  };

  const handleFileSelect = async (fileItem) => {
    setFileName(fileItem.path);
    
    try {
      const loadedContent = await invoke("load_file", { fileName: fileItem.path });
      // Парсим JSON из содержимого файла
      try {
        const documentData = JSON.parse(loadedContent);
        if (documentData.pages && Array.isArray(documentData.pages)) {
          setPages(documentData.pages);
          setCurrentPageId(documentData.pages[0]?.id || 1);
          setContent(documentData.pages[0]?.content || "");
        } else {
          // Если это старый формат (просто markdown), конвертируем в новый
          setPages([{ id: 1, title: "Страница 1", content: loadedContent }]);
          setCurrentPageId(1);
          setContent(loadedContent);
        }
      } catch (e) {
        // Если не удалось распарсить JSON, считаем что это старый формат
        setPages([{ id: 1, title: "Страница 1", content: loadedContent }]);
        setCurrentPageId(1);
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
  const handleBlockEdit = (e) => {
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
      const suggestions = indexService.findCompletions(currentWord);
      
      if (suggestions.length > 0) {
        // Расчитываем позицию для отображения автодополнения
        const textareaRect = textarea.getBoundingClientRect();
        const { left, top } = getCaretCoordinates(textarea, cursorPosition);
        
        console.log('Позиция для автодополнения:', {
          textareaRect,
          caretCoords: { left, top },
          finalPosition: {
            x: textareaRect.left + left,
            y: textareaRect.top + top + 20
          }
        }); // Отладочный вывод
        
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
    // Если автодополнение активно, обрабатываем навигацию по списку
    if (autoComplete.visible && autoComplete.suggestions.length > 0) {
      // Навигация с помощью стрелок
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.min(
          (autoComplete.selectedIndex || 0) + 1, 
          autoComplete.suggestions.length - 1
        );
        setAutoComplete(prev => ({ ...prev, selectedIndex: newIndex }));
        return;
      } 
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.max((autoComplete.selectedIndex || 0) - 1, 0);
        setAutoComplete(prev => ({ ...prev, selectedIndex: newIndex }));
        return;
      }
      
      // Выбор с помощью Tab или Enter
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selectedIndex = autoComplete.selectedIndex || 0;
        if (autoComplete.suggestions[selectedIndex]) {
          handleAutoCompleteSelect(autoComplete.suggestions[selectedIndex].text);
        }
        return;
      }
      
      // Закрытие с помощью Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        hideAutoComplete();
        return;
      }
    }

    // Продолжаем обрабатывать другие горячие клавиши
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleBlockBlur();
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
    // Не сбрасываем editingContent, чтобы сохранить контент
    // setEditingContent("");
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
    const newPageId = Math.max(...pages.map(p => p.id), 0) + 1;
    const newPage = {
      id: newPageId,
      title: `Страница ${newPageId}`,
      content: ""
    };
    setPages([...pages, newPage]);
    setCurrentPageId(newPageId);
    setContent("");
  };

  const handleRemovePage = (pageId) => {
    if (pages.length <= 1) {
      alert("Нельзя удалить последнюю страницу!");
      return;
    }
    
    const newPages = pages.filter(p => p.id !== pageId);
    setPages(newPages);
    
    // Если удаляем текущую страницу, переключаемся на предыдущую
    if (pageId === currentPageId) {
      const currentIndex = pages.findIndex(p => p.id === pageId);
      const newCurrentPage = newPages[Math.max(0, currentIndex - 1)];
      setCurrentPageId(newCurrentPage.id);
      setContent(newCurrentPage.content);
    }
  };

  const handlePageChange = (pageId) => {
    // Сохраняем содержимое текущей страницы
    const updatedPages = pages.map(page => 
      page.id === currentPageId 
        ? { ...page, content } 
        : page
    );
    setPages(updatedPages);

    // Переключаемся на новую страницу
    const newPage = updatedPages.find(p => p.id === pageId);
    setCurrentPageId(pageId);
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
    if (renamingPageId !== null) {
      const updatedPages = pages.map(page =>
        page.id === renamingPageId ? { ...page, title: renameValue.trim() || page.title } : page
      );
      setPages(updatedPages);
      setRenamingPageId(null);
      setRenameMenu({ show: false, x: 0, y: 0, pageId: null });
      handleSave(updatedPages); // Сохраняем с актуальными страницами
    }
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
  const handleNewBlockChange = (e) => {
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
      const suggestions = indexService.findCompletions(currentWord);
      
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

  const handleNewBlockBlur = () => {
    // Скрываем автодополнение
    hideAutoComplete();
    
    if (newBlockContent.trim() !== "") {
      const blocks = splitMarkdownBlocks(content);
      blocks.push(newBlockContent);
      setContent(blocks.join('\n\n'));
      setNewBlockContent("");
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
    if (pages.length > 0) {
      indexService.indexAllPages(pages);
    }
  }, [pages]);

  // Рендерим каждый блок + пустой блок в конце
  const renderMarkdown = () => {
    const blocks = splitMarkdownBlocks(content);
    return [
      ...blocks.map((block, idx) =>
        editingBlockIdx === idx ? (
          <div key={idx} style={{ position: 'relative' }}>
            <textarea
              ref={editingRef}
              value={editingContent}
              onChange={handleBlockEdit}
              onBlur={handleBlockBlur}
              onKeyDown={handleBlockKeyDown}
              className="editing-block"
              onFocus={e => {
                e.target.style.height = '';
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
            />
            {autoComplete.visible && editingBlockIdx === idx && (
              <AutoComplete
                suggestions={autoComplete.suggestions}
                position={autoComplete.position}
                visible={autoComplete.visible}
                onSelect={handleAutoCompleteSelect}
                onDismiss={hideAutoComplete}
                selectedIndex={autoComplete.selectedIndex || 0}
              />
            )}
          </div>
        ) : (
          <div
            key={idx}
            className="markdown-block"
            onClick={() => handleBlockClick(idx, block)}
            style={{ cursor: 'text' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdownWithCheckboxes(block) }}
            onMouseDown={(e) => {
              if (e.target.type === 'checkbox') {
                handleCheckboxClick(e, idx);
              }
            }}
          />
        )
      ),
      // Пустой блок для создания нового
      <div key="new-block" style={{ position: 'relative' }}>
        <textarea
          className="editing-block"
          placeholder="Новый блок..."
          value={newBlockContent}
          onChange={handleNewBlockChange}
          onKeyDown={handleBlockKeyDown}
          onBlur={handleNewBlockBlur}
          style={{ minHeight: '2em', marginTop: 12 }}
          onFocus={() => setEditingBlockIdx(null)}
        />
        {autoComplete.visible && editingBlockIdx === null && (
          <AutoComplete
            suggestions={autoComplete.suggestions}
            position={autoComplete.position}
            visible={autoComplete.visible}
            onSelect={handleAutoCompleteSelect}
            onDismiss={hideAutoComplete}
            selectedIndex={autoComplete.selectedIndex || 0}
          />
        )}
      </div>
    ];
  };

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
                <button
                  onClick={() => setShowAICoach(!showAICoach)}
                  className={`toolbar-button${showAICoach ? ' active' : ''}`}
                  title="AI-коуч"
                >
                  🤖 AI-коуч
                </button>
              </div>
              <div className="quick-insert-center">
                {[
                  { onClick: () => insertAtCursor("**", "**"), title: "Жирный (Ctrl/Cmd + B)", content: <b>B</b> },
                  { onClick: () => insertAtCursor("*", "*"), title: "Курсив (Ctrl/Cmd + I)", content: <i>I</i> },
                  { onClick: () => insertAtCursor("# "), title: "Заголовок (Ctrl/Cmd + Shift + H)", content: "H1" },
                  { onClick: () => insertAtCursor("- "), title: "Список (Ctrl/Cmd + Shift + L)", content: "•" },
                  { onClick: () => insertAtCursor("[текст](url)"), title: "Ссылка (Ctrl/Cmd + K)", content: <FontAwesomeIcon icon={faLink} /> },
                  { onClick: () => insertAtCursor("`", "`"), title: "Код (Ctrl/Cmd + Shift + C)", content: <>&lt;/&gt;</> },
                  { onClick: () => insertAtCursor("> "), title: "Цитата (Ctrl/Cmd + Shift + Q)", content: "❝" },
                  { onClick: () => insertAtCursor("| | |\n| --- | --- |\n| | |"), title: "Таблица (Ctrl/Cmd + Shift + T)", content: "⊞" },
                  { onClick: () => insertAtCursor("- [ ] "), title: "Чекбокс (Ctrl/Cmd + Shift + B)", content: "☐" }
                ].map((button, index) => (
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
              {showAICoach ? <AICoach /> : renderMarkdown()}
            </div>
          </div>
          {/* Вкладки страниц справа, под редактором */}
          <div className="page-tabs-under-editor">
            <div className="page-tabs">
              {pages.map(page => (
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
              handleRenamePage(contextMenu.pageId, pages.find(p => p.id === contextMenu.pageId)?.title || "", e);
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
    </main>
  );
}

export default App;