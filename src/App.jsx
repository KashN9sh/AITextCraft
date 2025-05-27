import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "./App.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';

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
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isPreview) {
      hljs.highlightAll();
    }
  }, [isPreview, content]);

  const handleSave = async () => {
    try {
      await invoke("save_file", { content, fileName });
      alert("Файл успешно сохранен!");
    } catch (error) {
      alert("Ошибка при сохранении файла: " + error);
    }
  };

  const handleLoad = async () => {
    try {
      const loadedContent = await invoke("load_file", { fileName });
      setContent(loadedContent);
    } catch (error) {
      alert("Ошибка при загрузке файла: " + error);
    }
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

  return (
    <main className="container">
      <header className="app-header">
        <div className="app-logo">
          <img src="/icon.svg" alt="AITextCraft Logo" />
          <h1>AITextCraft</h1>
        </div>
      </header>
      <div className="editor-container">
        <div className="toolbar">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="filename-input"
            placeholder="Имя файла..."
          />
          <button onClick={handleSave} className="toolbar-button">
            Сохранить
          </button>
          <button onClick={handleLoad} className="toolbar-button">
            Загрузить
          </button>
          <button 
            onClick={() => setIsPreview(!isPreview)} 
            className="toolbar-button"
          >
            {isPreview ? "Редактировать" : "Предпросмотр"}
          </button>
        </div>
        {/* Панель быстрых вставок */}
        {!isPreview && (
          <div className="quick-insert-bar">
            <button onClick={() => insertAtCursor("**", "**")} title="Жирный"><b>B</b></button>
            <button onClick={() => insertAtCursor("*", "*")} title="Курсив"><i>I</i></button>
            <button onClick={() => insertAtCursor("# ")} title="Заголовок">H1</button>
            <button onClick={() => insertAtCursor("- ")} title="Список">•</button>
            <button onClick={() => insertAtCursor("[текст](url)")} title="Ссылка"><FontAwesomeIcon icon={faLink} /></button>
            <button onClick={() => insertAtCursor("`", "`")} title="Код">&lt;/&gt;</button>
            <button onClick={() => insertAtCursor("> ")} title="Цитата">❝</button>
          </div>
        )}
        {isPreview ? (
          <div 
            className="preview markdown-body"
            dangerouslySetInnerHTML={renderMarkdown()}
          />
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
    </main>
  );
}

export default App;
