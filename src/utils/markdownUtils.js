import { marked } from 'marked';
import hljs from 'highlight.js';

// Настраиваем marked для использования highlight.js
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
  const isChecked = typeof checked === 'object' ? checked.checked : Boolean(checked);
  return `<input type="checkbox" ${isChecked ? 'checked' : ''} disabled />`;
};
marked.use({ renderer });

// Разбиваем markdown на блоки (параграфы и блоки кода)
export const splitMarkdownBlocks = (text) => {
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

// Парсим Markdown таблицу в массив данных
export const parseMarkdownTable = (markdownTable) => {
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

// Форматируем текст
export const formatText = (text, format) => {
  switch (format) {
    case 'bold':
      return `**${text}**`;
    case 'italic':
      return `*${text}*`;
    case 'code':
      return `\`${text}\``;
    case 'link':
      return `[${text}](url)`;
    case 'heading':
      return `## ${text}`;
    default:
      return text;
  }
};

// Создаем таблицу
export const createTable = (rows = 2, cols = 2) => {
  const header = '| ' + Array(cols).fill('Заголовок').join(' | ') + ' |';
  const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
  const data = Array(rows).fill('| ' + Array(cols).fill('').join(' | ') + ' |');
  return [header, separator, ...data].join('\n');
};

// Создаем список задач
export const createTaskList = (items = []) => {
  return items.map(item => `- [ ] ${item}`).join('\n');
};

// Создаем цитату
export const createQuote = (text) => {
  return `> ${text}`;
};

// Создаем код
export const createCode = (code, language = '') => {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}; 