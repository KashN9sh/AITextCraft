import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "./App.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faSave, faFolderOpen, faEye, faEdit, faHome, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import FileExplorer from "./components/FileExplorer";
import WelcomeScreen from "./components/WelcomeScreen";
import { listen } from '@tauri-apps/api/event';
import { useSpring, animated } from 'react-spring';

// Настраиваем marked для использования highlight.js и поддержки чекбоксов
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  gfm: true, // Включаем GitHub Flavored Markdown
  breaks: true, // Включаем переносы строк
  headerIds: true, // Включаем ID для заголовков
  mangle: false, // Отключаем преобразование email-адресов
  pedantic: false, // Отключаем педантичный режим
  sanitize: false, // Отключаем санитизацию HTML
  smartLists: true, // Включаем умные списки
  smartypants: true, // Включаем умные кавычки
  xhtml: false // Отключаем XHTML
});

// Добавляем поддержку чекбоксов
const renderer = new marked.Renderer();
const originalCheckbox = renderer.checkbox;
renderer.checkbox = function(checked) {
  return `<input type="checkbox" ${checked ? 'checked' : ''} disabled />`;
};
marked.use({ renderer });

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

  useEffect(() => {
    if (isPreview) {
      hljs.highlightAll();
    }
  }, [isPreview, content]);

  const handleSave = useCallback(async () => {
    try {
      // Обновляем содержимое текущей страницы
      const updatedPages = pages.map(page => 
        page.id === currentPageId 
          ? { ...page, content } 
          : page
      );
      setPages(updatedPages);

      // Сохраняем весь документ как JSON
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

  const renderMarkdown = () => {
    return { __html: marked(content) };
  };

  // Быстрая вставка Markdown
  const insertAtCursor = (before, after = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newText =
      content.substring(0, start) +
      before +
      selected +
      after +
      content.substring(end);
    setContent(newText);
    // Ставим курсор после вставки
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        end + before.length
      );
    }, 0);
  };

  // Функции для работы с буфером обмена
  const handleCut = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    setClipboard(selectedText);
    setContent(content.substring(0, start) + content.substring(end));
    
    // Устанавливаем курсор после вырезанного текста
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start);
    }, 0);
  }, [content]);

  const handleCopy = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    setClipboard(selectedText);
    // Копируем в системный буфер обмена
    navigator.clipboard.writeText(selectedText).catch(err => {
      console.error('Ошибка при копировании в буфер обмена:', err);
    });
  }, [content]);

  const handlePaste = useCallback(async () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    try {
      // Пытаемся получить текст из системного буфера обмена
      const text = await navigator.clipboard.readText();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      setContent(content.substring(0, start) + text + content.substring(end));
      
      // Устанавливаем курсор после вставленного текста
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    } catch (err) {
      console.error('Ошибка при чтении из буфера обмена:', err);
      // Если не удалось получить из системного буфера, используем локальный
      if (clipboard) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        setContent(content.substring(0, start) + clipboard + content.substring(end));
        
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + clipboard.length, start + clipboard.length);
        }, 0);
      }
    }
  }, [content, clipboard]);

  // Обработчик нажатия клавиш в textarea
  const handleEditorKeyDown = (e) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // --- Стандартные клавиатурные сокращения ---
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            // Cmd/Ctrl + Shift + Z - повторить
            document.execCommand('redo', false, null);
          } else {
            // Cmd/Ctrl + Z - отменить
            document.execCommand('undo', false, null);
          }
          return;
        case 'y':
          e.preventDefault();
          // Cmd/Ctrl + Y - повторить (альтернатива)
          document.execCommand('redo', false, null);
          return;
        case 'a':
          e.preventDefault();
          // Cmd/Ctrl + A - выделить всё
          textarea.select();
          return;
        case 'x':
          e.preventDefault();
          // Cmd/Ctrl + X - вырезать
          handleCut();
          return;
        case 'c':
          e.preventDefault();
          // Cmd/Ctrl + C - копировать
          handleCopy();
          return;
        case 'v':
          e.preventDefault();
          // Cmd/Ctrl + V - вставить
          handlePaste();
          return;
        case 's':
          e.preventDefault();
          // Cmd/Ctrl + S - сохранить
          handleSave();
          return;
        case 'f':
          e.preventDefault();
          // Cmd/Ctrl + F - поиск
          // TODO: Добавить функционал поиска
          return;
        case 'b':
          e.preventDefault();
          insertAtCursor("**", "**");
          return;
        case 'i':
          e.preventDefault();
          insertAtCursor("*", "*");
          return;
        case 'k':
          e.preventDefault();
          insertAtCursor("[", "](url)");
          return;
      }
      
      if (e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'h':
            e.preventDefault();
            insertAtCursor("# ");
            return;
          case 'l':
            e.preventDefault();
            insertAtCursor("- ");
            return;
          case 'c':
            e.preventDefault();
            insertAtCursor("`", "`");
            return;
          case 'q':
            e.preventDefault();
            insertAtCursor("> ");
            return;
          case 't':
            e.preventDefault();
            insertAtCursor("| | |\n| --- | --- |\n| | |");
            return;
          case 'b':
            e.preventDefault();
            insertAtCursor("- [ ] ");
            return;
        }
      }
    }
    
    // --- Автоматическое форматирование заголовков ---
    if (e.key === ' ' && content.substring(start - 1, start) === '#') {
      const before = content.substring(0, start - 1);
      const after = content.substring(end);
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1];
      
      if (currentLine.match(/^#+$/)) {
        e.preventDefault();
        const level = currentLine.length;
        setContent(before + ' ' + after);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start, start);
        }, 0);
        return;
      }
    }

    // --- Умные ссылки ---
    if (e.key === 'Enter' && start === end) {
      const before = content.substring(0, start);
      const after = content.substring(end);
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1];
      
      // Проверяем, является ли строка URL
      if (currentLine.match(/^(https?:\/\/[^\s]+)$/)) {
        e.preventDefault();
        const url = currentLine;
        setContent(
          before.replace(url, '') + 
          `[${url}](${url})` + 
          after
        );
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + url.length + 4, start + url.length + 4);
        }, 0);
        return;
      }
    }

    // --- Автоматическое форматирование таблиц ---
    if (e.key === '|') {
      const before = content.substring(0, start);
      const after = content.substring(end);
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1];
      
      // Если это первая ячейка в строке
      if (!currentLine.includes('|')) {
        e.preventDefault();
        setContent(before + '| | |\n| --- | --- |\n| | |' + after);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
        return;
      }
    }

    // --- Умные списки задач ---
    if (e.key === '[' && content.substring(start - 2, start) === '- ') {
      e.preventDefault();
      setContent(
        content.substring(0, start) + '[ ]' + content.substring(end)
      );
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 3, start + 3);
      }, 0);
      return;
    }

    // --- Авто-закрытие парных символов ---
    const pairs = {
      '*': '*',
      '`': '`',
      '[': ']',
      '(': ')',
      '"': '"',
    };
    if (
      Object.keys(pairs).includes(e.key) &&
      !e.ctrlKey && !e.metaKey && !e.altKey && start === end
    ) {
      e.preventDefault();
      const before = content.substring(0, start);
      const after = content.substring(end);
      setContent(before + e.key + pairs[e.key] + after);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      }, 0);
      return;
    }
    // --- Автоматическое продолжение списков ---
    if (e.key === "Enter") {
      const before = content.substring(0, start);
      const after = content.substring(start);
      // Получаем строку до курсора
      const lines = before.split("\n");
      const prevLine = lines[lines.length - 1];
      // Проверяем, был ли это список
      const match = prevLine.match(/^(\s*)([-*+] |\d+\. )/);
      if (match) {
        e.preventDefault();
        const indent = match[1] || "";
        const marker = match[2] || "";
        // Если строка пустая (только маркер), удаляем маркер
        if (prevLine.trim() === marker.trim()) {
          setContent(before.replace(/\n?$/, "") + "\n" + after);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start - marker.length, start - marker.length);
          }, 0);
        } else {
          // Продолжаем список
          setContent(before + "\n" + indent + marker + after);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + 1 + indent.length + marker.length, start + 1 + indent.length + marker.length);
          }, 0);
        }
      }
    }
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
            {!isPreview && (
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
                <div className="quick-insert-right">
                  <button 
                    onClick={() => setIsPreview(!isPreview)} 
                    className="toolbar-button"
                    title={isPreview ? "Редактировать" : "Предпросмотр"}
                  >
                    <FontAwesomeIcon icon={isPreview ? faEdit : faEye} />
                  </button>
                </div>
              </div>
            )}
            
            {isPreview ? (
              <div>
                <div className="quick-insert-bar">
                  <div className="spacer"></div>
                  <button 
                    onClick={() => setIsPreview(!isPreview)} 
                    className="toolbar-button"
                    title="Редактировать"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                </div>
                <div 
                  className="preview markdown-body"
                  dangerouslySetInnerHTML={renderMarkdown()}
                />
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="editor"
                placeholder="Введите Markdown текст здесь..."
                onKeyDown={handleEditorKeyDown}
              />
            )}
          </div>
          {/* Вкладки страниц справа, под редактором */}
          <div className="page-tabs-under-editor">
            <div className="page-tabs">
              {pages.map(page => (
                <div 
                  key={page.id}
                  className={`page-tab ${page.id === currentPageId ? 'active' : ''}`}
                  onClick={() => handlePageChange(page.id)}
                  title={page.title}
                >
                  <span>{page.title}</span>
                  {pages.length > 1 && (
                    <button
                      className="close-tab"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePage(page.id);
                      }}
                      title="Закрыть страницу"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  )}
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
    </main>
  );
}

export default App;
