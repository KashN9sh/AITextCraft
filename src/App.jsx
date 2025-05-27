import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "./App.css";

// Настраиваем marked для использования highlight.js
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

function App() {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("untitled.md");
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef(null);

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
            <button onClick={() => insertAtCursor("[текст](url)")} title="Ссылка">🔗</button>
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
