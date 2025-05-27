import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "./App.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faSave, faFolderOpen, faEye, faEdit, faHome } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import FileExplorer from "./components/FileExplorer";
import WelcomeScreen from "./components/WelcomeScreen";
import { listen } from '@tauri-apps/api/event';

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
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isPreview) {
      hljs.highlightAll();
    }
  }, [isPreview, content]);

  const handleSave = useCallback(async () => {
    try {
      await invoke("save_file", { content, fileName });
      alert("Файл успешно сохранен!");
    } catch (error) {
      alert("Ошибка при сохранении файла: " + error);
    }
  }, [content, fileName]);

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
    // Сохраняем полный путь к файлу и имя файла
    setFileName(fileItem.path);
    
    try {
      // Загружаем содержимое файла
      const loadedContent = await invoke("load_file", { fileName: fileItem.path });
      setContent(loadedContent);
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

  // Обработчик нажатия клавиш в textarea
  const handleEditorKeyDown = (e) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
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

  // Если активен приветственный экран
  if (showWelcome) {
    return (
      <motion.main 
        className="app-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="welcome-container">
          <WelcomeScreen onSelectDirectory={handleDirectorySelect} />
        </div>
      </motion.main>
    );
  }

  // Если выбрана директория, показываем редактор и проводник
  return (
    <motion.main 
      className="app-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="main-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {/* Файловый проводник */}
        <AnimatePresence>
          {isExplorerOpen && (
            <motion.div 
              className="file-explorer-container"
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 240 }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FileExplorer 
                onFileSelect={handleFileSelect} 
                directoryPath={currentDirectory?.path}
                currentFile={{ path: fileName }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Редактор */}
        <motion.div 
          className="editor-container"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: isExplorerOpen ? 0.3 : 0, duration: 0.5 }}
        >
          {/* Панель быстрых вставок */}
          <AnimatePresence>
            {!isPreview && (
              <motion.div 
                className="quick-insert-bar"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="quick-insert-left">
                  <motion.button
                    onClick={handleHomeClick}
                    className="toolbar-button"
                    title="На главный экран"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FontAwesomeIcon icon={faHome} />
                  </motion.button>
                  <motion.button
                    onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                    className="toolbar-button"
                    title={isExplorerOpen ? "Скрыть проводник" : "Показать проводник"}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FontAwesomeIcon icon={faFolderOpen} />
                  </motion.button>
                </div>
                <div className="quick-insert-center">
                  {[
                    { onClick: () => insertAtCursor("**", "**"), title: "Жирный", content: <b>B</b> },
                    { onClick: () => insertAtCursor("*", "*"), title: "Курсив", content: <i>I</i> },
                    { onClick: () => insertAtCursor("# "), title: "Заголовок", content: "H1" },
                    { onClick: () => insertAtCursor("- "), title: "Список", content: "•" },
                    { onClick: () => insertAtCursor("[текст](url)"), title: "Ссылка", content: <FontAwesomeIcon icon={faLink} /> },
                    { onClick: () => insertAtCursor("`", "`"), title: "Код", content: <>&lt;/&gt;</> },
                    { onClick: () => insertAtCursor("> "), title: "Цитата", content: "❝" }
                  ].map((button, index) => (
                    <motion.button
                      key={index}
                      onClick={button.onClick}
                      title={button.title}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {button.content}
                    </motion.button>
                  ))}
                </div>
                <div className="quick-insert-right">
                  <motion.button 
                    onClick={() => setIsPreview(!isPreview)} 
                    className="toolbar-button"
                    title={isPreview ? "Редактировать" : "Предпросмотр"}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FontAwesomeIcon icon={isPreview ? faEdit : faEye} />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence mode="wait">
            {isPreview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <div className="quick-insert-bar">
                  <div className="spacer"></div>
                  <motion.button 
                    onClick={() => setIsPreview(!isPreview)} 
                    className="toolbar-button"
                    title="Редактировать"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </motion.button>
                </div>
                <div 
                  className="preview markdown-body"
                  dangerouslySetInnerHTML={renderMarkdown()}
                />
              </motion.div>
            ) : (
              <motion.textarea
                key="editor"
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="editor"
                placeholder="Введите Markdown текст здесь..."
                onKeyDown={handleEditorKeyDown}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.main>
  );
}

export default App;
